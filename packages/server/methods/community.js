import { publicDbs, createUser, catchupIndexes } from '../db/index.js'
import { constructEntryUrl } from '../lib/strings.js'
import { assertUserPermission } from './_util.js'
import _pick from 'lodash.pick'
import { fetchUserInfo } from '../lib/network.js'
import { dbGet, addPrefixToRangeOpts } from '../db/util.js'
import { publicServerDb } from '../db/index.js'
import { parseEntryUrl } from '../lib/strings.js'
import * as errors from '../lib/errors.js'
import * as metrics from '../lib/metrics.js'

export function setup (define) {
  define('ctzn.network/methods/community-create', async (auth, params) => {
    if (!auth) throw new errors.SessionError()

    const publicCitizenDb = publicDbs.get(auth.username)
    if (!publicCitizenDb) throw new errors.NotFoundError('User database not found')
    
    // create the community user
    const communityUser = await createUser({
      type: 'community',
      username: params.username,
      profile: {
        displayName: params.displayName,
        description: params.description
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
      user: {userId: auth.userId, dbUrl: publicCitizenDb.url},
      roles: ['admin'],
      joinDate: ts
    }
    await publicCitizenDb.memberships.put(communityInfo.userId, membershipValue)
    await communityUser.publicDb.members.put(auth.userId, memberValue)
    /* dont await */ catchupIndexes(communityUser.publicDb)
    metrics.communityCreated({user: auth.userId, community: communityInfo.userId})

    return communityInfo
  })

  define('ctzn.network/methods/community-delete-ban', async (auth, {bannedUser}) => {
    await assertUserPermission(db, auth.userId, 'ctzn.network/perm-community-ban')
    await db.bans.del(bannedUser.userId)
  })

  define('ctzn.network/methods/community-delete-role', async (auth, {roleId}) => {
    if (roleId === 'admin') throw new errors.PermissionsError('Cannot edit the admin role')
    await assertUserPermission(db, auth.userId, 'ctzn.network/perm-community-manage-roles')
  
    const release = await db.lock('roles')
    try {
      const release2 = await db.lock('members')
      try {
        // remove role from all members
        const memberRecords = await db.members.list()
        for (let memberRecord of memberRecords) {
          if (memberRecord.value.roles?.includes(roleId)) {
            memberRecord.value.roles = memberRecord.value.roles.filter(r => r !== roleId)
            await db.members.put(memberRecord.key, memberRecord.value)
          }
        }
      } finally {
        release2()
      }
  
      // delete role record
      await db.roles.del(roleId)
    } finally {
      release()
    }
  })

  define('ctzn.network/methods/community-invite-member', async (auth, {invitedUser}) => {
    await assertUserPermission(db, auth.userId, 'ctzn.network/perm-community-invite')
  
    const existingInviteRecord = await db.invites.get(invitedUser.userId)
    if (existingInviteRecord) {
      return {
        key: invitedUser.userId,
        url: db.invites.constructEntryUrl(invitedUser.userId)
      }
    }
    const invitedUserInfo = await fetchUserInfo(invitedUser.userId)
    await db.invites.put(invitedUser.userId, {
      invitedUser: invitedUserInfo,
      createdBy: {userId: auth.userId, dbUrl: auth.url},
      createdAt: (new Date()).toISOString()
    })
  
    return {
      key: invitedUser.userId,
      url: db.invites.constructEntryUrl(invitedUser.userId)
    }
  })

  define('ctzn.network/methods/community-join', async (auth, {communityId}) => {
    if (!auth) throw new errors.SessionError()

    const publicCitizenDb = publicDbs.get(auth.userId)
    if (!publicCitizenDb) throw new errors.NotFoundError('User database not found')

    const communityInfo = await fetchUserInfo(communityId)
    const publicCommunityDb = publicDbs.get(communityInfo.userId)
    if (!publicCommunityDb || !publicCommunityDb.writable) {
      // remote join
      const ws = await connectWs(parseUserId(communityInfo.userId).domain)
      const remoteJoinOpts = {
        communityId,
        user: {userId: auth.userId, dbUrl: publicCitizenDb.url}
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
      const ban = await publicCommunityDb.bans.get(auth.userId)
      if (ban) {
        throw new errors.PermissionsError(`You have been banned from this community. ${ban.value.reason ? `Reason: ${ban.value.reason}` : ''}`)
      }

      // check for invites if it's a closed community
      const configEntry = await publicCommunityDb.communityConfig.get('self')
      if (configEntry?.value?.joinMode === 'closed') {
        const inviteEntry = await publicCommunityDb.invites.get(auth.userId)
        if (!inviteEntry) {
          throw new errors.PermissionsError(`You must be invited to join this community.`)
        }
      }

      // create member and membership records
      const joinDate = (new Date()).toISOString()
      const membershipValue = {community: communityInfo, joinDate}
      const memberValue = {user: {userId: auth.userId, dbUrl: publicCitizenDb.url}, joinDate}

      // validate before writing to avoid partial transactions
      publicCitizenDb.memberships.schema.assertValid(membershipValue)
      publicCommunityDb.members.schema.assertValid(memberValue)

      await publicCitizenDb.memberships.put(communityInfo.userId, membershipValue)
      await publicCommunityDb.members.put(auth.userId, memberValue)
      /* dont await */ catchupIndexes(publicCommunityDb)
      
      return {
        membershipRecord: {
          key: communityInfo.userId,
          url: constructEntryUrl(publicCitizenDb.url, 'ctzn.network/community-membership', communityInfo.userId)
        },
        memberRecord: {
          key: auth.userId,
          url: constructEntryUrl(publicCommunityDb.url, 'ctzn.network/community-member', auth.userId)
        }
      }
    }
  })

  define('ctzn.network/methods/community-leave', async (auth, {communityId}) => {
    if (!auth) throw new errors.SessionError()

    const publicCitizenDb = publicDbs.get(auth.userId)
    if (!publicCitizenDb) throw new errors.NotFoundError('User database not found')
    
    const communityInfo = await fetchUserInfo(communityId)
    const publicCommunityDb = publicDbs.get(communityInfo.userId)
    if (!publicCommunityDb || !publicCommunityDb.writable) {
      // remote leave
      const ws = await connectWs(parseUserId(communityInfo.userId).domain)
      const remoteLeaveOpts = {
        communityId,
        user: {userId: auth.userId, dbUrl: publicCitizenDb.url}
      }
      await ws.call('communities.remoteLeave', [remoteLeaveOpts])

      // remote leave succeeded, delete citizen's membership record
      await publicCitizenDb.memberships.del(communityInfo.userId)
    } else {
      // local leave
      const release = await publicCommunityDb.lock('members')
      try {
        await publicCitizenDb.memberships.del(communityInfo.userId)
        await publicCommunityDb.members.del(auth.userId)
      } finally {
        release()
      }
    }
  })

  define('ctzn.network/methods/community-put-ban', async (auth, {bannedUser, reason}) => {
    await assertUserPermission(db, auth.userId, 'ctzn.network/perm-community-ban')
  
    const exstingBanRecord = await db.bans.get(bannedUser.userId)
    const bannedUserInfo = await fetchUserInfo(bannedUser.userId)
    await db.bans.put(bannedUser.userId, {
      bannedUser: bannedUserInfo,
      createdBy: {userId: auth.userId, dbUrl: auth.url},
      reason: reason,
      createdAt: exstingBanRecord?.value?.createdAt || (new Date()).toISOString()
    })
  
    return {
      key: bannedUser.userId,
      url: db.bans.constructEntryUrl(bannedUser.userId)
    }
  })

  define('ctzn.network/methods/community-put-role', async (auth, {roleId, permissions}) => {
    if (roleId === 'admin') throw new errors.PermissionsError('Cannot edit the admin role')
    await assertUserPermission(db, auth.userId, 'ctzn.network/perm-community-manage-roles')
  
    const release = await db.lock('roles')
    try {
      let roleEntry = await db.roles.get(roleId)
      await db.roles.put(roleId, {
        roleId: roleId,
        permissions: permissions,
        createdAt: roleEntry?.value?.createdAt || (new Date()).toISOString()
      })
    } finally {
      release()
    }
  
    return {
      key: roleId,
      url: db.roles.constructEntryUrl(roleId)
    }
  })

  define('ctzn.network/methods/community-remove-content', async (auth, {contentUrl}) => {
    const { schemaId } = parseEntryUrl(contentUrl)
    if (schemaId === 'ctzn.network/post') {
      await assertUserPermission(db, auth.userId, 'ctzn.network/perm-community-remove-post')
      const feedIdxEntry = await publicServerDb.feedIdx.scanFind(addPrefixToRangeOpts(db.userId, {reverse: true}), entry => (
        entry.value.item.dbUrl === contentUrl
      )).catch(e => undefined)
      if (!feedIdxEntry) {
        throw new Error('Unable to find post in the community feed')
      }
      await publicServerDb.feedIdx.del(feedIdxEntry.key)
    } else if (schemaId === 'ctzn.network/comment') {
      await assertUserPermission(db, auth.userId, 'ctzn.network/perm-community-remove-comment')
      const res = await dbGet(contentUrl)
      if (!res?.entry) {
        throw new Error('Unable to lookup comment')
      }
      const [rootRes, threadIdxEntry] = await Promise.all([
        dbGet(res.entry.value.reply.root.dbUrl),
        publicServerDb.threadIdx.get(res.entry.value.reply.root.dbUrl)
      ])
      if (!rootRes || !threadIdxEntry) {
        throw new Error('Unable to find thread the comment is a part of')
      }
      if (rootRes.entry?.value?.community?.userId !== db.userId) {
        throw new Error('Thread is not a part of this community')
      }
      let commentIndex = threadIdxEntry.value.items?.findIndex(c => c.dbUrl === contentUrl)
      if (commentIndex !== -1) {
        threadIdxEntry.value.items.splice(commentIndex, 1)
        await publicServerDb.threadIdx.put(threadIdxEntry.key, threadIdxEntry.value)
      } else {
        throw new Error('Unable to find comment in the thread')
      }
    } else {
      throw new Error(`Unable remove content of type "${schemaId}"`)
    }
  })

  define('ctzn.network/methods/community-remove-member', async (auth, {member, ban, banReason}) => {
    await assertUserPermission(db, auth.userId, 'ctzn.network/perm-community-ban')
  
    // (optionally) create ban record
    if (ban) {
      let bannedUserInfo = await fetchUserInfo(member.userId)
      await db.bans.put(member.userId, {
        bannedUser: bannedUserInfo,
        createdBy: {userId: auth.userId, dbUrl: auth.url},
        reason: banReason,
        createdAt: (new Date()).toISOString()
      })
    }
  
    const release = await db.lock('members')
    try {
      // delete member record
      await db.members.del(member.userId)
    } finally {
      release()
    }
  
    return {
      banRecord: ban ? {
        key: member.userId,
        url: db.bans.constructEntryUrl(member.userId)
      } : undefined
    }
  })

  define('ctzn.network/methods/community-set-member-roles', async (auth, {member, roles}) => {
    await assertUserPermission(db, auth.userId, 'ctzn.network/perm-community-assign-roles')

    const release = await db.lock('members')
    try {
      let memberRecord = await db.members.get(member.userId)
      if (!memberRecord) throw new Error(`${member.userId} is not a member of this group`)
      memberRecord.value.roles = roles || []
      await db.members.put(member.userId, memberRecord.value)
    } finally {
      release()
    }

    return {
      key: member.userId,
      url: db.members.constructEntryUrl(member.userId)
    }
  })

  define('ctzn.network/methods/community-update-config', async (auth, args) => {
    await assertUserPermission(db, auth.userId, 'ctzn.network/perm-community-update-config')
    const release = await db.communityConfig.lock()
    try {
      const configEntry = await db.communityConfig.get('self')
      const updates = _pick(args, ['joinMode'])
      const value = configEntry?.value || ({
        createdAt: (new Date()).toISOString()
      })
      value.updatedAt = (new Date()).toISOString()
      await db.communityConfig.put('self', Object.assign(value, updates))
    } finally {
      release()
    }
  })
}