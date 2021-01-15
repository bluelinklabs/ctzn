import * as rpcWebsockets from '../../vendor/rpc-websockets/bundle.js'

export async function create (endpoint) {
  var ws = new rpcWebsockets.Client(endpoint)
  await new Promise(resolve => ws.on('open', resolve))
  return new Proxy({}, {
    get (target, prop) {
      // generate rpc calls as needed
      if (!(prop in target)) {
        target[prop] = (...params) => ws.call(prop, params)
      }

      return target[prop]
    }
  })
}