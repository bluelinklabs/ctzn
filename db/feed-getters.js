import lexint from 'lexicographic-integer-encoding'
import { publicDbs } from './index.js'
import { constructEntryUrl, parseEntryUrl, getServerIdForUserId } from '../lib/strings.js'
import { fetchUserId } from '../lib/network.js'
import { dbGet, fetchAuthor, fetchReactions, fetchReplyCount, addPrefixToRangeOpts } from './util.js'
import * as errors from '../lib/errors.js'

const lexintEncoder = lexint('hex')

export async function listHomeFeed (opts, auth) {
  /**
   * DEBUG
   * We're experiencing some issues with hyperbees which cause the feed to fail
   * to load. This 'whereIWas' race is designed to help us isolate where the
   * failure is occurring. It should be removed eventually - we're deploying it
   * now so we can isolate the issues on live alpha servers.
   * - prf
   */
  let whereIWas = 'init'
  let promise = (async () => {
    opts = opts && typeof opts === 'object' ? opts : {}
    opts.lt = opts.lt && typeof opts.lt === 'string' ? opts.lt : lexintEncoder.encode(Date.now())

    if (!auth) throw new errors.SessionError()
    const publicDb = publicDbs.get(auth.userId)
    if (!publicDb) throw new errors.NotFoundError('User database not found')

    whereIWas = 'listing follows'
    const followEntries = await publicDb.follows.list()
    followEntries.unshift({value: {subject: auth}})
    whereIWas = 'listing memberships'
    const membershipEntries = await publicDb.memberships.list()
    whereIWas = 'getting databases'
    const sourceDbs = [
      ...followEntries.map(f => ({db: publicDbs.get(f.value.subject.userId)})),
      ...membershipEntries.map(m => {
        const serverId = getServerIdForUserId(m.value.community.userId)
        return {
          communityId: m.value.community.userId,
          db: publicDbs.get(serverId)
        }
      })
    ]
    
    whereIWas = 'initializing cursors'
    const cursors = sourceDbs.map(({db, communityId}) => {
      if (!db) return undefined
      if (db.dbType === 'ctzn.network/public-citizen-db') {
        return db.posts.cursorRead({lt: opts?.lt, reverse: true})
      } else if (communityId) {
        const cursor = db.feedIdx.cursorRead(addPrefixToRangeOpts(communityId, {lt: opts?.lt, reverse: true}))
        cursor.prefixLength = communityId.length + 1
        return cursor
      }
    })

    async function* mergeCursors (cursors) {
      let cursorResults = []
      
      while (true) {
        let bestI = -1
        for (let i = 0; i < cursors.length; i++) {
          if (!cursors[i]) continue
          if (!cursorResults[i]?.length) {
            whereIWas = `calling cursor.next for ${cursors[i].db._ident}`
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

    const postEntries = []
    const authorsCache = {}
    const limit = Math.min(opts?.limit || 100, 100)
    const mergedCursor = mergeCursors(cursors)
    whereIWas = 'starting the for await'
    for await (let [db, entry] of mergedCursor) {
      if (db.dbType === 'ctzn.network/public-server-db') {
        whereIWas = `getting the post for the feed-idx ${entry.value.item.dbUrl}`
        const res = await dbGet(entry.value.item.dbUrl, {userId: entry.value.item.authorId})
        if (!res) continue
        entry = res.entry
        db = res.db
      } else {
        if (entry.value.community) {
          continue // filter out community posts by followed users
        }
      }
      if (!entry) {
        continue // entry not found
      }
      entry.url = constructEntryUrl(db.url, 'ctzn.network/post', entry.key)
      whereIWas = `fetching the author ${db.userId}`
      entry.author = await fetchAuthor(db.userId, authorsCache)
      whereIWas = `fetching the reactions for ${entry.url}`
      entry.reactions = (await fetchReactions(entry)).reactions
      whereIWas = `fetching the reply count for ${entry.url}`
      entry.replyCount = await fetchReplyCount(entry)
      postEntries.push(entry)
      if (postEntries.length >= limit) {
        break
      }
    }
    whereIWas = 'done'

    return postEntries
  })()

  let to
  const toPromise = new Promise((resolve) => {
    to = setTimeout(() => {
      console.log('HOME FEED TIMED OUT at:', whereIWas)
      resolve([])
    }, 60e3)
    to.unref()
  })
  const clearTO = () => clearTimeout(to)
  const res = Promise.race([promise, toPromise])
  res.then(clearTO, clearTO)
  return res
}
