import * as rpcWebsockets from '../../vendor/rpc-websockets/bundle.js'

const SESSION_ERROR_CODE = -32001

export async function create (endpoint = 'ws://localhost:3000/', recoverSessionFn) {
  let ws
  
  let attemptConnectPromise = undefined
  function attemptConnect () {
    if (attemptConnectPromise) return attemptConnectPromise
    const newWebSocket = new rpcWebsockets.Client(endpoint, {reconnect: false})
    attemptConnectPromise = new Promise((resolve, reject) => {
      newWebSocket.on('open', () => {
        attemptConnectPromise = undefined
        resolve(newWebSocket)
      })
      newWebSocket.on('error', e => {
        attemptConnectPromise = undefined
        reject(new Error('Connection failed'))
      })
    })
    return attemptConnectPromise
  }
  ws = await attemptConnect()

  const api = new Proxy({}, {
    get (target, prop) {
      // generate rpc calls as needed
      if (!(prop in target)) {
        target[prop] = new Proxy({}, {
          get (target, prop2) {
            if (!(prop2 in target)) {
              target[prop2] = async (...params) => {
                try {
                  // send call
                  return await ws.call(`${prop}.${prop2}`, params)
                } catch (e) {
                  const isSocketDead =  e?.toString()?.includes('socket not ready')
                  if ((e.code === SESSION_ERROR_CODE || isSocketDead) && recoverSessionFn) {
                    // session is missing, try to recover it
                    if (isSocketDead) {
                      // entire connection died, recreate it
                      ws = await attemptConnect()
                    }
                    if (await recoverSessionFn()) {
                      // success, send the call again
                      try {
                        return await ws.call(`${prop}.${prop2}`, params)
                      } catch (e) {
                        throw new Error(e.data || e.message)
                      }
                    }
                  } else {
                    throw new Error(e.data || e.message)
                  }
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

  return api
}