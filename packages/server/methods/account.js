import { publicServerDb, privateServerDb, createUser } from '../db/index.js'
import { constructUserUrl, constructUserId } from '../lib/strings.js'
import { hashPassword, verifyPassword, generateRecoveryCode } from '../lib/crypto.js'
import * as errors from '../lib/errors.js'
import * as metrics from '../lib/metrics.js'
import * as email from '../lib/email.js'
import ip from 'ip'
import deindent from 'deindent'

const PASSWORD_CHANGE_CODE_LIFETIME = 1e3 * 60 * 60 * 24 // 24 hours

export function setup (define) {
  define('ctzn.network/methods/whoami', async (auth, params) => {
    if (auth) {
      return {
        hasSession: true,
        url: constructUserUrl(auth.username),
        dbUrl: auth.dbUrl,
        username: auth.username
      }
    }
    return {hasSession: false}
  })

  define('ctzn.network/methods/login', async (auth, {username, password}, req) => {
    // TODO
    // if (username === 'loopback' && ip.isPrivate(client._socket.remoteAddress)) {
    //   if (password === config.getLocalAuthToken()) {
    //     auth = {
    //       sessionId: 'loopback',
    //       userId: 'loopback@localhost',
    //       username: 'loopback',
    //     }
    //     return true
    //   }
    // }

    const accountRecord = await privateServerDb.accounts.get(username)
    if (!accountRecord || !(await verifyPassword(password, accountRecord.value.hashedPassword))) {
      throw new errors.InvalidCredentialsError()
    }

    const user = await publicServerDb.users.get(username)
    if (!user) {
      throw new errors.NotFoundError('User not found')
    }
    const userId = constructUserId(username)
    await req.session.create({username, dbUrl: user.value.dbUrl})
    metrics.loggedIn({user: userId})

    return {
      userId,
      url: constructUserUrl(username),
      dbUrl: user.value.dbUrl,
      username
    }
  })

  define('ctzn.network/methods/logout', async (auth, params, req) => {
    await req.session.destroy()
  })

  define('ctzn.network/methods/register', async (auth, params, req) => {
    const citizenUser = await createUser({
      type: 'citizen',
      username: params.username,
      email: params.email,
      password: params.password,
      profile: {
        displayName: params.displayName,
        description: params.description
      }
    })

    const username = params.username
    const userId = constructUserId(username)
    const dbUrl = citizenUser.publicDb.url
    await req.session.create({username, dbUrl})
    metrics.signedUp({user: userId})
    return {
      userId,
      url: constructUserUrl(username),
      dbUrl,
      username
    }
  })

  define('ctzn.network/methods/request-password-change-code', async (auth, {username}) => {
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
      Hello! You have received this email because a password-change was requested for your account at ${config.domain}.<br>
      <br>
      Use the following code to update your password: <b>${code}</b><br>
      <br>
      If you didn't request a password change, you can ignore this email.
    `
    await email.send({
      to: accountRecord.value.email,
      subject: `Password change code for ${config.domain}`,
      text,
      html
    })
  })

  define('ctzn.network/methods/change-password', async (auth, {username, code, newPassword}) => {
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
}