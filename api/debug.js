import { createUser, whenAllSynced } from '../db/index.js'

export function setup (wsServer) {
  wsServer.register('debug.createUser', async (params) => {
    const {userId, publicUserDb} = await createUser(params[0])
    return {userId, dbUrl: publicUserDb.url}
  })
  wsServer.register('debug.whenAllSynced', async (params) => {
    return whenAllSynced()
  })
}