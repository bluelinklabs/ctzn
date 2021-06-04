import { getDb } from '../db/index.js'
import { constructEntryUrl, parseEntryUrl, hyperUrlToKeyStr } from '../lib/strings.js'
import { resolveDbId } from '../lib/network.js'
import {
  dbGet,
  fetchAuthor,
  fetchReactions,
  fetchReposts,
  fetchVotesTally,
  fetchReplyCount,
  fetchReplies,
  fetchIndexedFollowerDbKeys
} from './util.js'
import * as cache from '../lib/cache.js'
import { debugLog } from '../lib/debug-log.js'

export async function getPost (db, key, canResolveRepost = false) {
  const postEntry = await db.getTable('ctzn.network/post').get(key)
  if (!postEntry) {
    throw new Error('Post not found')
  }
  if (postEntry.value.source) {
    if (!canResolveRepost || !postEntry.value.source.dbUrl) {
      throw new Error('Post not found')
    }
    let urlp = parseEntryUrl(postEntry.value.source.dbUrl)
    const originalEntry = await getPost(getDb(urlp.dbKey), urlp.key, false)
    originalEntry.respostedBy = await fetchAuthor(db.dbKey)
    return originalEntry
  }
  postEntry.dbUrl = constructEntryUrl(db.url, 'ctzn.network/post', postEntry.key)
  postEntry.author = await fetchAuthor(db.dbKey)
  postEntry.reactions = (await fetchReactions(postEntry)).reactions
  postEntry.reposts = await fetchReposts(postEntry)
  postEntry.replyCount = await fetchReplyCount(postEntry)
  return postEntry
}

export async function listPosts (db, opts, authorDbId) {
  const canUseCache = !opts?.lt && opts?.reverse
  /*if (canUseCache) {
    let cached = cache.getUserFeed(authorDbId, opts?.limit || 100)
    if (cached) {
      debugLog.cacheHit('user-feed', authorDbId)
      let cachedEntries = opts.limit ? cached.slice(0, opts?.limit || 100) : cached
      for (let entry of cachedEntries) {
        entry.reactions = (await fetchReactions(entry)).reactions
        entry.reposts = await fetchReposts(entry)
        entry.replyCount = await fetchReplyCount(entry)
      }
      return cachedEntries
    }
  }*/
  const entries = await db.posts.list(opts)
  const authorsCache = {}
  const results = []
  for (let entry of entries) {
    if (entry.value.source?.dbUrl) {
      let urlp = parseEntryUrl(entry.value.source.dbUrl)
      if (urlp.schemaId !== 'ctzn.network/post') continue
      entry = await getPost(getDb(urlp.dbKey), urlp.key)
      if (!entry) continue
      entry.repostedBy = await fetchAuthor(db.dbKey, authorsCache)
    } else {
      entry.dbUrl = constructEntryUrl(db.url, 'ctzn.network/post', entry.key)
      entry.author = await fetchAuthor(db.dbKey, authorsCache)
      entry.reactions = (await fetchReactions(entry)).reactions
      entry.reposts = await fetchReposts(entry)
      entry.replyCount = await fetchReplyCount(entry)
    }
    results.push(entry)
  }
  if (canUseCache) {
    cache.setUserFeed(authorDbId, results, results.length)
  }
  return results
}

export async function getComment (db, key, authorDbId, auth = undefined) {
  const commentEntry = await db.comments.get(key)
  if (!commentEntry) {
    throw new Error('Post not found')
  }
  commentEntry.dbUrl = constructEntryUrl(db.url, 'ctzn.network/comment', commentEntry.key)
  commentEntry.author = await fetchAuthor(authorDbId)
  commentEntry.votes = await fetchVotesTally(commentEntry, auth?.dbKey)
  commentEntry.reactions = (await fetchReactions(commentEntry)).reactions
  commentEntry.replyCount = await fetchReplyCount(commentEntry)
  return commentEntry
}

export async function getThread (subjectUrl, auth) {
  const subject = await dbGet(subjectUrl)
  if (!subject?.entry) throw new Error('Thread subject not found')
  subject.entry.dbUrl = subjectUrl
  subject.entry.author = {dbKey: subject.db.dbKey}
  const replies = await fetchReplies(subject.entry)
  const commentEntries = await fetchIndexedComments(replies, auth)
  return commentEntriesToThread(commentEntries)
}

export async function listFollowers (dbId) {
  const userInfo = await resolveDbId(dbId)
  return {
    subject: {dbKey: userInfo.dbKey},
    followers: await fetchIndexedFollowerDbKeys(userInfo.dbKey)
  }
}

export async function listFollows (db, opts) {
  const entries = await db.follows.list(opts)
  for (let entry of entries) {
    entry.dbUrl = constructEntryUrl(db.url, 'ctzn.network/follow', entry.key)
  }
  return entries
}

async function fetchIndexedComments (comments, auth, {includeReplyCount} = {includeReplyCount: false}) {
  const authorsCache = {}
  const commentEntries = await Promise.all(comments.map(async (comment) => {
    try {
      const {dbKey, key} = parseEntryUrl(comment.dbUrl)

      const publicDb = getDb(dbKey)
      if (!publicDb) return undefined

      const commentEntry = await publicDb.comments.get(key)
      if (!commentEntry) return undefined
      commentEntry.dbUrl = constructEntryUrl(publicDb.url, 'ctzn.network/comment', key)
      commentEntry.author = await fetchAuthor(dbKey, authorsCache)
      commentEntry.votes = await fetchVotesTally(commentEntry, auth?.dbKey)
      commentEntry.reactions = (await fetchReactions(commentEntry)).reactions
      if (includeReplyCount) commentEntry.replyCount = await fetchReplyCount(commentEntry)
      return commentEntry
    } catch (e) {
      console.log(e)
      return undefined
    }
  }))
  return commentEntries.filter(Boolean)
}

function commentEntriesToThread (commentEntries) {
  const commentEntriesByUrl = {}
  commentEntries.forEach(commentEntry => { commentEntriesByUrl[commentEntry.dbUrl] = commentEntry })

  const rootCommentEntries = []
  commentEntries.forEach(commentEntry => {
    if (commentEntry.value.reply?.parent) {
      let parent = commentEntriesByUrl[commentEntry.value.reply.parent.dbUrl]
      if (!parent) {
        commentEntry.isMissingParent = true
        rootCommentEntries.push(commentEntry)
        return
      }
      if (!parent.replies) {
        parent.replies = []
        parent.replyCount = 0
      }
      parent.replies.push(commentEntry)
      parent.replyCount++
    } else {
      rootCommentEntries.push(commentEntry)
    }
  })
  return rootCommentEntries
}