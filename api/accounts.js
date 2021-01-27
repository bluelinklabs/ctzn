import { createValidator } from '../lib/schemas.js'
import { v4 as uuidv4 } from 'uuid'
import { publicServerDb, privateServerDb, createUser } from '../db/index.js'
import { constructUserUrl, constructUserId } from '../lib/strings.js'

const registerParam = createValidator({
  type: 'object',
  required: ['username', 'password'],
  properties: {
    username: {type: 'string'},
    password: {type: 'string'}
  }
})

export function setup (wsServer, {debugMode} = {}) {
  if (debugMode) {
    wsServer.register('accounts.createDebugUser', async (params) => {
      const {userId} = await createUser(params[0])
      return {userId}
    })
  }

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
    registerParam.assert(params[0])
    let {username, password} = params[0]

    // TODO validate credentials
    if (password !== 'password') {
      throw new Error('Invalid username or password')
    }

    const user = await publicServerDb.users.get(username)
    if (!user) {
      throw new Error('User not found')
    }

    // create session
    const sess = {
      sessionId: uuidv4(),
      username,
      createdAt: (new Date()).toISOString()
    }
    await privateServerDb.accountSessions.put(sess.sessionId, sess)

    client.auth = {
      sessionId: sess.sessionId,
      userId: constructUserId(username),
      username,
      dbUrl: user.value.dbUrl
    }

    return {
      userId: constructUserId(username),
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

  wsServer.register('accounts.register', async (params, socket_id) => {
    return 'todo'
  })

  wsServer.register('accounts.unregister', async (params, socket_id) => {
    return 'todo'
  })
}
