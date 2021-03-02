import lexint from 'lexicographic-integer-encoding'
import createMlts from 'monotonic-lexicographic-timestamp'
import { createValidator } from '../lib/schemas.js'
import { publicUserDbs, privateUserDbs, onDatabaseChange } from '../db/index.js'
import { constructEntryUrl, parseEntryUrl } from '../lib/strings.js'
import { fetchUserId } from '../lib/network.js'
import { fetchAuthor, fetchReplyCount } from '../db/util.js'
import { getPost, listPosts } from '../db/getters.js'
import * as errors from '../lib/errors.js'

const lexintEncoder = lexint('hex')
const mlts = createMlts()

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
  wsServer.register('posts.listUserFeed', async ([userId, opts], client) => {
    if (opts) {
      listParam.assert(opts)
    }
    opts = opts || {}
    opts.limit = opts.limit && typeof opts.limit === 'number' ? opts.limit : 100
    opts.limit = Math.max(Math.min(opts.limit, 100), 1)

    userId = await fetchUserId(userId)
    const publicUserDb = publicUserDbs.get(userId)
    if (!publicUserDb) throw new errors.NotFoundError('User database not found')

    return listPosts(publicUserDb, opts, userId, client.auth)
  })

  wsServer.register('posts.listHomeFeed', async ([opts], client) => {
    opts = opts && typeof opts === 'object' ? opts : {}
    opts.lt = opts.lt && typeof opts.lt === 'string' ? opts.lt : lexintEncoder.encode(Date.now())

    if (!client?.auth) throw new errors.SessionError()
    const publicUserDb = publicUserDbs.get(client.auth.userId)
    if (!publicUserDb) throw new errors.NotFoundError('User database not found')

    const followEntries = await publicUserDb.follows.list()
    followEntries.unshift({value: {subject: client.auth}})
    const membershipEntries = await publicUserDb.memberships.list()
    const sourceDbs = [
      ...followEntries.map(f => publicUserDbs.get(f.value.subject.userId)),
      ...membershipEntries.map(m => publicUserDbs.get(m.value.community.userId))
    ]

    const cursors = sourceDbs.map(db => {
      if (!db) return undefined
      if (db.dbType === 'ctzn.network/public-citizen-db') {
        return db.posts.cursorRead({lt: opts?.lt, reverse: true})
      } else if (db.dbType === 'ctzn.network/public-community-db') {
        return db.feedIdx.cursorRead({lt: opts?.lt, reverse: true})
      }
    })

    const postEntries = []
    const authorsCache = {}
    const limit = Math.min(opts?.limit || 100, 100)
    const mergedCursor = mergeCursors(cursors)
    for await (let [db, entry] of mergedCursor) {
      if (db.dbType === 'ctzn.network/public-community-db') {
        const {origin, key} = parseEntryUrl(entry.value.item.dbUrl)
        
        const userId = await fetchUserId(origin)
        const publicUserDb = publicUserDbs.get(userId)
        if (!publicUserDb) continue

        entry = await publicUserDb.posts.get(key)
        if (!entry) continue
        db = publicUserDb
      } else {
        if (entry.value.community) {
          continue // filter out community posts by followed users
        }
      }
      entry.url = constructEntryUrl(db.url, 'ctzn.network/post', entry.key)
      entry.author = await fetchAuthor(db.userId, authorsCache)
      entry.replyCount = await fetchReplyCount(entry, client?.auth?.userId)
      postEntries.push(entry)
      if (postEntries.length >= limit) {
        break
      }
    }

    return postEntries
  })

  wsServer.register('posts.get', async ([userId, key], client) => {
    if (!key && userId) {
      let parsed = parseEntryUrl(userId)
      if (parsed.schemaId !== 'ctzn.network/post') {
        throw new errors.ValidationError('Not a post URL')
      }
      userId = await fetchUserId(parsed.origin)
      key = parsed.key
    }

    const publicUserDb = publicUserDbs.get(userId)
    if (!publicUserDb) throw new errors.NotFoundError('User database not found')

    return getPost(publicUserDb, key, userId, client.auth)
  })

  wsServer.register('posts.create', async ([post], client) => {
    if (!client?.auth) throw new errors.SessionError()
    const publicUserDb = publicUserDbs.get(client.auth.userId)
    if (!publicUserDb) throw new errors.NotFoundError('User database not found')

    const key = mlts()
    post.createdAt = (new Date()).toISOString()
    await publicUserDb.posts.put(key, post)

    const indexingDbs = [privateUserDbs.get(client.auth.userId)]
    if (post.community && publicUserDbs.has(post.community.userId)) {
      indexingDbs.push(publicUserDbs.get(post.community.userId))
    }
    await onDatabaseChange(publicUserDb, indexingDbs)
    
    const url = constructEntryUrl(publicUserDb.url, 'ctzn.network/post', key)
    return {key, url}
  })

  wsServer.register('posts.edit', async ([key, post], client) => {
    if (!client?.auth) throw new errors.SessionError()
    const publicUserDb = publicUserDbs.get(client.auth.userId)
    if (!publicUserDb) throw new errors.NotFoundError('User database not found')

    const postEntry = await publicUserDb.posts.get(key)
    if (!postEntry) {
      throw new errors.NotFoundError('Post not found')
    }

    postEntry.value.text = ('text' in post) ? post.text : postEntry.value.text
    postEntry.value.extendedText = ('extendedText' in post) ? post.extendedText : postEntry.value.extendedText
    await publicUserDb.posts.put(key, postEntry.value)
    await onDatabaseChange(publicUserDb, [privateUserDbs.get(client.auth.userId)])

    const url = constructEntryUrl(publicUserDb.url, 'ctzn.network/post', postEntry.key)
    return {key, url}
  })

  wsServer.register('posts.del', async ([key], client) => {
    if (!client?.auth) throw new errors.SessionError()
    const publicUserDb = publicUserDbs.get(client.auth.userId)
    if (!publicUserDb) throw new errors.NotFoundError('User database not found')
    
    await publicUserDb.posts.del(key)
    await onDatabaseChange(publicUserDb, [privateUserDbs.get(client.auth.userId)])
  })
}

async function* mergeCursors (cursors) {
  let cursorResults = []
  
  while (true) {
    let bestI = -1
    for (let i = 0; i < cursors.length; i++) {
      if (!cursors[i]) continue
      if (!cursorResults[i]?.length) {
        cursorResults[i] = await cursors[i].next(10)
      }
      if (cursorResults[i]?.length) {
        if (bestI === -1) {
          bestI = i
        } else {
          if (cursorResults[i][0].key.localeCompare(cursorResults[bestI][0].key) === 1) {
            bestI = i
          }
        }
      }
    }

    if (bestI === -1) return // out of results
    yield [cursors[bestI].db, cursorResults[bestI].shift()]
  }
}