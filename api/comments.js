import { publicServerDb, userDbs } from '../db/index.js'
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

    const userDb = userDbs.get(userId)
    if (!userDb) throw new Error('User database not found')

    const commentEntry = await userDb.comments.get(key)
    if (!commentEntry) {
      throw new Error('Comment not found')
    }
    commentEntry.url = constructEntryUrl(userDb.url, 'ctzn.network/comment', commentEntry.key)

    return commentEntry
  })

  wsServer.register('comments.create', async ([comment], client) => {
    if (!client?.auth) throw new Error('Must be logged in')
    const userDb = userDbs.get(client.auth.userId)
    if (!userDb) throw new Error('User database not found')

    const key = ''+Date.now()
    comment.createdAt = (new Date()).toISOString()
    await userDb.comments.put(key, comment)

    const url = constructEntryUrl(userDb.url, 'ctzn.network/comment', key)
    const commentEntry = await userDb.comments.get(key)
    commentEntry.url = url

    await publicServerDb.updateCommentsIndex({
      type: 'put',
      url,
      key: commentEntry.key,
      value: commentEntry.value
    })

    return {key, url}
  })

  wsServer.register('comments.edit', async ([key, comment], client) => {
    if (!client?.auth) throw new Error('Must be logged in')
    const userDb = userDbs.get(client.auth.userId)
    if (!userDb) throw new Error('User database not found')

    const commentEntry = await userDb.comments.get(key)
    if (!commentEntry) {
      throw new Error('Comment not found')
    }

    if (comment?.text) commentEntry.value.text = comment.text
    await userDb.comments.put(key, commentEntry.value)

    const url = constructEntryUrl(userDb.url, 'ctzn.network/comment', key)

    await publicServerDb.updateCommentsIndex({
      type: 'put',
      url,
      key: commentEntry.key,
      value: commentEntry.value
    })

    return {key, url}
  })

  wsServer.register('comments.del', async ([key], client) => {
    if (!client?.auth) throw new Error('Must be logged in')
    const userDb = userDbs.get(client.auth.userId)
    if (!userDb) throw new Error('User database not found')

    const url = constructEntryUrl(userDb.url, 'ctzn.network/comment', key)
    const commentEntry = await userDb.comments.get(key)

    await userDb.comments.del(key)

    await publicServerDb.updateCommentsIndex({
      type: 'del',
      url,
      key: commentEntry.key,
      value: commentEntry.value
    })
  })
}

async function fetchIndexedComments (commentsIdxEntry) {
  const authorsCache = {}
  const commentEntries = await Promise.all(commentsIdxEntry.value.commentUrls.map(async (commentUrl) => {
    try {
      const {origin, key} = parseEntryUrl(commentUrl)

      const userId = await fetchUserId(origin)
      const userDb = userDbs.get(userId)
      if (!userDb) return undefined

      const commentEntry = await userDb.comments.get(key)
      commentEntry.url = constructEntryUrl(userDb.url, 'ctzn.network/comment', key)
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
    let userDb = userDbs.get(authorId)
    let profileEntry
    if (userDb) profileEntry = await userDb.profile.get('self')
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