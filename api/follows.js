import { publicUserDbs, privateUserDbs, onDatabaseChange, catchupIndexes } from '../db/index.js'
import { constructEntryUrl } from '../lib/strings.js'
import { createValidator } from '../lib/schemas.js'
import { fetchUserInfo } from '../lib/network.js'
import * as errors from '../lib/errors.js'

const listParam = createValidator({
  type: 'object',
  additionalProperties: false,
  properties: {
    lt: {type: 'string'},
    lte: {type: 'string'},
    gt: {type: 'string'},
    gte: {type: 'string'},
    reverse: {type: 'boolean'},
    limit: {type: 'number'}
  }
})

export function setup (wsServer) {
  wsServer.register('follows.follow', async ([subject], client) => {
    if (!client?.auth) throw new errors.SessionError()
    const publicUserDb = publicUserDbs.get(client.auth.userId)
    if (!publicUserDb) throw new errors.NotFoundError('User database not found')

    const subjectInfo = await fetchUserInfo(subject)
    const key = subjectInfo.userId
    if (!key) throw new errors.ValidationError('Must provide subject userId or URL')
    const value = {
      subject: subjectInfo,
      createdAt: (new Date()).toISOString()
    }
    await publicUserDb.follows.put(key, value)
    await onDatabaseChange(publicUserDb, [privateUserDbs.get(client.auth.userId)])
    /* dont await */ catchupIndexes(privateUserDbs.get(client.auth.userId))
    
    const url = constructEntryUrl(publicUserDb.url, 'ctzn.network/follow', key)
    return {key, url}
  })

  wsServer.register('follows.unfollow', async ([subject], client) => {
    if (!client?.auth) throw new errors.SessionError()
    const publicUserDb = publicUserDbs.get(client.auth.userId)
    if (!publicUserDb) throw new errors.NotFoundError('User database not found')

    const subjectInfo = await fetchUserInfo(subject)
    const key = subjectInfo.userId
    if (!key) throw new errors.ValidationError('Must provide subject userId or URL')
    await publicUserDb.follows.del(key)
    await onDatabaseChange(publicUserDb)
  })
}
