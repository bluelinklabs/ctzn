import { publicServerDb, publicUserDbs, onDatabaseChange } from '../db/index.js'
import { constructEntryUrl, parseEntryUrl, constructUserUrl } from '../lib/strings.js'
import { fetchUserId } from '../lib/network.js'

export function setup (wsServer) {
  wsServer.register('comments.getThread', async ([subjectUrl]) => {
    let commentsIdxEntry
    try {
      commentsIdxEntry = await publicServerDb.commentsIdx.get(subjectUrl)
    } catch (e) {}
    if (!commentsIdxEntry) return []

    const commentEntries = await fetchIndexedComments(commentsIdxEntry)
    return commentEntriesToThread(commentEntries)
  })

  wsServer.register('comments.get', async ([userId, key]) => {
    if (!key && userId) {
      let parsed = parseEntryUrl(userId)
      if (parsed.schemaId !== 'ctzn.network/comment') {
        throw new Error('Not a comment URL')
      }
      userId = await fetchUserId(parsed.origin)
      key = parsed.key
    }

    const publicUserDb = publicUserDbs.get(userId)
    if (!publicUserDb) throw new Error('User database not found')

    const commentEntry = await publicUserDb.comments.get(key)
    if (!commentEntry) {
      throw new Error('Comment not found')
    }
    commentEntry.url = constructEntryUrl(publicUserDb.url, 'ctzn.network/comment', commentEntry.key)
    commentEntry.author = await fetchAuthor(userId)
    commentEntry.votes = await fetchVotes(commentEntry)
    commentEntry.commentCount = await fetchCommentCount(commentEntry)

    return commentEntry
  })

  wsServer.register('comments.create', async ([comment], client) => {
    if (!client?.auth) throw new Error('Must be logged in')
    const publicUserDb = publicUserDbs.get(client.auth.userId)
    if (!publicUserDb) throw new Error('User database not found')

    const key = ''+Date.now()
    comment.createdAt = (new Date()).toISOString()
    await publicUserDb.comments.put(key, comment)
    await onDatabaseChange(publicUserDb)
    
    const url = constructEntryUrl(publicUserDb.url, 'ctzn.network/comment', key)
    return {key, url}
  })

  wsServer.register('comments.edit', async ([key, comment], client) => {
    if (!client?.auth) throw new Error('Must be logged in')
    const publicUserDb = publicUserDbs.get(client.auth.userId)
    if (!publicUserDb) throw new Error('User database not found')

    const commentEntry = await publicUserDb.comments.get(key)
    if (!commentEntry) {
      throw new Error('Comment not found')
    }

    if (comment?.text) commentEntry.value.text = comment.text
    await publicUserDb.comments.put(key, commentEntry.value)
    await onDatabaseChange(publicUserDb)

    const url = constructEntryUrl(publicUserDb.url, 'ctzn.network/comment', key)
    return {key, url}
  })

  wsServer.register('comments.del', async ([key], client) => {
    if (!client?.auth) throw new Error('Must be logged in')
    const publicUserDb = publicUserDbs.get(client.auth.userId)
    if (!publicUserDb) throw new Error('User database not found')

    await publicUserDb.comments.del(key)
    await onDatabaseChange(publicUserDb)
  })
}

async function fetchIndexedComments (commentsIdxEntry) {
  const authorsCache = {}
  const commentEntries = await Promise.all(commentsIdxEntry.value.commentUrls.map(async (commentUrl) => {
    try {
      const {origin, key} = parseEntryUrl(commentUrl)

      const userId = await fetchUserId(origin)
      const publicUserDb = publicUserDbs.get(userId)
      if (!publicUserDb) return undefined

      const commentEntry = await publicUserDb.comments.get(key)
      commentEntry.url = constructEntryUrl(publicUserDb.url, 'ctzn.network/comment', key)
      commentEntry.author = await fetchAuthor(userId, authorsCache)
      commentEntry.votes = await fetchVotes(commentEntry)
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
    if (commentEntry.value.parentCommentUrl) {
      let parent = commentEntriesByUrl[commentEntry.value.parentCommentUrl]
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

async function fetchAuthor (authorId, cache = undefined) {
  if (cache && cache[authorId]) {
    return cache[authorId]
  } else {
    let publicUserDb = publicUserDbs.get(authorId)
    let profileEntry
    if (publicUserDb) profileEntry = await publicUserDb.profile.get('self')
    let author = {
      url: constructUserUrl(authorId),
      userId: authorId,
      displayName: profileEntry?.value?.displayName || authorId
    }
    if (cache) cache[authorId] = author
    return author
  }
}

async function fetchVotes (comment) {
  let votesIdxEntry
  try {
    votesIdxEntry = await publicServerDb.votesIdx.get(comment.url)
  } catch (e) {}
  return {
    upvoterIds: await Promise.all((votesIdxEntry?.value?.upvoteUrls || []).map(fetchUserId)),
    downvoterIds: await Promise.all((votesIdxEntry?.value?.downvoteUrls || []).map(fetchUserId))
  }
}

async function fetchCommentCount (comment) {
  let commentsIdxEntry
  try {
    commentsIdxEntry = await publicServerDb.commentsIdx.get(comment.url)
  } catch (e) {}
  return commentsIdxEntry?.value.commentUrls.length || 0
}