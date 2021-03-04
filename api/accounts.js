import { createValidator } from '../lib/schemas.js'
import { v4 as uuidv4 } from 'uuid'
import { publicServerDb, privateServerDb, createUser } from '../db/index.js'
import { constructUserUrl, constructUserId } from '../lib/strings.js'
import { hashPassword, verifyPassword, generateRecoveryCode } from '../lib/crypto.js'
import * as errors from '../lib/errors.js'
import * as email from '../lib/email.js'
import ip from 'ip'
import deindent from 'deindent'

const PASSWORD_CHANGE_CODE_LIFETIME = 1e3 * 60 * 60 * 24 // 24 hours

const registerParam = createValidator({
  type: 'object',
  required: ['username', 'displayName'],
  additionalProperties: false,
  properties: {
    username: {type: 'string', pattern: "^([a-zA-Z][a-zA-Z0-9-]{1,62}[a-zA-Z0-9])$"},
    email: {type: 'string', format: "email"},
    password: {type: 'string', minLength: 1},
    displayName: {type: 'string', minLength: 1, maxLength: 64},
    description: {type: 'string', maxLength: 256}
  }
})

const loginParam = createValidator({
  type: 'object',
  required: ['username', 'password'],
  properties: {
    username: {type: 'string'},
    password: {type: 'string'}
  }
})

export function setup (wsServer, config) {
  wsServer.register('accounts.whoami', async (params, client) => {
    if (client.auth) {
      return {
        userId: client.auth.userId,
        url: constructUserUrl(client.auth.username),
        dbUrl: client.auth.dbUrl,
        username: client.auth.username,
        sessionId: client.auth.sessionId
      }
    }
    return null
  })

  wsServer.register('accounts.resumeSession', async ([sessionId], client) => {
    const sessionRecord = await privateServerDb.accountSessions.get(sessionId)
    if (sessionRecord) {
      const user = await publicServerDb.users.get(sessionRecord.value.username)
      if (!user) {
        throw new errors.NotFoundError('User not found')
      }
      client.auth = {
        username: sessionRecord.value.username,
        sessionId: sessionRecord.value.sessionId,
        userId: constructUserId(sessionRecord.value.username),
        dbUrl: user.value.dbUrl
      }
      return {
        userId: constructUserId(sessionRecord.value.username),
        url: constructUserUrl(sessionRecord.value.username),
        dbUrl: user.value.dbUrl,
        username: sessionRecord.value.username,
        sessionId: sessionRecord.value.sessionId
      }
    }
    return null
  })

  wsServer.register('accounts.login', async (params, client) => {
    loginParam.assert(params[0])
    let {username, password} = params[0]

    if (username === 'loopback' && ip.isPrivate(client._socket.remoteAddress)) {
      if (password === config.getLocalAuthToken()) {
        client.auth = {
          sessionId: 'loopback',
          userId: 'loopback@localhost',
          username: 'loopback',
        }
        return true
      }
    }

    const accountRecord = await privateServerDb.accounts.get(username)
    if (!accountRecord || !(await verifyPassword(password, accountRecord.value.hashedPassword))) {
      throw new errors.InvalidCredentialsError()
    }

    const user = await publicServerDb.users.get(username)
    if (!user) {
      throw new errors.NotFoundError('User not found')
    }
    const userId = constructUserId(username)
    const sess = await createSession(client, {username, userId, dbUrl: user.value.dbUrl})

    return {
      userId,
      url: constructUserUrl(username),
      dbUrl: user.value.dbUrl,
      sessionId: sess.sessionId,
      username
    }
  })

  wsServer.register('accounts.logout', async (params, client) => {
    if (client.auth?.sessionId) {
      await privateServerDb.accountSessions.del(client.auth?.sessionId)
    }
    client.auth = undefined
  })

  wsServer.register('accounts.register', async ([info], client) => {
    info = info || {}
    registerParam.assert(info)
    
    const citizenUser = await createUser({
      type: 'citizen',
      username: info.username,
      email: info.email,
      password: info.password,
      profile: {
        displayName: info.displayName,
        description: info.description
      }
    })

    const username = info.username
    const userId = constructUserId(username)
    const dbUrl = citizenUser.publicUserDb.url
    const sess = await createSession(client, {username, userId, dbUrl})
    return {
      userId,
      url: constructUserUrl(username),
      dbUrl,
      sessionId: sess.sessionId,
      username
    }
  })

  wsServer.register('accounts.requestChangePasswordCode', async ([username]) => {
    if (!username || typeof username !== 'string') {
      throw new errors.NotFoundError('User does not exist')
    }

    const code = generateRecoveryCode()
    let accountRecord
    const release = await privateServerDb.lock(`accounts:${username}`)
    try {
      accountRecord = await privateServerDb.accounts.get(username)
      if (!accountRecord) {
        throw new errors.NotFoundError('User does not exist')
      }
      if (!accountRecord.value.email) {
        throw new errors.NotFoundError('User does not have an email address on file')
      }
      accountRecord.value.passwordChangeCode = code
      accountRecord.value.passwordChangeCodeCreatedAt = (new Date()).toISOString()
      await privateServerDb.accounts.put(username, accountRecord.value)
    } finally {
      release()
    }

    const text = deindent`
      Hello! You have received this email because a password-change was requested for your account at ${config.domain}.
      
      Use the following code to update your password: ${code}

      If you didn't request a password change, you can ignore this email.
    `
    const html = deindent`
      Hello! You have received this email because a password-change was requested for your account at ${config.domain}.

      Use the following code to update your password: <b>${code}</b>

      If you didn't request a password change, you can ignore this email.
    `
    await email.send({
      to: accountRecord.value.email,
      subject: `Password change code for ${config.domain}`,
      text,
      html
    })
  })

  wsServer.register('accounts.changePasswordUsingCode', async ([username, code, newPassword]) => {
    if (!username || typeof username !== 'string') {
      throw new errors.NotFoundError('User does not exist')
    }
    if (!code || typeof code !== 'string') {
      throw new errors.ValidationError('Invalid password-change code')
    }
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 1) {
      throw new errors.ValidationError('Please enter a new password')
    }

    let accountRecord
    const release = await privateServerDb.lock(`accounts:${username}`)
    try {
      accountRecord = await privateServerDb.accounts.get(username)
      if (!accountRecord) {
        throw new errors.NotFoundError('User does not exist')
      }
      if (!accountRecord.value.passwordChangeCode || !accountRecord.value.passwordChangeCodeCreatedAt) {
        throw new errors.InvalidCredentialsError('Password change code has expired')
      }
      const createdAt = new Date(accountRecord.value.passwordChangeCodeCreatedAt)
      if (Date.now() - createdAt > PASSWORD_CHANGE_CODE_LIFETIME) {
        throw new errors.InvalidCredentialsError('Password change code has expired')
      }
      if (code !== accountRecord.value.passwordChangeCode) {
        throw new errors.InvalidCredentialsError('Invalid code, please make sure you\'re using the code which was emailed to you')
      }

      accountRecord.value.hashedPassword = await hashPassword(newPassword)
      accountRecord.value.passwordChangeCode = undefined
      accountRecord.value.passwordChangeCodeCreatedAt = undefined
      await privateServerDb.accounts.put(username, accountRecord.value)
    } finally {
      release()
    }
  })
  

  wsServer.register('accounts.unregister', async (params, socket_id) => {
    return 'todo'
  })
}

async function createSession (client, {username, userId, dbUrl}) {
  const sess = {
    sessionId: uuidv4(),
    username,
    createdAt: (new Date()).toISOString()
  }
  await privateServerDb.accountSessions.put(sess.sessionId, sess)

  client.auth = {
    sessionId: sess.sessionId,
    userId,
    username,
    dbUrl
  }

  return sess
}