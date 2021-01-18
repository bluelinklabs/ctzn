import { publicServerDb, userDbs } from '../db/index.js'
import { constructEntryUrl, parseEntryUrl, constructUserUrl, extractUserUrl } from '../lib/strings.js'

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

  wsServer.register('comments.get', async ([username, key]) => {
    const userDb = userDbs.get(username)
    if (!userDb) throw new Error('User database not found')

    const commentEntry = await userDb.comments.get(key)
    if (!commentEntry) {
      throw new Error('Comment not found')
    }
    commentEntry.url = constructEntryUrl(userDb.comments.schema.url, username, commentEntry.key)

    return commentEntry
  })

  wsServer.register('comments.create', async ([comment], client) => {
    if (!client?.auth) throw new Error('Must be logged in')
    const userDb = userDbs.get(client.auth.username)
    if (!userDb) throw new Error('User database not found')

    const key = ''+Date.now()
    comment.createdAt = (new Date()).toISOString()
    await userDb.comments.put(key, comment)

    const url = constructEntryUrl(userDb.comments.schema.url, client.auth.username, key)
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
    const userDb = userDbs.get(client.auth.username)
    if (!userDb) throw new Error('User database not found')

    const commentEntry = await userDb.comments.get(key)
    if (!commentEntry) {
      throw new Error('Comment not found')
    }

    if (comment?.text) commentEntry.value.text = comment.text
    await userDb.comments.put(key, commentEntry.value)

    const url = constructEntryUrl(userDb.comments.schema.url, client.auth.username, key)

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
    const userDb = userDbs.get(client.auth.username)
    if (!userDb) throw new Error('User database not found')

    const url = constructEntryUrl(userDb.comments.schema.url, client.auth.username, key)
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
      const {username, key} = parseEntryUrl(commentUrl)

      const userDb = userDbs.get(username)
      if (!userDb) return undefined

      const commentEntry = await userDb.comments.get(key)
      commentEntry.url = constructEntryUrl(userDb.comments.schema.url, username, key)
      commentEntry.author = await fetchAuthor(username, authorsCache)
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

async function fetchAuthor (authorUsername, cache = undefined) {
  if (cache && cache[authorUsername]) {
    return cache[authorUsername]
  } else {
    let userDb = userDbs.get(authorUsername)
    let profileEntry
    if (userDb) profileEntry = await userDb.profile.get('self')
    let author = {
      url: constructUserUrl(authorUsername),
      username: authorUsername,
      displayName: profileEntry?.value?.displayName || authorUsername
    }
    if (cache) cache[authorUsername] = author
    return author
  }
}

async function fetchVotes (comment) {
  let votesIdxEntry
  try {
    votesIdxEntry = await publicServerDb.votesIdx.get(comment.url)
  } catch (e) {}
  return {
    upvoterUrls: (votesIdxEntry?.value?.upvoteUrls || []).map(extractUserUrl),
    downvoterUrls: (votesIdxEntry?.value?.downvoteUrls || []).map(extractUserUrl)
  }
}