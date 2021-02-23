import { publicUserDbs } from '../db/index.js'
import { constructEntryUrl, parseEntryUrl } from '../lib/strings.js'
import { fetchUserId, fetchUserInfo } from '../lib/network.js'
import { dbGet, fetchAuthor, fetchVotes, fetchReplyCount, fetchReplies, fetchSelfIndexFollowerIds, fetchCommunityIndexesFollowerIds } from './util.js'

export async function getPost (db, key, authorId, auth = undefined) {
  const postEntry = await db.posts.get(key)
  if (!postEntry) {
    throw new Error('Post not found')
  }
  postEntry.url = constructEntryUrl(db.url, 'ctzn.network/post', postEntry.key)
  postEntry.author = await fetchAuthor(authorId)
  postEntry.votes = await fetchVotes(postEntry, auth?.userId)
  postEntry.replyCount = await fetchReplyCount(postEntry, auth?.userId)
  return postEntry
}

export async function listPosts (db, opts, authorId, auth = undefined) {
  if (db.dbType === 'ctzn.network/public-citizen-db') {
    const entries = await db.posts.list(opts)
    const authorsCache = {}
    for (let entry of entries) {
      entry.url = constructEntryUrl(db.url, 'ctzn.network/post', entry.key)
      entry.author = await fetchAuthor(authorId, authorsCache)
      entry.votes = await fetchVotes(entry, auth?.userId)
      entry.replyCount = await fetchReplyCount(entry, auth?.userId)
    }
    return entries
  } else if (db.dbType === 'ctzn.network/public-community-db') {
    const entries = await db.feedIdx.list(opts)
    return fetchIndexedPosts(entries, auth?.userId, {includeReplyCount: true})
  }
}

export async function getComment (db, key, authorId, auth = undefined) {
  const commentEntry = await db.comments.get(key)
  if (!commentEntry) {
    throw new Error('Post not found')
  }
  commentEntry.url = constructEntryUrl(db.url, 'ctzn.network/comment', commentEntry.key)
  commentEntry.author = await fetchAuthor(authorId)
  commentEntry.votes = await fetchVotes(commentEntry, auth?.userId)
  commentEntry.replyCount = await fetchReplyCount(commentEntry, auth?.userId)
  return commentEntry
}

export async function getThread (subjectUrl, auth = undefined) {
  const subject = await dbGet(subjectUrl)
  if (!subject?.entry) throw new Error('Thread subject not found')
  subject.entry.url = subjectUrl
  subject.entry.author = {userId: subject.db.userId, dbUrl: subject.db.url}
  const replies = await fetchReplies(subject.entry, auth?.userId)
  const commentEntries = await fetchIndexedComments(replies, auth?.userId)
  return commentEntriesToThread(commentEntries)
}

export async function listFollowers (userId, auth = undefined) {
  const userInfo = await fetchUserInfo(userId)
  return {
    subject: userInfo,
    myFollowed: auth ? await fetchSelfIndexFollowerIds(userId, auth.userId) : undefined,
    myCommunity: auth ? await fetchCommunityIndexesFollowerIds(userId, auth.userId) : undefined,
    community: await fetchCommunityIndexesFollowerIds(userId, userId)
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

async function fetchIndexedPosts (postsFeedEntries, userIdxId = undefined, {includeReplyCount} = {includeReplyCount: false}) {
  const authorsCache = {}
  const postEntries = await Promise.all(postsFeedEntries.map(async (postFeedEntry) => {
    try {
      const post = postFeedEntry.value.item
      const {origin, key} = parseEntryUrl(post.dbUrl)

      const userId = await fetchUserId(origin)
      const publicUserDb = publicUserDbs.get(userId)
      if (!publicUserDb) return undefined

      const postEntry = await publicUserDb.posts.get(key)
      if (!postEntry) return undefined
      postEntry.url = constructEntryUrl(publicUserDb.url, 'ctzn.network/post', key)
      postEntry.author = await fetchAuthor(userId, authorsCache)
      postEntry.votes = await fetchVotes(postEntry, userIdxId)
      if (includeReplyCount) postEntry.replyCount = await fetchReplyCount(postEntry, userIdxId)
      return postEntry
    } catch (e) {
      console.log(e)
      return undefined
    }
  }))
  return postEntries.filter(Boolean)
}

async function fetchIndexedComments (comments, userIdxId = undefined, {includeReplyCount} = {includeReplyCount: false}) {
  const authorsCache = {}
  const commentEntries = await Promise.all(comments.map(async (post) => {
    try {
      const {origin, key} = parseEntryUrl(post.dbUrl)

      const userId = await fetchUserId(origin)
      const publicUserDb = publicUserDbs.get(userId)
      if (!publicUserDb) return undefined

      const commentEntry = await publicUserDb.comments.get(key)
      if (!commentEntry) return undefined
      commentEntry.url = constructEntryUrl(publicUserDb.url, 'ctzn.network/comment', key)
      commentEntry.author = await fetchAuthor(userId, authorsCache)
      commentEntry.votes = await fetchVotes(commentEntry, userIdxId)
      if (includeReplyCount) commentEntry.replyCount = await fetchReplyCount(commentEntry, userIdxId)
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