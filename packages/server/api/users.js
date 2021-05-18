import { fetchDbUrl } from '../lib/network.js'

export function setup (wsServer) {
  wsServer.register('users.lookupDbUrl', async ([userId]) => {
    const dbUrl = await fetchDbUrl(userId)
    return {userId, dbUrl}
  })
}
