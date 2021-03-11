import { publicUserDbs } from '../db/index.js'
import { constructUserUrl } from '../lib/strings.js'
import * as errors from '../lib/errors.js'
import bytes from 'bytes'

export function setup (wsServer, config) {
  wsServer.register('profiles.putAvatar', async ([avatarBase64], client) => {
    if (!client?.auth) throw new errors.SessionError()
    const publicUserDb = publicUserDbs.get(client.auth.userId)
    if (!publicUserDb) throw new errors.NotFoundError('User database not found')

    if ((avatarBase64.length / 1.33) > config.avatarSizeLimit) {
      throw new errors.ValidationError(`Your avatar image is too big! It must be smaller than ${bytes(config.avatarSizeLimit)}.`)
    }

    await publicUserDb.blobs.put('avatar', Buffer.from(avatarBase64, 'base64'))
  })
}
