import { publicServerDb, userDbs } from '../db/index.js'
import { constructEntryUrl } from '../lib/strings.js'
import { fetchUserId } from '../lib/network.js'

export function setup (wsServer) {
  wsServer.register('votes.getVotesForSubject', async ([subjectUrl]) => {
    let votesIdxEntry
    try {
      votesIdxEntry = await publicServerDb.votesIdx.get(subjectUrl)
    } catch (e) {}
    return {
      subjectUrl,
      upvoterIds: await Promise.all((votesIdxEntry?.value?.upvoteUrls || []).map(fetchUserId)),
      downvoterIds: await Promise.all((votesIdxEntry?.value?.downvoteUrls || []).map(fetchUserId))
    }
  })

  wsServer.register('votes.put', async ([vote], client) => {
    if (!client?.auth) throw new Error('Must be logged in')
    const userDb = userDbs.get(client.auth.userId)
    if (!userDb) throw new Error('User database not found')

    const key = vote.subjectUrl
    if (!key) throw new Error('Subject URL is required')
    vote.createdAt = (new Date()).toISOString()
    await userDb.votes.put(key, vote)
    
    const url = constructEntryUrl(userDb.url, 'ctzn.network/vote', key)
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
    const userDb = userDbs.get(client.auth.userId)
    if (!userDb) throw new Error('User database not found')

    const url = constructEntryUrl(userDb.url, 'ctzn.network/vote', key)
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
