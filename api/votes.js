import { publicUserDbs, publicServerDb, onDatabaseChange } from '../db/index.js'
import { constructEntryUrl } from '../lib/strings.js'
import { fetchVotes } from '../db/util.js'

export function setup (wsServer) {
  wsServer.register('votes.getVotesForSubject', async ([subjectUrl], client) => {
    const {upvoterIds, downvoterIds} = await fetchVotes({url: subjectUrl}, client?.auth?.userId)
    return {subjectUrl, upvoterIds, downvoterIds}
  })

  wsServer.register('votes.put', async ([vote], client) => {
    if (!client?.auth) throw new Error('Must be logged in')
    const publicUserDb = publicUserDbs.get(client.auth.userId)
    if (!publicUserDb) throw new Error('User database not found')

    const key = vote.subjectUrl
    if (!key) throw new Error('Subject URL is required')
    vote.createdAt = (new Date()).toISOString()
    await publicUserDb.votes.put(key, vote)
    await onDatabaseChange(publicUserDb, [publicServerDb])
    
    const url = constructEntryUrl(publicUserDb.url, 'ctzn.network/vote', key)
    return {key, url}
  })

  wsServer.register('votes.del', async ([key], client) => {
    if (!client?.auth) throw new Error('Must be logged in')
    const publicUserDb = publicUserDbs.get(client.auth.userId)
    if (!publicUserDb) throw new Error('User database not found')

    await publicUserDb.votes.del(key)
    await onDatabaseChange(publicUserDb)
  })
}
