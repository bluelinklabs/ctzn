import lexint from 'lexicographic-integer-encoding'
import { publicDbs } from './index.js'
import { constructEntryUrl, hyperUrlToKeyStr } from '../lib/strings.js'
import { fetchAuthor, fetchReactions, fetchReplyCount } from './util.js'
import * as errors from '../lib/errors.js'
import * as cache from '../lib/cache.js'
import { debugLog } from '../lib/debug-log.js'

const lexintEncoder = lexint('hex')

export async function listHomeFeed (opts, auth) {
  opts = opts && typeof opts === 'object' ? opts : {}
  const didSpecifyLt = !!opts.lt
  const limit = Math.min(opts?.limit || 100, 100)
  opts.lt = opts.lt && typeof opts.lt === 'string' ? opts.lt : lexintEncoder.encode(Date.now())

  if (!auth) throw new errors.SessionError()
  const publicDb = publicDbs.get(auth.username)
  if (!publicDb) throw new errors.NotFoundError('User database not found')

  if (!didSpecifyLt) {
    let cached = cache.getHomeFeed(auth.username, limit)
    if (cached) {
      debugLog.cacheHit('home-feed', auth.username)
      let cachedEntries = opts.limit ? cached.slice(0, limit) : cached
      for (let entry of cachedEntries) {
        entry.reactions = (await fetchReactions(entry)).reactions
        entry.replyCount = await fetchReplyCount(entry)
      }
      return cachedEntries
    }
  }

  const followEntries = await publicDb.follows.list()
  followEntries.unshift({value: {subject: auth}})
  const membershipEntries = await publicDb.memberships.list()
  const sourceDbs = [
    ...followEntries.map(f => publicDbs.get(f.value.subject.dbKey)),
    ...membershipEntries.map(m => publicDbs.get(m.value.community.dbKey))
  ]
  
  const cursors = sourceDbs.map(db => {
    if (!db) return undefined
    return db.posts.cursorRead({lt: opts?.lt, reverse: true, wait: false})
  })

  const postEntries = []
  const authorsCache = {}
  const mergedCursor = mergeCursors(cursors)
  for await (let [db, entry] of mergedCursor) {
    if (db.dbType === 'ctzn.network/public-citizen-db') {
      if (entry.value.community) {
        continue // filter out community posts by followed users
      }
    }
    if (entry.value.source?.dbUrl) {
      // TODO verify source authenticity
      entry.dbUrl = entry.value.source.dbUrl
      entry.author = await fetchAuthor(hyperUrlToKeyStr(entry.value.source.dbUrl), authorsCache)
    } else {
      entry.dbUrl = constructEntryUrl(db.url, 'ctzn.network/post', entry.key)
      entry.author = await fetchAuthor(db.dbKey, authorsCache)
    }
    entry.reactions = (await fetchReactions(entry)).reactions
    entry.replyCount = await fetchReplyCount(entry)
    postEntries.push(entry)
    if (postEntries.length >= limit) {
      break
    }
  }

  if (!didSpecifyLt) {
    cache.setHomeFeed(auth.username, postEntries, limit, 60e3)
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
        if (cursorResults[i]?.length && cursors[i].prefixLength) {
          for (let res of cursorResults[i]) {
            res.key = res.key.slice(cursors[i].prefixLength)
          }
        }
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