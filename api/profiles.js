import { publicUserDbs } from '../db/index.js'
import { constructUserUrl } from '../lib/strings.js'
import { fetchUserId } from '../lib/network.js'
import bytes from 'bytes'

export function setup (wsServer, config) {
  wsServer.register('profiles.get', async ([userId]) => {
    userId = await fetchUserId(userId)
    const publicUserDb = publicUserDbs.get(userId)
    if (!publicUserDb) throw new Error('User database not found')

    const profileEntry = await publicUserDb.profile.get('self')
    if (!profileEntry) {
      throw new Error('User profile not found')
    }
    profileEntry.url = constructUserUrl(userId)
    profileEntry.userId = userId
    profileEntry.dbUrl = publicUserDb.url
    profileEntry.dbType = publicUserDb.dbType
    return profileEntry
  })

  wsServer.register('profiles.put', async ([profile], client) => {
    if (!client?.auth) throw new Error('Must be logged in')
    const publicUserDb = publicUserDbs.get(client.auth.userId)
    if (!publicUserDb) throw new Error('User database not found')

    await publicUserDb.profile.put('self', profile)
    
    const url = constructUserUrl(client.auth.userId)
    return {key: client.auth.userId, url}
  })

  wsServer.register('profiles.putAvatar', async ([avatarBase64], client) => {
    if (!client?.auth) throw new Error('Must be logged in')
    const publicUserDb = publicUserDbs.get(client.auth.userId)
    if (!publicUserDb) throw new Error('User database not found')

    if ((avatarBase64.length / 1.33) > config.avatarSizeLimit) {
      throw new Error(`Your avatar image is too big! It must be smaller than ${bytes(config.avatarSizeLimit)}.`)
    }

    await publicUserDb.blobs.put('avatar', Buffer.from(avatarBase64, 'base64'))
  })
}
