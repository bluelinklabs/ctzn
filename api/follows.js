import { publicUserDbs, privateUserDbs, publicServerDb, onDatabaseChange, catchupIndexes } from '../db/index.js'
import { isHyperUrl, constructEntryUrl } from '../lib/strings.js'
import { createValidator } from '../lib/schemas.js'
import { fetchUserId, fetchUserInfo } from '../lib/network.js'
import { fetchFollowerIds } from '../db/util.js'
import * as perf from '../lib/perf.js'

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
    const userInfo = await fetchUserInfo(userId)
    return {
      subject: userInfo,
      followerIds: await fetchFollowerIds(userId, client?.auth?.userId)
    }
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
    if (!publicUserDb) throw new Error('User database not found')

    const entries = await publicUserDb.follows.list(opts)
    for (let entry of entries) {
      entry.url = constructEntryUrl(publicUserDb.url, 'ctzn.network/follow', entry.key)
    }
    return entries
  })

  wsServer.register('follows.get', async ([userId, subjectId]) => {
    if (isHyperUrl(userId)) {
      userId = await fetchUserId(userId)
    }
    if (isHyperUrl(subjectId)) {
      subjectId = await fetchUserId(subjectId)
    }

    const publicUserDb = publicUserDbs.get(userId)
    if (!publicUserDb) throw new Error('User database not found')
    
    const followEntry = await publicUserDb.follows.get(subjectId)
    if (followEntry) {
      followEntry.url = constructEntryUrl(publicUserDb.url, 'ctzn.network/follow', followEntry.key)
    }
    return followEntry
  })

  wsServer.register('follows.follow', async ([subject], client) => {
    if (!client?.auth) throw new Error('Must be logged in')
    const publicUserDb = publicUserDbs.get(client.auth.userId)
    if (!publicUserDb) throw new Error('User database not found')

    const subjectInfo = await fetchUserInfo(subject)
    const key = subjectInfo.userId
    if (!key) throw new Error('Must provide subject userId or URL')
    const value = {
      subject: subjectInfo,
      createdAt: (new Date()).toISOString()
    }
    await publicUserDb.follows.put(key, value)
    await onDatabaseChange(publicUserDb, [publicServerDb])
    /* dont await */ catchupIndexes(privateUserDbs.get(client.auth.userId))
    
    const url = constructEntryUrl(publicUserDb.url, 'ctzn.network/follow', key)
    return {key, url}
  })

  wsServer.register('follows.unfollow', async ([subject], client) => {
    if (!client?.auth) throw new Error('Must be logged in')
    const publicUserDb = publicUserDbs.get(client.auth.userId)
    if (!publicUserDb) throw new Error('User database not found')

    const subjectInfo = await fetchUserInfo(subject)
    const key = subjectInfo.userId
    if (!key) throw new Error('Must provide subject userId or URL')
    await publicUserDb.follows.del(key)
    await onDatabaseChange(publicUserDb)
  })
}
