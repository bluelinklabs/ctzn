import { publicServerDb, userDbs } from '../db/index.js'
import { constructEntryUrl, extractUserUrl } from '../lib/strings.js'

export function setup (wsServer) {
  wsServer.register('votes.getVotesForSubject', async ([subjectUrl]) => {
    let votesIdxEntry
    try {
      votesIdxEntry = await publicServerDb.votesIdx.get(subjectUrl)
    } catch (e) {}
    return {
      subjectUrl,
      upvoterUrls: (votesIdxEntry?.value?.upvoteUrls || []).map(extractUserUrl),
      downvoterUrls: (votesIdxEntry?.value?.downvoteUrls || []).map(extractUserUrl)
    }
  })

  wsServer.register('votes.put', async ([vote], client) => {
    if (!client?.auth) throw new Error('Must be logged in')
    const userDb = userDbs.get(client.auth.username)
    if (!userDb) throw new Error('User database not found')

    const key = vote.subjectUrl
    if (!key) throw new Error('Subject URL is required')
    vote.createdAt = (new Date()).toISOString()
    await userDb.votes.put(key, vote)
    
    const url = constructEntryUrl(userDb.votes.schema.url, client.auth.username, key)

    await publicServerDb.updateVotesIndex({
      type: 'put',
      url,
      key,
      value: vote
    })

    return {key, url}
  })

  wsServer.register('votes.del', async ([key], client) => {
    if (!client?.auth) throw new Error('Must be logged in')
    const userDb = userDbs.get(client.auth.username)
    if (!userDb) throw new Error('User database not found')

    const url = constructEntryUrl(userDb.votes.schema.url, client.auth.username, key)
    const votesEntry = await userDb.votes.get(key)

    await userDb.votes.del(key)

    await publicServerDb.updateVotesIndex({
      type: 'del',
      url,
      key,
      value: votesEntry.value
    })
  })
}
