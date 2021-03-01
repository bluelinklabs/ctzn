import { createValidator } from '../lib/schemas.js'
import { v4 as uuidv4 } from 'uuid'
import { publicServerDb, privateServerDb, createUser } from '../db/index.js'
import { constructUserUrl, constructUserId } from '../lib/strings.js'
import { verifyPassword } from '../lib/crypto.js'
import ip from 'ip'

const registerParam = createValidator({
  type: 'object',
  required: ['username', 'displayName'],
  additionalProperties: false,
  properties: {
    username: {type: 'string', pattern: "^([a-zA-Z][a-zA-Z0-9-]{2,62}[a-zA-Z0-9])$"},
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
        throw new Error('User not found')
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
      throw new Error('Invalid username or password')
    }

    const user = await publicServerDb.users.get(username)
    if (!user) {
      throw new Error('User not found')
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