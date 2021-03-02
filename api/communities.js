import { publicUserDbs, createUser, catchupIndexes } from '../db/index.js'
import { isHyperUrl, constructEntryUrl, parseUserId } from '../lib/strings.js'
import { createValidator } from '../lib/schemas.js'
import { fetchUserId, fetchUserInfo, reverseDns, connectWs } from '../lib/network.js'
import * as errors from '../lib/errors.js'
import { listCommunityMembers, listCommunityMemberships, listCommunityRoles, listCommunityBans } from '../db/getters.js'
import bytes from 'bytes'

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

    const publicCitizenDb = publicUserDbs.get(client.auth.userId)
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
      dbUrl: communityUser.publicUserDb.url
    }
    const ts = (new Date()).toISOString()

    // create default roles
    await communityUser.publicUserDb.roles.put('moderator', {
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
    await communityUser.publicUserDb.members.put(client.auth.userId, memberValue)
    /* dont await */ catchupIndexes(communityUser.publicUserDb)

    return communityInfo
  })

  wsServer.register('communities.getMember', async ([communityUserId, memberUserId], client) => {
    if (isHyperUrl(communityUserId)) {
      communityUserId = await fetchUserId(communityUserId)
    }
    const publicCommunityDb = publicUserDbs.get(communityUserId)
    if (!publicCommunityDb) throw new errors.NotFoundError('Community database not found')

    return publicCommunityDb.members.get(memberUserId)
  })

  wsServer.register('communities.listMembers', async ([communityUserId, opts], client) => {
    if (isHyperUrl(communityUserId)) {
      communityUserId = await fetchUserId(communityUserId)
    }
    const publicCommunityDb = publicUserDbs.get(communityUserId)
    if (!publicCommunityDb) throw new errors.NotFoundError('Community database not found')

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
    if (!publicCitizenDb) throw new errors.NotFoundError('Citizen database not found')

    if (opts) listParam.assert(opts)
    opts = opts || {}
    opts.limit = opts.limit && typeof opts.limit === 'number' ? opts.limit : 100
    opts.limit = Math.max(Math.min(opts.limit, 100), 1)
    return listCommunityMemberships(publicCitizenDb, opts)
  })

  wsServer.register('communities.join', async ([community], client) => {
    if (!client?.auth) throw new errors.SessionError()

    const publicCitizenDb = publicUserDbs.get(client.auth.userId)
    if (!publicCitizenDb) throw new errors.NotFoundError('User database not found')

    const communityInfo = await fetchUserInfo(community)
    const publicCommunityDb = publicUserDbs.get(communityInfo.userId)
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
    const publicCommunityDb = publicUserDbs.get(communityInfo.userId)
    if (!publicCommunityDb?.writable) {
      throw new errors.NotFoundError('Community not hosted here')
    }

    // validate the server making the request is the home of the joining user
    const clientDomain = await reverseDns(client, (config.debugMode) ? () => {
      return parseUserId(opts.user.userId).domain
    } : undefined)
    if (!opts.user.userId.endsWith(`@${clientDomain}`)) {
      throw new Error(`Joining user's ID (${opts.user.userId}) does not match client domain (${clientDomain})`)
    }

    // check for a ban
    const ban = await publicCommunityDb.bans.get(opts.user.userId)
    if (ban) {
      throw new errors.PermissionsError(`You have been banned from this community. ${ban.value.reason ? `Reason: ${ban.value.reason}` : ''}`)
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

    const publicCitizenDb = publicUserDbs.get(client.auth.userId)
    if (!publicCitizenDb) throw new errors.NotFoundError('User database not found')
    
    const communityInfo = await fetchUserInfo(community)
    const publicCommunityDb = publicUserDbs.get(communityInfo.userId)
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
    const publicCommunityDb = publicUserDbs.get(communityInfo.userId)
    if (!publicCommunityDb?.writable) {
      throw new errors.NotFoundError('Community not hosted here')
    }

    // validate the server making the request is the home of the joining user
    const clientDomain = await reverseDns(client, (config.debugMode) ? () => {
      return parseUserId(opts.user.userId).domain
    } : undefined)
    if (!opts.user.userId.endsWith(`@${clientDomain}`)) {
      throw new Error(`Leaving user's ID (${opts.user.userId}) does not match client domain (${clientDomain})`)
    }

    const release = await publicCommunityDb.lock('members')
    try {
      await publicCommunityDb.members.del(opts.user.userId)
    } finally {
      release()
    }
  })

  wsServer.register('communities.putProfile', async ([community, profile], client) => {
    const authedUser = await lookupAuthedUser(client)
    const {publicCommunityDb} = await lookupCommunity(community)
    await assertUserPermission(publicCommunityDb, authedUser.citizenInfo.userId, 'ctzn.network/perm-community-edit-profile')
    await publicCommunityDb.profile.put('self', profile)
  })

  wsServer.register('communities.putAvatar', async ([community, avatarBase64], client) => {
    const authedUser = await lookupAuthedUser(client)
    const {publicCommunityDb} = await lookupCommunity(community)
    await assertUserPermission(publicCommunityDb, authedUser.citizenInfo.userId, 'ctzn.network/perm-community-edit-profile')

    if ((avatarBase64.length / 1.33) > config.avatarSizeLimit) {
      throw new errors.ValidationError(`Your avatar image is too big! It must be smaller than ${bytes(config.avatarSizeLimit)}.`)
    }

    await publicCommunityDb.blobs.put('avatar', Buffer.from(avatarBase64, 'base64'))
  })

  wsServer.register('communities.assignRole', async ([community, memberUserId, roleId], client) => {
    const authedUser = await lookupAuthedUser(client)
    const {publicCommunityDb} = await lookupCommunity(community)
    await assertUserPermission(publicCommunityDb, authedUser.citizenInfo.userId, 'ctzn.network/perm-community-assign-roles')

    const release = await publicCommunityDb.lock('members')
    try {
      // update member record
      let memberRecord = await publicCommunityDb.members.get(memberUserId)
      if (!memberRecord) throw new Error(`${memberUserId} is not a member of this group`)
      memberRecord.value.roles = memberRecord.value.roles || []
      if (!memberRecord.value.roles.includes(roleId)) {
        memberRecord.value.roles.push(roleId)
      }
      await publicCommunityDb.members.put(memberUserId, memberRecord.value)
    } finally {
      release()
    }
  })

  wsServer.register('communities.unassignRole', async ([community, memberUserId, roleId], client) => {
    const authedUser = await lookupAuthedUser(client)
    const {publicCommunityDb} = await lookupCommunity(community)
    await assertUserPermission(publicCommunityDb, authedUser.citizenInfo.userId, 'ctzn.network/perm-community-assign-roles')

    const release = await publicCommunityDb.lock('members')
    try {
      // update member record
      let memberRecord = await publicCommunityDb.members.get(memberUserId)
      if (!memberRecord) throw new Error(`${memberUserId} is not a member of this group`)
      memberRecord.value.roles = memberRecord.value.roles || []
      if (memberRecord.value.roles.includes(roleId)) {
        memberRecord.value.roles = memberRecord.value.roles.filter(r => r !== roleId)
      }
      await publicCommunityDb.members.put(memberUserId, memberRecord.value)
    } finally {
      release()
    }
  })

  wsServer.register('communities.removeMember', async ([community, memberUserId, opts], client) => {
    const authedUser = await lookupAuthedUser(client)
    const {publicCommunityDb} = await lookupCommunity(community)
    await assertUserPermission(publicCommunityDb, authedUser.citizenInfo.userId, 'ctzn.network/perm-community-ban')

    // (optionally) create ban record
    if (opts?.ban) {
      let bannedUserInfo = await fetchUserInfo(memberUserId)
      await publicCommunityDb.bans.put(bannedUserInfo.userId, {
        bannedUser: bannedUserInfo,
        createdBy: {userId: authedUser.citizenInfo.userId, dbUrl: authedUser.publicCitizenDb.url},
        reason: opts.banReason,
        createdAt: (new Date()).toISOString()
      })
    }

    const release = await publicCommunityDb.lock('members')
    try {
      // delete member record
      await publicCommunityDb.members.del(memberUserId)
    } finally {
      release()
    }
  })

  wsServer.register('communities.listRoles', async ([communityUserId, opts], client) => {
    if (isHyperUrl(communityUserId)) {
      communityUserId = await fetchUserId(communityUserId)
    }
    const publicCommunityDb = publicUserDbs.get(communityUserId)
    if (!publicCommunityDb) throw new errors.NotFoundError('Community database not found')

    if (opts) listParam.assert(opts)
    opts = opts || {}
    opts.limit = opts.limit && typeof opts.limit === 'number' ? opts.limit : 100
    opts.limit = Math.max(Math.min(opts.limit, 100), 1)
    return listCommunityRoles(publicCommunityDb, opts)
  })

  wsServer.register('communities.getRole', async ([community, roleId], client) => {
    const {publicCommunityDb} = await lookupCommunity(community)
    return publicCommunityDb.roles.get(roleId)
  })

  wsServer.register('communities.createRole', async ([community, role], client) => {
    if (role?.roleId === 'admin') throw new errors.PermissionsError('Cannot edit the admin role')
    const authedUser = await lookupAuthedUser(client)
    const {publicCommunityDb} = await lookupCommunity(community)
    await assertUserPermission(publicCommunityDb, authedUser.citizenInfo.userId, 'ctzn.network/perm-community-manage-roles')

    const release = await publicCommunityDb.lock('roles')
    try {
      if (await publicCommunityDb.roles.get(role.roleId)) {
        throw new Error(`Role "${role.roleId}" already exists`)
      }
      await publicCommunityDb.roles.put(role.roleId, {
        roleId: role.roleId,
        permissions: role.permissions,
        createdAt: (new Date()).toISOString()
      })
    } finally {
      release()
    }
  })

  wsServer.register('communities.editRole', async ([community, roleId, role], client) => {
    if (roleId === 'admin') throw new errors.PermissionsError('Cannot edit the admin role')
    const authedUser = await lookupAuthedUser(client)
    const {publicCommunityDb} = await lookupCommunity(community)
    await assertUserPermission(publicCommunityDb, authedUser.citizenInfo.userId, 'ctzn.network/perm-community-manage-roles')
    const release = await publicCommunityDb.lock('roles')
    try {
      let roleRecord = await publicCommunityDb.roles.get(roleId)
      if (!roleRecord) throw new Error(`Role "${roleId}" does not exist`)
      roleRecord.value.permissions = role?.permissions
      await publicCommunityDb.roles.put(roleId, roleRecord.value)
    } finally {
      release()
    }
  })

  wsServer.register('communities.deleteRole', async ([community, roleId], client) => {
    if (roleId === 'admin') throw new errors.PermissionsError('Cannot edit the admin role')
    const authedUser = await lookupAuthedUser(client)
    const {publicCommunityDb} = await lookupCommunity(community)
    await assertUserPermission(publicCommunityDb, authedUser.citizenInfo.userId, 'ctzn.network/perm-community-manage-roles')

    const release = await publicCommunityDb.lock('roles')
    try {
      const release2 = await publicCommunityDb.lock('members')
      try {
        // remove role from all members
        const memberRecords = await publicCommunityDb.members.list()
        for (let memberRecord of memberRecords) {
          if (memberRecord.value.roles?.includes(roleId)) {
            memberRecord.value.roles = memberRecord.value.roles.filter(r => r !== roleId)
            await publicCommunityDb.members.put(memberRecord.key, memberRecord.value)
          }
        }
      } finally {
        release2()
      }

      // delete role record
      await publicCommunityDb.roles.del(roleId)
    } finally {
      release()
    }
  })

  wsServer.register('communities.listUserPermissions', async ([community, memberId], client) => {
    const {publicCommunityDb} = await lookupCommunity(community)
    const memberRecord = await publicCommunityDb.members.get(memberId)
    if (!memberRecord) return []
    if (memberRecord.value.roles?.includes('admin')) {
      return [{permId: 'ctzn.network/perm-admin'}]
    }
    const roleRecords = await Promise.all(memberRecord.value.roles?.map(roleId => publicCommunityDb.roles.get(roleId)) || [])
    return roleRecords.map(roleRecord => roleRecord.value.permissions || []).flat()
  })

  wsServer.register('communities.getUserPermission', async ([community, memberId, permId], client) => {
    const {publicCommunityDb} = await lookupCommunity(community)
    const memberRecord = await publicCommunityDb.members.get(memberId)
    if (!memberRecord) return false
    if (memberRecord.value.roles?.includes('admin')) {
      return {permId: 'ctzn.network/perm-admin'}
    }
    const roleRecords = await Promise.all(memberRecord.value.roles?.map(roleId => publicCommunityDb.roles.get(roleId)) || [])
    for (let roleRecord of roleRecords) {
      const perm = roleRecord.value.permissions?.find(p => p.permId === permId)
      if (perm) return perm
    }
    return false
  })

  wsServer.register('communities.removePost', async ([community, postUrl], client) => {
    const authedUser = await lookupAuthedUser(client)
    const {publicCommunityDb} = await lookupCommunity(community)
    await assertUserPermission(publicCommunityDb, authedUser.citizenInfo.userId, 'ctzn.network/perm-community-remove-post')

    // lookup the post in the feed
    const feedIdxEntry = await publicCommunityDb.feedIdx.scanFind({reverse: true}, entry => (
      entry.value.item.dbUrl === postUrl
    ))

    if (feedIdxEntry) {
      await publicCommunityDb.feedIdx.del(feedIdxEntry.key)
    }
  })

  wsServer.register('communities.removeComment', async ([community, postUrl, commentUrl], client) => {
    const authedUser = await lookupAuthedUser(client)
    const {publicCommunityDb} = await lookupCommunity(community)
    await assertUserPermission(publicCommunityDb, authedUser.citizenInfo.userId, 'ctzn.network/perm-community-remove-comment')

    const threadIdxEntry = await publicCommunityDb.threadIdx.get(postUrl)
    let commentIndex = threadIdxEntry.value.items?.findIndex(c => c.dbUrl === commentUrl)
    if (commentIndex !== -1) {
      threadIdxEntry.value.items.splice(commentIndex, 1)
      await publicCommunityDb.threadIdx.put(threadIdxEntry.key, threadIdxEntry.value)
    }
  })

  wsServer.register('communities.listBans', async ([community, opts], client) => {
    const {publicCommunityDb} = await lookupCommunity(community)
    if (opts) listParam.assert(opts)
    opts = opts || {}
    opts.limit = opts.limit && typeof opts.limit === 'number' ? opts.limit : 100
    opts.limit = Math.max(Math.min(opts.limit, 100), 1)
    return listCommunityBans(publicCommunityDb, opts)
  })

  wsServer.register('communities.getBan', async ([community, userId], client) => {
    const {publicCommunityDb} = await lookupCommunity(community)
    return publicCommunityDb.bans.get(userId)
  })

  wsServer.register('communities.putBan', async ([community, userId, ban], client) => {
    const authedUser = await lookupAuthedUser(client)
    const {publicCommunityDb} = await lookupCommunity(community)
    await assertUserPermission(publicCommunityDb, authedUser.citizenInfo.userId, 'ctzn.network/perm-community-ban')
    
    const banRecord = await publicCommunityDb.bans.get(userId)
    const bannedUserInfo = await fetchUserInfo(userId)
    if (banRecord) {
      // update
      await publicCommunityDb.bans.put(userId, {
        bannedUser: bannedUserInfo,
        createdBy: banRecord.value.createdBy || {userId: authedUser.citizenInfo.userId, dbUrl: authedUser.publicCitizenDb.url},
        reason: ban?.reason || banRecord.value.reason,
        createdAt: banRecord.value.createdAt || (new Date()).toISOString()
      })
    } else {
      // create
      await publicCommunityDb.bans.put(userId, {
        bannedUser: bannedUserInfo,
        createdBy: {userId: authedUser.citizenInfo.userId, dbUrl: authedUser.publicCitizenDb.url},
        reason: ban?.reason,
        createdAt: (new Date()).toISOString()
      })
    }
  })

  wsServer.register('communities.deleteBan', async ([community, userId], client) => {
    const authedUser = await lookupAuthedUser(client)
    const {publicCommunityDb} = await lookupCommunity(community)
    await assertUserPermission(publicCommunityDb, authedUser.citizenInfo.userId, 'ctzn.network/perm-community-ban')

    await publicCommunityDb.bans.del(userId)
  })
}

async function lookupAuthedUser (client) {
  if (!client?.auth) throw new errors.SessionError()
  const publicCitizenDb = publicUserDbs.get(client.auth.userId)
  if (!publicCitizenDb) throw new errors.NotFoundError('User database not found')
  return {citizenInfo: client.auth, publicCitizenDb}
}

async function lookupCommunity (community) {
  const communityInfo = await fetchUserInfo(community)
  const publicCommunityDb = publicUserDbs.get(communityInfo.userId)
  if (!publicCommunityDb?.writable) {
    throw new errors.NotFoundError('Community not hosted here')
  }
  return {communityInfo, publicCommunityDb}
}

async function assertUserPermission (publicCommunityDb, userId, permId) {
  const memberRecord = await publicCommunityDb.members.get(userId)
  if (!memberRecord?.value?.roles?.length) throw new errors.PermissionsError(`Permission denied: ${permId}`)
  const roles = memberRecord.value.roles
  if (roles.includes('admin')) {
    return true
  }
  let roleRecords = (await publicCommunityDb.roles.list()).filter(r => roles.includes(r.value.roleId))
  for (let roleRecord of roleRecords) {
    if (roleRecord.value.permissions?.find(p => p.permId === permId)) {
      return true
    }
  }
  throw new errors.PermissionsError(`Permission denied: ${permId}`)
}