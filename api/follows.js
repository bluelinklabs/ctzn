import { publicUserDbs, privateUserDbs, onDatabaseChange, catchupIndexes } from '../db/index.js'
import { isHyperUrl, constructEntryUrl } from '../lib/strings.js'
import { createValidator } from '../lib/schemas.js'
import { fetchUserId, fetchUserInfo } from '../lib/network.js'
import { listFollowers, listFollows } from '../db/getters.js'
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
  wsServer.register('follows.listFollowers', async ([userId], client) => {
    return listFollowers(userId, client.auth)
  })

  wsServer.register('follows.listFollows', async ([userId, opts]) => {
    if (isHyperUrl(userId)) {
      userId = await fetchUserId(userId)
    }
    if (opts) {
      listParam.assert(opts)
    }
    opts = opts || {}
    opts.limit = opts.limit && typeof opts.limit === 'number' ? opts.limit : 100
    opts.limit = Math.max(Math.min(opts.limit, 100), 1)

    const publicUserDb = publicUserDbs.get(userId)
    if (!publicUserDb) throw new errors.NotFoundError('User database not found')
    return listFollows(publicUserDb, opts)
  })

  wsServer.register('follows.get', async ([userId, subjectId]) => {
    if (isHyperUrl(userId)) {
      userId = await fetchUserId(userId)
    }
    if (isHyperUrl(subjectId)) {
      subjectId = await fetchUserId(subjectId)
    }

    const publicUserDb = publicUserDbs.get(userId)
    if (!publicUserDb) throw new errors.NotFoundError('User database not found')
    
    const followEntry = await publicUserDb.follows.get(subjectId)
    if (followEntry) {
      followEntry.url = constructEntryUrl(publicUserDb.url, 'ctzn.network/follow', followEntry.key)
    }
    return followEntry
  })

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
