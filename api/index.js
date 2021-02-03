import * as accounts from './accounts.js'
import * as comments from './comments.js'
import * as debug from './debug.js'
import * as follows from './follows.js'
import * as posts from './posts.js'
import * as profiles from './profiles.js'
import * as notifications from './notifications.js'
import * as users from './users.js'
import * as votes from './votes.js'

export function setup (wsServer, opts) {
  const origRegister = wsServer.register
  wsServer.register = function (methodName, methodHandler) {
    origRegister.call(this, methodName, async (params, socket_id) => {
      const client = wsServer.namespaces['/'].clients.get(socket_id)
      const res = await methodHandler(params, client)
      return typeof res === 'undefined' ? null : res
    })
  }

  accounts.setup(wsServer)
  comments.setup(wsServer)
  if (opts.debugMode) debug.setup(wsServer)
  follows.setup(wsServer)
  posts.setup(wsServer)
  profiles.setup(wsServer)
  notifications.setup(wsServer)
  users.setup(wsServer)
  votes.setup(wsServer)
}