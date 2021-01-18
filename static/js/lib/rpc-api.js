import * as rpcWebsockets from '../../vendor/rpc-websockets/bundle.js'

export async function create (endpoint = 'ws://localhost:3000/') {
  const ws = new rpcWebsockets.Client(endpoint)
  await new Promise(resolve => ws.on('open', resolve))
  const api = new Proxy({}, {
    get (target, prop) {
      // generate rpc calls as needed
      if (!(prop in target)) {
        target[prop] = new Proxy({}, {
          get (target, prop2) {
            if (!(prop2 in target)) {
              target[prop2] = async (...params) => {
                try {
                  return await ws.call(`${prop}.${prop2}`, params)
                } catch (e) {
                  throw new Error(e.data || e.message)
                }
              }
            }
            return target[prop2]
          }
        })
      }

      return target[prop]
    }
  })

  if (localStorage.sessionId) {
    if (!(await api.accounts.resumeSession(localStorage.sessionId))) {
      localStorage.removeItem('sessionId')
    }
  }

  return api
}