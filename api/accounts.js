import { createValidator } from '../lib/schemas.js'
import { v4 as uuidv4 } from 'uuid'
import { privateServerDb } from '../db/index.js'
import { constructUserUrl } from '../lib/strings.js'

const registerParam = createValidator({
  type: 'object',
  required: ['username', 'password'],
  properties: {
    username: {type: 'string'},
    password: {type: 'string'}
  }
})

export function setup (wsServer) {
  wsServer.register('accounts.whoami', async (params, client) => {
    if (client.auth) {
      return {
        url: constructUserUrl(client.auth.username),
        username: client.auth.username,
        sessionId: client.auth.sessionId
      }
    }
    return null
  })

  wsServer.register('accounts.resumeSession', async ([sessionId], client) => {
    const sessionRecord = await privateServerDb.accountSessions.get(sessionId)
    if (sessionRecord) {
      client.auth = {
        username: sessionRecord.value.username,
        sessionId: sessionRecord.value.sessionId
      }
      return {
        url: constructUserUrl(sessionRecord.value.username),
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

    // create session
    const sess = {
      sessionId: uuidv4(),
      username,
      createdAt: (new Date()).toISOString()
    }
    await privateServerDb.accountSessions.put(sess.sessionId, sess)

    client.auth = {
      sessionId: sess.sessionId,
      username
    }

    return {
      url: constructUserUrl(username),
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
