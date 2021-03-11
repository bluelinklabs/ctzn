import * as accounts from './accounts.js'
import * as blobs from './blobs.js'
import * as comments from './comments.js'
import * as communities from './communities.js'
import * as debug from './debug.js'
import * as follows from './follows.js'
import * as posts from './posts.js'
import * as profiles from './profiles.js'
import * as notifications from './notifications.js'
import * as reactions from './reactions.js'
import * as server from './server.js'
import * as table from './table.js'
import * as users from './users.js'
import * as view from './view.js'

export function setup (wsServer, config) {
  wsServer.wss.on('connection', function connection(ws, req) {

    // Save request headers onto the ws client for later
    ws.headers = req.headers
  })

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
  blobs.setup(wsServer, config)
  comments.setup(wsServer, config)
  communities.setup(wsServer, config)
  if (config.debugMode) debug.setup(wsServer, config)
  follows.setup(wsServer, config)
  posts.setup(wsServer, config)
  profiles.setup(wsServer, config)
  notifications.setup(wsServer, config)
  reactions.setup(wsServer, config)
  server.setup(wsServer, config)
  table.setup(wsServer, config)
  users.setup(wsServer, config)
  view.setup(wsServer, config)
}
