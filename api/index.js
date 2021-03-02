import * as accounts from './accounts.js'
import * as comments from './comments.js'
import * as communities from './communities.js'
import * as debug from './debug.js'
import * as follows from './follows.js'
import * as posts from './posts.js'
import * as profiles from './profiles.js'
import * as notifications from './notifications.js'
import * as server from './server.js'
import * as users from './users.js'
import * as votes from './votes.js'

export function setup (wsServer, config) {
  const origRegister = wsServer.register
  wsServer.register = function (methodName, methodHandler) {
    origRegister.call(this, methodName, async (params, socket_id) => {
      const client = wsServer.namespaces['/'].clients.get(socket_id)
      const res = await methodHandler(params, client).catch(e => {
        throw {
          code: e.rpcCode || -32000,
          message: e.name,
          data: e.message
        }
      })
      return typeof res === 'undefined' ? null : res
    })
  }
  wsServer.registerLoopback = function (methodName, methodHandler) {
    origRegister.call(this, methodName, async (params, socket_id) => {
      const client = wsServer.namespaces['/'].clients.get(socket_id)
      if (!client?.auth?.sessionId === 'loopback') {
        throw new Error('You do not have permission to access this method')
      }
      const res = await methodHandler(params, client)//.catch(e => {throw new Error(e.stack)}) // uncomment this to get a stack in rpc errors
      return typeof res === 'undefined' ? null : res
    })
  }

  accounts.setup(wsServer, config)
  comments.setup(wsServer, config)
  communities.setup(wsServer, config)
  if (config.debugMode) debug.setup(wsServer, config)
  follows.setup(wsServer, config)
  posts.setup(wsServer, config)
  profiles.setup(wsServer, config)
  notifications.setup(wsServer, config)
  server.setup(wsServer, config)
  users.setup(wsServer, config)
  votes.setup(wsServer, config)
}