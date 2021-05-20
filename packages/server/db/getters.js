import { publicServerDb, publicDbs } from '../db/index.js'
import { constructEntryUrl, parseEntryUrl } from '../lib/strings.js'
import { fetchUserInfo } from '../lib/network.js'
import {
  dbGet,
  fetchAuthor,
  fetchReactions,
  fetchReplyCount,
  fetchReplies,
  fetchIndexedFollowerDbKeys,
  addPrefixToRangeOpts
} from './util.js'
import * as cache from '../lib/cache.js'
import { debugLog } from '../lib/debug-log.js'

export async function getPost (db, key, authorDbId, auth = undefined) {
  const postEntry = await db.posts.get(key)
  if (!postEntry) {
    throw new Error('Post not found')
  }
  postEntry.url = constructEntryUrl(db.url, 'ctzn.network/post', postEntry.key)
  postEntry.author = await fetchAuthor(authorDbId)
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

  if (db.dbType === 'ctzn.network/public-citizen-db') {
    const entries = await db.posts.list(opts)
    const authorsCache = {}
    for (let entry of entries) {
      entry.url = constructEntryUrl(db.url, 'ctzn.network/post', entry.key)
      entry.author = await fetchAuthor(authorDbId, authorsCache)
      entry.reactions = (await fetchReactions(entry)).reactions
      entry.replyCount = await fetchReplyCount(entry)
    }
    if (canUseCache) {
      cache.setUserFeed(authorDbId, entries, entries.length)
    }
    return entries
  } else if (db.dbType === 'ctzn.network/public-community-db') {
    const entries = await publicServerDb.feedIdx.list(addPrefixToRangeOpts(db.dbKey, opts))
    const entries2 = await fetchIndexedPosts(entries, {includeReplyCount: true})
    if (canUseCache) {
      cache.setUserFeed(authorDbId, entries2, entries2.length)
    }
    return entries2
  }
}

export async function getComment (db, key, authorDbId, auth = undefined) {
  const commentEntry = await db.comments.get(key)
  if (!commentEntry) {
    throw new Error('Post not found')
  }
  commentEntry.url = constructEntryUrl(db.url, 'ctzn.network/comment', commentEntry.key)
  commentEntry.author = await fetchAuthor(authorDbId)
  commentEntry.reactions = (await fetchReactions(commentEntry)).reactions
  commentEntry.replyCount = await fetchReplyCount(commentEntry)
  return commentEntry
}

export async function getThread (subjectUrl, auth = undefined) {
  const subject = await dbGet(subjectUrl)
  if (!subject?.entry) throw new Error('Thread subject not found')
  subject.entry.url = subjectUrl
  subject.entry.author = {dbKey: subject.db.dbKey}
  const replies = await fetchReplies(subject.entry)
  const commentEntries = await fetchIndexedComments(replies)
  return commentEntriesToThread(commentEntries)
}

export async function listFollowers (dbKey, auth = undefined) {
  const userInfo = await fetchUserInfo(dbKey)
  return {
    subject: userInfo,
    followers: await fetchIndexedFollowerDbKeys(dbKey)
  }
}

export async function listFollows (db, opts) {
  const entries = await db.follows.list(opts)
  for (let entry of entries) {
    entry.url = constructEntryUrl(db.url, 'ctzn.network/follow', entry.key)
  }
  return entries
}

export async function listCommunityMembers (db, opts) {
  const entries = await db.members.list(opts)
  for (let entry of entries) {
    entry.url = constructEntryUrl(db.url, 'ctzn.network/community-member', entry.key)
  }
  return entries
}

export async function listCommunityMemberships (db, opts) {
  const entries = await db.memberships.list(opts)
  for (let entry of entries) {
    entry.url = constructEntryUrl(db.url, 'ctzn.network/community-membership', entry.key)
  }
  return entries
}

export async function listCommunityRoles (db, opts) {
  const entries = await db.roles.list(opts)
  for (let entry of entries) {
    entry.url = constructEntryUrl(db.url, 'ctzn.network/community-role', entry.key)
  }
  return entries
}

export async function listCommunityBans (db, opts) {
  const entries = await db.bans.list(opts)
  for (let entry of entries) {
    entry.url = constructEntryUrl(db.url, 'ctzn.network/community-ban', entry.key)
  }
  return entries
}

async function fetchIndexedPosts (postsFeedEntries, {includeReplyCount} = {includeReplyCount: false}) {
  const authorsCache = {}
  const postEntries = await Promise.all(postsFeedEntries.map(async (postFeedEntry) => {
    try {
      const post = postFeedEntry.value.item
      const {origin, key} = parseEntryUrl(post.dbUrl)

      const publicDb = publicDbs.get(origin)
      if (!publicDb) {
        return undefined
      }

      const postEntry = await publicDb.posts.get(key)
      if (!postEntry) {
        return undefined
      }
      postEntry.url = constructEntryUrl(publicDb.url, 'ctzn.network/post', key)
      postEntry.author = await fetchAuthor(origin, authorsCache)
      postEntry.reactions = (await fetchReactions(postEntry)).reactions
      if (includeReplyCount) postEntry.replyCount = await fetchReplyCount(postEntry)
      return postEntry
    } catch (e) {
      console.log(e)
      return undefined
    }
  }))
  return postEntries.filter(Boolean)
}

async function fetchIndexedComments (comments, {includeReplyCount} = {includeReplyCount: false}) {
  const authorsCache = {}
  const commentEntries = await Promise.all(comments.map(async (post) => {
    try {
      const {origin, key} = parseEntryUrl(post.dbUrl)

      const publicDb = publicDbs.get(origin)
      if (!publicDb) return undefined

      const commentEntry = await publicDb.comments.get(key)
      if (!commentEntry) return undefined
      commentEntry.url = constructEntryUrl(publicDb.url, 'ctzn.network/comment', key)
      commentEntry.author = await fetchAuthor(origin, authorsCache)
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
  commentEntries.forEach(commentEntry => { commentEntriesByUrl[commentEntry.url] = commentEntry })

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