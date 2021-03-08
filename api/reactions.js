import { publicUserDbs, privateUserDbs, onDatabaseChange } from '../db/index.js'
import { constructEntryUrl } from '../lib/strings.js'
import { dbGet, fetchReactions } from '../db/util.js'
import * as errors from '../lib/errors.js'

export function setup (wsServer) {
  wsServer.register('reactions.getReactionsForSubject', async ([subjectUrl], client) => {
    const subject = await dbGet(subjectUrl).catch(e => undefined)
    const subjectEntry = subject ? subject.entry : {}
    if (subject) subjectEntry.author = {userId: subject.db.userId, dbUrl: subject.db.url}
    subjectEntry.url = subjectUrl

    const res = await fetchReactions(subjectEntry, client?.auth?.userId)
    return {subject: res.subject, reactions: res.reactions}
  })

  wsServer.register('reactions.put', async ([reaction], client) => {
    if (!client?.auth) throw new errors.SessionError()
    const publicUserDb = publicUserDbs.get(client.auth.userId)
    if (!publicUserDb) throw new errors.NotFoundError('User database not found')

    reaction = typeof reaction === 'object' ? reaction : {}
    reaction.createdAt = (new Date()).toISOString()
    publicUserDb.reactions.schema.assertValid(reaction)

    const key = `${reaction.reaction}:${reaction.subject.dbUrl}`
    await publicUserDb.reactions.put(key, reaction)
    await onDatabaseChange(publicUserDb, [privateUserDbs.get(client.auth.userId)])
    
    const url = constructEntryUrl(publicUserDb.url, 'ctzn.network/reaction', key)
    return {key, url}
  })

  wsServer.register('reactions.del', async ([subjectDbUrl, reaction], client) => {
    if (!client?.auth) throw new errors.SessionError()
    const publicUserDb = publicUserDbs.get(client.auth.userId)
    if (!publicUserDb) throw new errors.NotFoundError('User database not found')

    await publicUserDb.reactions.del(`${reaction}:${subjectDbUrl}`)
    await onDatabaseChange(publicUserDb)
  })
}
