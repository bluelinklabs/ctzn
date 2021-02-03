import createMlts from 'monotonic-lexicographic-timestamp'
import { publicServerDb, publicUserDbs, onDatabaseChange } from '../db/index.js'
import { constructEntryUrl, parseEntryUrl } from '../lib/strings.js'
import { fetchUserId } from '../lib/network.js'
import { getComment, getThread } from '../db/getters.js'

const mlts = createMlts()

export function setup (wsServer) {
  wsServer.register('comments.getThread', async ([subjectUrl], client) => {
    return getThread(subjectUrl, client.auth)
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
  })

  wsServer.register('comments.create', async ([comment], client) => {
    if (!client?.auth) throw new Error('Must be logged in')
    const publicUserDb = publicUserDbs.get(client.auth.userId)
    if (!publicUserDb) throw new Error('User database not found')

    const key = mlts()
    comment.createdAt = (new Date()).toISOString()
    await publicUserDb.comments.put(key, comment)
    await onDatabaseChange(publicUserDb, [publicServerDb])
    
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
    await onDatabaseChange(publicUserDb, [publicServerDb])

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