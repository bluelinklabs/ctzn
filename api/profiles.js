import { userDbs } from '../db/index.js'
import { constructUserUrl } from '../lib/strings.js'

export function setup (wsServer) {
  wsServer.register('profiles.get', async ([username]) => {
    const userDb = userDbs.get(username)
    if (!userDb) throw new Error('User database not found')

    const profileEntry = await userDb.profile.get('self')
    if (!profileEntry) {
      throw new Error('User profile not found')
    }
    profileEntry.url = constructUserUrl(username)
    return profileEntry
  })

  wsServer.register('profiles.put', async ([profile], client) => {
    if (!client?.auth) throw new Error('Must be logged in')
    const userDb = userDbs.get(client.auth.username)
    if (!userDb) throw new Error('User database not found')

    await userDb.profile.put('self', profile)
    
    const url = constructUserUrl(client.auth.username)
    return {key: client.auth.username, url}
  })

  wsServer.register('profiles.putAvatar', async ([avatarBase64], client) => {
    if (!client?.auth) throw new Error('Must be logged in')
    const userDb = userDbs.get(client.auth.username)
    if (!userDb) throw new Error('User database not found')

    await userDb.media.put('avatar', Buffer.from(avatarBase64, 'base64'))
  })
}
