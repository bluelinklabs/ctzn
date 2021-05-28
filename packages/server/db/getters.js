import { getDb } from '../db/index.js'
import { constructEntryUrl, parseEntryUrl, hyperUrlToKeyStr } from '../lib/strings.js'
import { resolveDbId } from '../lib/network.js'
import {
  dbGet,
  fetchAuthor,
  fetchReactions,
  fetchReplyCount,
  fetchReplies,
  fetchIndexedFollowerDbKeys
} from './util.js'
import * as cache from '../lib/cache.js'
import { debugLog } from '../lib/debug-log.js'

export async function getPost (db, key, authorDbId, auth = undefined) {
  const postEntry = await db.getTable('ctzn.network/post').get(key)
  if (!postEntry) {
    throw new Error('Post not found')
  }
  if (postEntry.value.source?.dbUrl) {
    // TODO verify source authenticity
    postEntry.dbUrl = postEntry.value.source.dbUrl
    postEntry.author = await fetchAuthor(hyperUrlToKeyStr(postEntry.value.source.dbUrl))
  } else {
    postEntry.dbUrl = constructEntryUrl(db.url, 'ctzn.network/post', postEntry.key)
    postEntry.author = await fetchAuthor(db.dbKey)
  }
  postEntry.reactions = (await fetchReactions(postEntry)).reactions
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
        entry.replyCount = await fetchReplyCount(entry)
      }
      return cachedEntries
    }
  }*/
  const entries = await db.posts.list(opts)
  const authorsCache = {}
  for (let entry of entries) {
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
  }
  if (canUseCache) {
    cache.setUserFeed(authorDbId, entries, entries.length)
  }
  return entries
}

export async function getComment (db, key, authorDbId, auth = undefined) {
  const commentEntry = await db.comments.get(key)
  if (!commentEntry) {
    throw new Error('Post not found')
  }
  commentEntry.dbUrl = constructEntryUrl(db.url, 'ctzn.network/comment', commentEntry.key)
  commentEntry.author = await fetchAuthor(authorDbId)
  commentEntry.reactions = (await fetchReactions(commentEntry)).reactions
  commentEntry.replyCount = await fetchReplyCount(commentEntry)
  return commentEntry
}

export async function getThread (subjectUrl) {
  const subject = await dbGet(subjectUrl)
  if (!subject?.entry) throw new Error('Thread subject not found')
  subject.entry.dbUrl = subjectUrl
  subject.entry.author = {dbKey: subject.db.dbKey}
  const replies = await fetchReplies(subject.entry)
  const commentEntries = await fetchIndexedComments(replies)
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

async function fetchIndexedComments (comments, {includeReplyCount} = {includeReplyCount: false}) {
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