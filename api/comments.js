import createMlts from 'monotonic-lexicographic-timestamp'
import { publicUserDbs, onDatabaseChange } from '../db/index.js'
import { constructEntryUrl, parseEntryUrl } from '../lib/strings.js'
import { fetchUserId } from '../lib/network.js'
import { fetchAuthor, fetchVotes, fetchComments, fetchCommentCount } from '../db/util.js'

const mlts = createMlts()

export function setup (wsServer) {
  wsServer.register('comments.getThread', async ([subjectUrl], client) => {
    const commentUrls = await fetchComments({url: subjectUrl}, client?.auth?.userId)
    const commentEntries = await fetchIndexedComments(commentUrls, client?.auth?.userId)
    return commentEntriesToThread(commentEntries)
  })

  wsServer.register('comments.get', async ([userId, key], client) => {
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
    commentEntry.votes = await fetchVotes(commentEntry, client?.auth?.userId)
    commentEntry.commentCount = await fetchCommentCount(commentEntry, client?.auth?.userId)

    return commentEntry
  })

  wsServer.register('comments.create', async ([comment], client) => {
    if (!client?.auth) throw new Error('Must be logged in')
    const publicUserDb = publicUserDbs.get(client.auth.userId)
    if (!publicUserDb) throw new Error('User database not found')

    const key = mlts()
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

async function fetchIndexedComments (commentUrls, userIdxId = undefined) {
  const authorsCache = {}
  const commentEntries = await Promise.all(commentUrls.map(async (commentUrl) => {
    try {
      const {origin, key} = parseEntryUrl(commentUrl)

      const userId = await fetchUserId(origin)
      const publicUserDb = publicUserDbs.get(userId)
      if (!publicUserDb) return undefined

      const commentEntry = await publicUserDb.comments.get(key)
      commentEntry.url = constructEntryUrl(publicUserDb.url, 'ctzn.network/comment', key)
      commentEntry.author = await fetchAuthor(userId, authorsCache)
      commentEntry.votes = await fetchVotes(commentEntry, userIdxId)
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