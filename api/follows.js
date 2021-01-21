import { publicServerDb, userDbs } from '../db/index.js'
import { constructEntryUrl, constructUserUrl } from '../lib/strings.js'
import { createValidator } from '../lib/schemas.js'

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
  wsServer.register('follows.listFollowers', async ([username]) => {
    const subjectUrl = constructUserUrl(username)
    let followsIdxEntry
    try {
      followsIdxEntry = await publicServerDb.followsIdx.get(subjectUrl)
    } catch (e) {}
    return {
      subjectUrl,
      followerUrls: followsIdxEntry?.value?.followerUrls || []
    }
  })

  wsServer.register('follows.listFollows', async ([username, opts]) => {
    if (opts) {
      listParam.assert(opts)
    }
    opts = opts || {}
    opts.limit = opts.limit && typeof opts.limit === 'number' ? opts.limit : 100
    opts.limit = Math.max(Math.min(opts.limit, 100), 1)

    const userDb = userDbs.get(username)
    if (!userDb) throw new Error('User database not found')

    const entries = await userDb.follows.list(opts)
    for (let entry of entries) {
      entry.url = constructEntryUrl(userDb.follows.schema.url, username, entry.key)
    }
    return entries
  })

  wsServer.register('follows.get', async ([username, subjectUrl]) => {
    const userDb = userDbs.get(username)
    if (!userDb) throw new Error('User database not found')
    
    const followEntry = await userDb.follows.get(subjectUrl)
    if (followEntry) {
      followEntry.url = constructEntryUrl(userDb.follows.schema.url, username, subjectUrl)
    }
    return followEntry
  })

  wsServer.register('follows.follow', async ([subjectUrl], client) => {
    if (!client?.auth) throw new Error('Must be logged in')
    const userDb = userDbs.get(client.auth.username)
    if (!userDb) throw new Error('User database not found')

    const key = subjectUrl
    if (!key) throw new Error('Must provide subject URL')
    const value = {
      subjectUrl,
      createdAt: (new Date()).toISOString()
    }
    await userDb.follows.put(key, value)
    const url = constructEntryUrl(userDb.follows.schema.url, client.auth.username, key)

    await publicServerDb.updateFollowsIndex({
      type: 'put',
      url,
      key,
      value
    }, constructUserUrl(client.auth.username))

    return {key, url}
  })

  wsServer.register('follows.unfollow', async ([subjectUrl], client) => {
    if (!client?.auth) throw new Error('Must be logged in')
    const userDb = userDbs.get(client.auth.username)
    if (!userDb) throw new Error('User database not found')

    const key = subjectUrl
    if (!key) throw new Error('Must provide subject URL')
    await userDb.follows.del(key)
    const url = constructEntryUrl(userDb.follows.schema.url, client.auth.username, key)

    await publicServerDb.updateFollowsIndex({
      type: 'del',
      url,
      key,
      value: {subjectUrl}
    }, constructUserUrl(client.auth.username))
  })
}
