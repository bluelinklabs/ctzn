import { RateLimiter } from 'pauls-sliding-window-rate-limiter'
import * as accounts from './accounts.js'
import * as blob from './blob.js'
import * as communities from './communities.js'
import * as dbmethod from './dbmethod.js'
import * as debug from './debug.js'
import * as notifications from './notifications.js'
import * as server from './server.js'
import * as table from './table.js'
import * as users from './users.js'
import * as view from './view.js'
import * as metrics from '../lib/metrics.js'
import { debugLog } from '../lib/debug-log.js'

const CAPTURE_CONN_COUNT_INTERVAL = 30e3
const rl = new RateLimiter({
  limit: 300,
  window: 60e3
})

export function setup (wsServer, config) {
  metrics.activeWebsocketCount({count: 0})
  setInterval(() => {
    metrics.activeWebsocketCount({count: wsServer.namespaces['/'].clients.size})
  }, CAPTURE_CONN_COUNT_INTERVAL).unref()

  wsServer.wss.on('connection', function connection(ws, req) {
    // Save request headers onto the ws client for later
    ws.headers = req.headers
  })

  const origRegister = wsServer.register
  wsServer.register = function (methodName, methodHandler) {
    origRegister.call(this, methodName, async (params, socket_id) => {
      const client = wsServer.namespaces['/'].clients.get(socket_id)
      const ip = client.headers['x-forwarded-for'] || client._socket.remoteAddress
      if (!rl.hit(client?.auth?.userId || ip)) {
        debugLog.rateLimitError(client?.auth?.userId || ip, methodName)
        throw {
          code: -32007,
          message: 'RateLimitError',
          data: 'Rate limit exceeded'
        }
      }
      debugLog.wsCall(methodName, client?.auth?.userId, params)
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
  wsServer.registerAdminOnly = function (methodName, methodHandler) {
    origRegister.call(this, methodName, async (params, socket_id) => {
      const client = wsServer.namespaces['/'].clients.get(socket_id)
      debugLog.wsCall(methodName, client?.auth?.userId)
      if (!config.isUsernameAdmin(client?.auth?.username)) {
        throw new Error('You do not have permission to access this method')
      }
      const res = await methodHandler(params, client)//.catch(e => {throw new Error(e.stack)}) // uncomment this to get a stack in rpc errors
      return typeof res === 'undefined' ? null : res
    })
  }

  accounts.setup(wsServer, config)
  blob.setup(wsServer, config)
  communities.setup(wsServer, config)
  dbmethod.setup(wsServer, config)
  if (config.debugMode) debug.setup(wsServer, config)
  notifications.setup(wsServer, config)
  server.setup(wsServer, config)
  table.setup(wsServer, config)
  users.setup(wsServer, config)
  view.setup(wsServer, config)
}
