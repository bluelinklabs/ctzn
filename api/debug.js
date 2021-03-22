import { createUser, whenAllSynced } from '../db/index.js'
import { debugGetLastEmail } from '../lib/email.js'
import { whenServerReady } from '../index.js'

export function setup (wsServer) {
  wsServer.register('debug.createUser', async (params) => {
    const {userId, publicDb} = await createUser(params[0])
    return {userId, dbUrl: publicDb.url}
  })

  wsServer.register('debug.whenServerReady', async (params) => {
    return whenServerReady
  })

  wsServer.register('debug.whenAllSynced', async (params) => {
    return whenAllSynced()
  })
  
  wsServer.register('debug.getLastEmail', async (params) => {
    return debugGetLastEmail()
  })
}