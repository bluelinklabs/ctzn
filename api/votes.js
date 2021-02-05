import { publicUserDbs, privateUserDbs, onDatabaseChange } from '../db/index.js'
import { constructEntryUrl } from '../lib/strings.js'
import { dbGet, fetchVotes } from '../db/util.js'

export function setup (wsServer) {
  wsServer.register('votes.getVotesForSubject', async ([subjectUrl], client) => {
    const subject = await dbGet(subjectUrl).catch(e => undefined)
    const subjectEntry = subject ? subject.entry : {}
    if (subject) subjectEntry.author = {userId: subject.db.userId, dbUrl: subject.db.url}
    subjectEntry.url = subjectUrl

    const res = await fetchVotes(subjectEntry, client?.auth?.userId)
    return {subject: res.subject, upvoterIds: res.upvoterIds, downvoterIds: res.downvoterIds}
  })

  wsServer.register('votes.put', async ([vote], client) => {
    if (!client?.auth) throw new Error('Must be logged in')
    const publicUserDb = publicUserDbs.get(client.auth.userId)
    if (!publicUserDb) throw new Error('User database not found')

    const key = vote?.subject?.dbUrl
    if (!key) throw new Error('Subject dbUrl is required')
    vote.createdAt = (new Date()).toISOString()
    await publicUserDb.votes.put(key, vote)
    await onDatabaseChange(publicUserDb, [privateUserDbs.get(client.auth.userId)])
    
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
