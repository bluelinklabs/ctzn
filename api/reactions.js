import { publicUserDbs, privateUserDbs, onDatabaseChange } from '../db/index.js'
import { constructEntryUrl } from '../lib/strings.js'
import * as errors from '../lib/errors.js'

export function setup (wsServer) {
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
