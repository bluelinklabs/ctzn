import { start } from '../index.js'
import randomPort from 'random-port'
import { Client as WsClient } from 'rpc-websockets'
import tmp from 'tmp-promise'

export async function createServer () {
  const tmpdir = await tmp.dir({unsafeCleanup: true})
  const port = await new Promise(r => randomPort(r))
  const inst = await start({
    debugMode: true,
    port,
    configDir: tmpdir.path
  })
  console.log('Storing config in', tmpdir.path)

  const client = new WsClient(`ws://localhost:${port}/`)
  const api = await createRpcApi(client)

  return {
    db: inst.db,
    client,
    api,
    close: async () => {
      await inst.close()
      await tmpdir.cleanup()
    }
  }
}

async function createRpcApi (ws) {
  await new Promise(resolve => ws.on('open', resolve))
  return new Proxy({}, {
    get (target, prop) {
      // generate rpc calls as needed
      if (!(prop in target)) {
        target[prop] = new Proxy({}, {
          get (target, prop2) {
            if (!(prop2 in target)) {
              target[prop2] = (...params) => ws.call(`${prop}.${prop2}`, params)
            }
            return target[prop2]
          }
        })
      }

      return target[prop]
    }
  })
}