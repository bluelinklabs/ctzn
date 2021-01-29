import { createUser, whenAllSynced } from '../db/index.js'

export function setup (wsServer) {
  wsServer.register('debug.createUser', async (params) => {
    const {userId} = await createUser(params[0])
    return {userId}
  })
  wsServer.register('debug.whenAllSynced', async (params) => {
    return whenAllSynced()
  })
}