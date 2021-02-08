import { publicUserDbs, createUser, catchupIndexes } from '../db/index.js'
import { isHyperUrl, constructEntryUrl } from '../lib/strings.js'
import { createValidator } from '../lib/schemas.js'
import { fetchUserId, fetchUserInfo } from '../lib/network.js'
import { listCommunityMembers, listCommunityMemberships } from '../db/getters.js'

const createParam = createValidator({
  type: 'object',
  required: ['username', 'displayName'],
  additionalProperties: false,
  properties: {
    username: {type: 'string', pattern: "^([a-zA-Z][a-zA-Z0-9]{2,63})$"},
    displayName: {type: 'string', minLength: 1, maxLength: 64},
    description: {type: 'string', maxLength: 256}
  }
})

const listParam = createValidator({
  type: 'object',
  additionalProperties: false,
  properties: {
    lt: {type: 'string'},
    lte: {type: 'string'},
    gt: {type: 'string'},
    gte: {type: 'string'},
    reverse: {type: 'boolean'},
    limit: {type: 'number'}
  }
})

export function setup (wsServer) {
  wsServer.register('communities.create', async ([info], client) => {
    if (!client?.auth) throw new Error('Must be logged in')

    const publicCitizenDb = publicUserDbs.get(client.auth.userId)
    if (!publicCitizenDb) throw new Error('User database not found')
    
    info = info || {}
    createParam.assert(info)
    
    // create the community user
    const communityUser = await createUser({
      type: 'community',
      username: info.username,
      profile: {
        displayName: info.displayName,
        description: info.description
      }
    })
    const communityInfo = {
      userId: communityUser.userId,
      dbUrl: communityUser.publicUserDb.url
    }

    // add membership records for the creator of the community
    const joinDate = (new Date()).toISOString()
    const membershipValue = {community: communityInfo, joinDate}
    const memberValue = {user: {userId: client.auth.userId, dbUrl: publicCitizenDb.url}, joinDate}
    await publicCitizenDb.memberships.put(communityInfo.userId, membershipValue)
    await communityUser.publicUserDb.members.put(client.auth.userId, memberValue)
    /* dont await */ catchupIndexes(communityUser.publicUserDb)

    return communityInfo
  })

  wsServer.register('communities.listMembers', async ([communityUserId, opts], client) => {
    if (isHyperUrl(communityUserId)) {
      communityUserId = await fetchUserId(communityUserId)
    }
    const publicCommunityDb = publicUserDbs.get(communityUserId)
    if (!publicCommunityDb) throw new Error('Community database not found')

    if (opts) listParam.assert(opts)
    opts = opts || {}
    opts.limit = opts.limit && typeof opts.limit === 'number' ? opts.limit : 100
    opts.limit = Math.max(Math.min(opts.limit, 100), 1)
    return listCommunityMembers(publicCommunityDb, opts)
  })

  wsServer.register('communities.listMemberships', async ([citizenUserId, opts], client) => {
    if (isHyperUrl(citizenUserId)) {
      citizenUserId = await fetchUserId(citizenUserId)
    }
    const publicCitizenDb = publicUserDbs.get(citizenUserId)
    if (!publicCitizenDb) throw new Error('Citizen database not found')

    if (opts) listParam.assert(opts)
    opts = opts || {}
    opts.limit = opts.limit && typeof opts.limit === 'number' ? opts.limit : 100
    opts.limit = Math.max(Math.min(opts.limit, 100), 1)
    return listCommunityMemberships(publicCitizenDb, opts)
  })

  wsServer.register('communities.join', async ([community], client) => {
    if (!client?.auth) throw new Error('Must be logged in')

    const communityInfo = await fetchUserInfo(community)

    const publicCitizenDb = publicUserDbs.get(client.auth.userId)
    if (!publicCitizenDb) throw new Error('User database not found')
    const publicCommunityDb = publicUserDbs.get(communityInfo.userId)
    if (!publicCommunityDb) throw new Error('Community database not found')
    
    if (!publicCommunityDb.writable) {
      // TODO remote communities.join()
      throw new Error('Community not hosted here')
    }

    const joinDate = (new Date()).toISOString()
    const membershipValue = {community: communityInfo, joinDate}
    const memberValue = {user: {userId: client.auth.userId, dbUrl: publicCitizenDb.url}, joinDate}

    // validate before writing to avoid partial transactions
    publicCitizenDb.memberships.schema.assertValid(membershipValue)
    publicCommunityDb.members.schema.assertValid(memberValue)

    await publicCitizenDb.memberships.put(communityInfo.userId, membershipValue)
    await publicCommunityDb.members.put(client.auth.userId, memberValue)
    /* dont await */ catchupIndexes(publicCommunityDb)
    
    return {
      membershipRecord: {
        key: communityInfo.userId,
        url: constructEntryUrl(publicCitizenDb.url, 'ctzn.network/community-membership', communityInfo.userId)
      },
      memberRecord: {
        key: client.auth.userId,
        url: constructEntryUrl(publicCommunityDb.url, 'ctzn.network/community-member', client.auth.userId)
      }
    }
  })

  wsServer.register('communities.leave', async ([community], client) => {
    if (!client?.auth) throw new Error('Must be logged in')

    const communityInfo = await fetchUserInfo(community)

    const publicCitizenDb = publicUserDbs.get(client.auth.userId)
    if (!publicCitizenDb) throw new Error('User database not found')
    const publicCommunityDb = publicUserDbs.get(communityInfo.userId)
    if (!publicCommunityDb) throw new Error('Community database not found')
    
    if (!publicCommunityDb.writable) {
      // TODO remote communities.leave()
      throw new Error('Community not hosted here')
    }

    await publicCitizenDb.memberships.del(communityInfo.userId)
    await publicCommunityDb.members.del(client.auth.userId)
  })
}
