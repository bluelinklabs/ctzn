import { publicServerDb, publicUserDbs } from '../db/index.js'
import { isHyperUrl, constructEntryUrl } from '../lib/strings.js'
import { createValidator } from '../lib/schemas.js'
import { fetchUserId, fetchUserInfo } from '../lib/network.js'

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
  wsServer.register('follows.listFollowers', async ([userId]) => {
    const userInfo = await fetchUserInfo(userId)
    let followsIdxEntry
    try {
      followsIdxEntry = await publicServerDb.followsIdx.get(userInfo.userId)
    } catch (e) {}
    return {
      subject: userInfo,
      followerIds: followsIdxEntry?.value?.followerIds || []
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
    const url = constructEntryUrl(publicUserDb.url, 'ctzn.network/follow', key)

    await publicServerDb.updateFollowsIndex({
      type: 'put',
      url,
      key,
      value
    }, client.auth.userId)

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
    const url = constructEntryUrl(publicUserDb.url, 'ctzn.network/follow',  key)

    await publicServerDb.updateFollowsIndex({
      type: 'del',
      url,
      key,
      value: {subject: subjectInfo}
    }, client.auth.userId)
  })
}
