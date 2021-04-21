import { publicDbs, createUser, catchupIndexes } from '../db/index.js'
import { constructEntryUrl, parseUserId } from '../lib/strings.js'
import { createValidator } from '../lib/schemas.js'
import { fetchUserInfo, reverseDns, connectWs } from '../lib/network.js'
import * as errors from '../lib/errors.js'
import * as metrics from '../lib/metrics.js'

const createParam = createValidator({
  type: 'object',
  required: ['username', 'displayName'],
  additionalProperties: false,
  properties: {
    username: {type: 'string', pattern: "^([a-zA-Z][a-zA-Z0-9-]{1,62}[a-zA-Z0-9])$"},
    displayName: {type: 'string', minLength: 1, maxLength: 64},
    description: {type: 'string', maxLength: 256}
  }
})

const userInfoParam = createValidator({
  type: 'object',
  required: ['dbUrl', 'userId'],
  additionalProperties: false,
  properties: {
    dbUrl: {type: 'string', format: 'uri'},
    userId: {type: 'string', pattern: '.+@.+'}
  }
})

export function setup (wsServer, config) {
  wsServer.register('communities.create', async ([info], client) => {
    if (!client?.auth) throw new errors.SessionError()

    const publicCitizenDb = publicDbs.get(client.auth.userId)
    if (!publicCitizenDb) throw new errors.NotFoundError('User database not found')
    
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
      dbUrl: communityUser.publicDb.url
    }
    const ts = (new Date()).toISOString()

    // create default roles
    await communityUser.publicDb.roles.put('moderator', {
      roleId: 'moderator',
      permissions: [
        {permId: 'ctzn.network/perm-community-ban'},
        {permId: 'ctzn.network/perm-community-remove-post'},
        {permId: 'ctzn.network/perm-community-remove-comment'}
      ],
      createdAt: ts
    })

    // add membership records for the creator of the community
    const membershipValue = {community: communityInfo, joinDate: ts}
    const memberValue = {
      user: {userId: client.auth.userId, dbUrl: publicCitizenDb.url},
      roles: ['admin'],
      joinDate: ts
    }
    await publicCitizenDb.memberships.put(communityInfo.userId, membershipValue)
    await communityUser.publicDb.members.put(client.auth.userId, memberValue)
    /* dont await */ catchupIndexes(communityUser.publicDb)
    metrics.communityCreated({user: client.auth.userId, community: communityInfo.userId})

    return communityInfo
  })

  wsServer.register('communities.join', async ([community], client) => {
    if (!client?.auth) throw new errors.SessionError()

    const publicCitizenDb = publicDbs.get(client.auth.userId)
    if (!publicCitizenDb) throw new errors.NotFoundError('User database not found')

    const communityInfo = await fetchUserInfo(community)
    const publicCommunityDb = publicDbs.get(communityInfo.userId)
    if (!publicCommunityDb || !publicCommunityDb.writable) {
      // remote join
      const ws = await connectWs(parseUserId(communityInfo.userId).domain)
      const remoteJoinOpts = {
        community,
        user: {userId: client.auth.userId, dbUrl: publicCitizenDb.url}
      }
      const remoteJoinRes = await ws.call('communities.remoteJoin', [remoteJoinOpts])
      if (!remoteJoinRes?.memberRecord?.url) {
        throw new Error(`Failed to join remote community, got an unexpected response: ${remoteJoinRes}`)
      }

      // remove join succeeded, create membership record on user
      const joinDate = (new Date()).toISOString()
      const membershipValue = {community: communityInfo, joinDate}
      await publicCitizenDb.memberships.put(communityInfo.userId, membershipValue)
      
      return {
        membershipRecord: {
          key: communityInfo.userId,
          url: constructEntryUrl(publicCitizenDb.url, 'ctzn.network/community-membership', communityInfo.userId)
        },
        memberRecord: remoteJoinRes.memberRecord
      }
    } else {
      // local join

      // check for a ban
      const ban = await publicCommunityDb.bans.get(client.auth.userId)
      if (ban) {
        throw new errors.PermissionsError(`You have been banned from this community. ${ban.value.reason ? `Reason: ${ban.value.reason}` : ''}`)
      }

      // check for invites if it's a closed community
      const configEntry = await publicCommunityDb.communityConfig.get('self')
      if (configEntry?.value?.joinMode === 'closed') {
        const inviteEntry = await publicCommunityDb.invites.get(client.auth.userId)
        if (!inviteEntry) {
          throw new errors.PermissionsError(`You must be invited to join this community.`)
        }
      }

      // create member and membership records
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
    }
  })

  wsServer.register('communities.remoteJoin', async ([opts], client) => {
    opts = opts || {}
    userInfoParam.assert(opts.user)

    const communityInfo = await fetchUserInfo(opts.community)
    const publicCommunityDb = publicDbs.get(communityInfo.userId)
    if (!publicCommunityDb?.writable) {
      throw new errors.NotFoundError('Community not hosted here')
    }

    // validate the server making the request is the home of the joining user
    const clientDomain = await reverseDns(client, (config.debugMode) ? () => {
      return parseUserId(opts.user.userId).domain
    } : undefined)
    if (!opts.user.userId.endsWith(`@${clientDomain}`)) {
      throw new errors.ConfigurationError(`Joining user's ID (${opts.user.userId}) does not match client domain (${clientDomain})`)
    }

    // check for a ban
    const ban = await publicCommunityDb.bans.get(opts.user.userId)
    if (ban) {
      throw new errors.PermissionsError(`You have been banned from this community. ${ban.value.reason ? `Reason: ${ban.value.reason}` : ''}`)
    }

    // check for invites if it's a closed community
    const configEntry = await publicCommunityDb.communityConfig.get('self')
    if (configEntry?.value?.joinMode === 'closed') {
      const inviteEntry = await publicCommunityDb.invites.get(opts.user.userId)
      if (!inviteEntry) {
        throw new errors.PermissionsError(`You must be invited to join this community.`)
      }
    }

    // create member record
    const joinDate = (new Date()).toISOString()
    const memberValue = {user: opts.user, joinDate}
    await publicCommunityDb.members.put(opts.user.userId, memberValue)
    /* dont await */ catchupIndexes(publicCommunityDb)
    
    return {
      memberRecord: {
        key: opts.user.userId,
        url: constructEntryUrl(publicCommunityDb.url, 'ctzn.network/community-member', opts.user.userId)
      }
    }
  })

  wsServer.register('communities.leave', async ([community], client) => {
    if (!client?.auth) throw new errors.SessionError()

    const publicCitizenDb = publicDbs.get(client.auth.userId)
    if (!publicCitizenDb) throw new errors.NotFoundError('User database not found')
    
    const communityInfo = await fetchUserInfo(community)
    const publicCommunityDb = publicDbs.get(communityInfo.userId)
    if (!publicCommunityDb || !publicCommunityDb.writable) {
      // remote leave
      const ws = await connectWs(parseUserId(communityInfo.userId).domain)
      const remoteLeaveOpts = {
        community,
        user: {userId: client.auth.userId, dbUrl: publicCitizenDb.url}
      }
      await ws.call('communities.remoteLeave', [remoteLeaveOpts])

      // remote leave succeeded, delete citizen's membership record
      await publicCitizenDb.memberships.del(communityInfo.userId)
    } else {
      // local leave
      const release = await publicCommunityDb.lock('members')
      try {
        await publicCitizenDb.memberships.del(communityInfo.userId)
        await publicCommunityDb.members.del(client.auth.userId)
      } finally {
        release()
      }
    }
  })

  wsServer.register('communities.remoteLeave', async ([opts], client) => {
    opts = opts || {}
    userInfoParam.assert(opts.user)

    const communityInfo = await fetchUserInfo(opts.community)
    const publicCommunityDb = publicDbs.get(communityInfo.userId)
    if (!publicCommunityDb?.writable) {
      throw new errors.NotFoundError('Community not hosted here')
    }

    // validate the server making the request is the home of the joining user
    const clientDomain = await reverseDns(client, (config.debugMode) ? () => {
      return parseUserId(opts.user.userId).domain
    } : undefined)
    if (!opts.user.userId.endsWith(`@${clientDomain}`)) {
      throw new errors.ConfigurationError(`Leaving user's ID (${opts.user.userId}) does not match client domain (${clientDomain})`)
    }

    const release = await publicCommunityDb.lock('members')
    try {
      await publicCommunityDb.members.del(opts.user.userId)
    } finally {
      release()
    }
  })
}
