import lexint from 'lexicographic-integer-encoding'
import { publicUserDbs } from './index.js'
import { constructEntryUrl, parseEntryUrl } from '../lib/strings.js'
import { fetchUserId } from '../lib/network.js'
import { fetchAuthor, fetchReactions, fetchReplyCount } from './util.js'
import * as errors from '../lib/errors.js'

const lexintEncoder = lexint('hex')

export async function listHomeFeed (opts, auth) {
  opts = opts && typeof opts === 'object' ? opts : {}
  opts.lt = opts.lt && typeof opts.lt === 'string' ? opts.lt : lexintEncoder.encode(Date.now())

  if (!auth) throw new errors.SessionError()
  const publicUserDb = publicUserDbs.get(auth.userId)
  if (!publicUserDb) throw new errors.NotFoundError('User database not found')

  const followEntries = await publicUserDb.follows.list()
  followEntries.unshift({value: {subject: auth}})
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
    entry.reactions = (await fetchReactions(entry, auth?.userId)).reactions
    entry.replyCount = await fetchReplyCount(entry, auth?.userId)
    postEntries.push(entry)
    if (postEntries.length >= limit) {
      break
    }
  }

  return postEntries
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