import { publicDbs, createUser, catchupIndexes } from '../db/index.js'
import { constructEntryUrl } from '../lib/strings.js'
import { assertUserPermission } from './_util.js'
import _pick from 'lodash.pick'
import { resolveDbId } from '../lib/network.js'
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
      username: communityUser.username,
      dbKey: communityUser.publicDb.dbKey
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
      user: {dbKey: publicCitizenDb.dbKey},
      roles: ['admin'],
      joinDate: ts
    }
    await publicCitizenDb.memberships.put(communityInfo.dbKey, membershipValue)
    await communityUser.publicDb.members.put(auth.dbKey, memberValue)
    /* dont await */ catchupIndexes(communityUser.publicDb)
    metrics.communityCreated({user: auth.username, community: communityInfo.username})

    return communityInfo
  })

  define('ctzn.network/methods/community-delete-ban', async (auth, {bannedUser}) => {
    // TODO get db
    await assertUserPermission(db, auth.dbKey, 'ctzn.network/perm-community-ban')
    await db.bans.del(bannedUser.dbKey)
  })

  define('ctzn.network/methods/community-delete-role', async (auth, {roleId}) => {
    if (roleId === 'admin') throw new errors.PermissionsError('Cannot edit the admin role')
    // TODO get db
    await assertUserPermission(db, auth.dbKey, 'ctzn.network/perm-community-manage-roles')
  
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

  define('ctzn.network/methods/community-invite-member', async (auth, {invitedDbId}) => {
    // TODO get db
    await assertUserPermission(db, auth.dbKey, 'ctzn.network/perm-community-invite')
  
    const invitedUserInfo = resolveDbId(invitedDbId)
    const existingInviteRecord = await db.invites.get(invitedUserInfo.dbKey)
    if (existingInviteRecord) {
      return {
        key: invitedUserInfo.dbKey,
        dbUrl: db.invites.constructEntryUrl(invitedUserInfo.dbKey)
      }
    }
    await db.invites.put(invitedUserInfo.dbKey, {
      invitedUser: {dbKey: invitedUserInfo.dbKey},
      createdBy: {dbKey: auth.dbKey},
      createdAt: (new Date()).toISOString()
    })
  
    return {
      key: invitedUserInfo.dbKey,
      dbUrl: db.invites.constructEntryUrl(invitedUserInfo.dbKey)
    }
  })

  define('ctzn.network/methods/community-join', async (auth, {communityDbId}) => {
    if (!auth) throw new errors.SessionError()

    const publicCitizenDb = publicDbs.get(auth.username)
    if (!publicCitizenDb) throw new errors.NotFoundError('User database not found')

    const communityInfo = resolveDbId(communityDbId)
    const publicCommunityDb = publicDbs.get(communityInfo.dbKey)
    if (!publicCommunityDb || !publicCommunityDb.writable) {
      throw new Error('todo')
      /* TODO
      // remote join
      const ws = await connectWs(parseUserId(communityInfo.userId).domain)
      const remoteJoinOpts = {
        communityId,
        user: {userId: auth.dbKey, dbUrl: publicCitizenDb.url}
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
          dbUrl: constructEntryUrl(publicCitizenDb.url, 'ctzn.network/community-membership', communityInfo.userId)
        },
        memberRecord: remoteJoinRes.memberRecord
      }*/
    } else {
      // local join

      // check for a ban
      const ban = await publicCommunityDb.bans.get(auth.dbKey)
      if (ban) {
        throw new errors.PermissionsError(`You have been banned from this community. ${ban.value.reason ? `Reason: ${ban.value.reason}` : ''}`)
      }

      // check for invites if it's a closed community
      const configEntry = await publicCommunityDb.communityConfig.get('self')
      if (configEntry?.value?.joinMode === 'closed') {
        const inviteEntry = await publicCommunityDb.invites.get(auth.dbKey)
        if (!inviteEntry) {
          throw new errors.PermissionsError(`You must be invited to join this community.`)
        }
      }

      // create member and membership records
      const joinDate = (new Date()).toISOString()
      const membershipValue = {community: {dbKey: communityInfo.dbKey}, joinDate}
      const memberValue = {user: {dbKey: auth.dbKey}, joinDate}

      // validate before writing to avoid partial transactions
      publicCitizenDb.memberships.schema.assertValid(membershipValue)
      publicCommunityDb.members.schema.assertValid(memberValue)

      await publicCitizenDb.memberships.put(communityInfo.dbKey, membershipValue)
      await publicCommunityDb.members.put(auth.dbKey, memberValue)
      /* dont await */ catchupIndexes(publicCommunityDb)
      
      return {
        membershipRecord: {
          key: communityInfo.dbKey,
          dbUrl: constructEntryUrl(publicCitizenDb.url, 'ctzn.network/community-membership', communityInfo.dbKey)
        },
        memberRecord: {
          key: auth.dbKey,
          dbUrl: constructEntryUrl(publicCommunityDb.url, 'ctzn.network/community-member', auth.dbKey)
        }
      }
    }
  })

  define('ctzn.network/methods/community-leave', async (auth, {communityDbId}) => {
    if (!auth) throw new errors.SessionError()

    const publicCitizenDb = publicDbs.get(auth.dbKey)
    if (!publicCitizenDb) throw new errors.NotFoundError('User database not found')
    
    const communityInfo = resolveDbId(communityDbId)
    const publicCommunityDb = publicDbs.get(communityInfo.dbKey)
    if (!publicCommunityDb || !publicCommunityDb.writable) {
      throw 'todo'
      /* TODO
      // remote leave
      const ws = await connectWs(parseUserId(communityInfo.userId).domain)
      const remoteLeaveOpts = {
        communityId,
        user: {userId: auth.dbKey, dbUrl: publicCitizenDb.url}
      }
      await ws.call('communities.remoteLeave', [remoteLeaveOpts])

      // remote leave succeeded, delete citizen's membership record
      await publicCitizenDb.memberships.del(communityInfo.userId)
      */
    } else {
      // local leave
      const release = await publicCommunityDb.lock('members')
      try {
        await publicCitizenDb.memberships.del(communityInfo.dbKey)
        await publicCommunityDb.members.del(auth.dbKey)
      } finally {
        release()
      }
    }
  })

  define('ctzn.network/methods/community-put-ban', async (auth, {bannedUserDbId, reason}) => {
    // TODO get db
    await assertUserPermission(db, auth.dbKey, 'ctzn.network/perm-community-ban')
  
    const bannedUserInfo = resolveDbId(bannedUserDbId)
    const exstingBanRecord = await db.bans.get(bannedUserInfo.dbKey)
    await db.bans.put(bannedUserInfo.dbKey, {
      bannedUser: {dbKey: bannedUserInfo.dbKey},
      createdBy: {dbKey: auth.dbKey, dbUrl: auth.url},
      reason: reason,
      createdAt: exstingBanRecord?.value?.createdAt || (new Date()).toISOString()
    })
  
    return {
      key: bannedUserInfo.dbKey,
      dbUrl: db.bans.constructEntryUrl(bannedUserInfo.dbKey)
    }
  })

  define('ctzn.network/methods/community-put-role', async (auth, {roleId, permissions}) => {
    if (roleId === 'admin') throw new errors.PermissionsError('Cannot edit the admin role')
    // TODO get db
    await assertUserPermission(db, auth.dbKey, 'ctzn.network/perm-community-manage-roles')
  
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
      dbUrl: db.roles.constructEntryUrl(roleId)
    }
  })

  define('ctzn.network/methods/community-remove-content', async (auth, {contentDbUrl}) => {
    // TODO get db
    const { schemaId } = parseEntryUrl(contentDbUrl)
    if (schemaId === 'ctzn.network/post') {
      await assertUserPermission(db, auth.dbKey, 'ctzn.network/perm-community-remove-post')
      const feedIdxEntry = await publicServerDb.feedIdx.scanFind(addPrefixToRangeOpts(db.dbKey, {reverse: true}), entry => (
        entry.value.item.dbUrl === contentDbUrl
      )).catch(e => undefined)
      if (!feedIdxEntry) {
        throw new Error('Unable to find post in the community feed')
      }
      await publicServerDb.feedIdx.del(feedIdxEntry.key)
    } else if (schemaId === 'ctzn.network/comment') {
      await assertUserPermission(db, auth.dbKey, 'ctzn.network/perm-community-remove-comment')
      const res = await dbGet(contentDbUrl)
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
      if (rootRes.entry?.value?.community?.dbKey !== db.dbKey) {
        throw new Error('Thread is not a part of this community')
      }
      let commentIndex = threadIdxEntry.value.items?.findIndex(c => c.dbUrl === contentDbUrl)
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

  define('ctzn.network/methods/community-remove-member', async (auth, {memberDbId, ban, banReason}) => {
    // TODO get db
    await assertUserPermission(db, auth.dbKey, 'ctzn.network/perm-community-ban')
    let memberInfo = resolveDbId(memberDbId)
  
    // (optionally) create ban record
    if (ban) {
      await db.bans.put(memberInfo.dbKey, {
        bannedUser: {dbKey: memberInfo.dbKey},
        createdBy: {dbKey: auth.dbKey},
        reason: banReason,
        createdAt: (new Date()).toISOString()
      })
    }
  
    const release = await db.lock('members')
    try {
      // delete member record
      await db.members.del(memberInfo.dbKey)
    } finally {
      release()
    }
  
    return {
      banRecord: ban ? {
        key: memberInfo.dbKey,
        dbUrl: db.bans.constructEntryUrl(memberInfo.dbKey)
      } : undefined
    }
  })

  define('ctzn.network/methods/community-set-member-roles', async (auth, {memberDbId, roles}) => {
    // TODO get db
    await assertUserPermission(db, auth.dbKey, 'ctzn.network/perm-community-assign-roles')
    let memberInfo = resolveDbId(memberDbId)

    const release = await db.lock('members')
    try {
      let memberRecord = await db.members.get(memberInfo.dbKey)
      if (!memberRecord) throw new Error(`${memberInfo.dbKey} is not a member of this group`)
      memberRecord.value.roles = roles || []
      await db.members.put(memberInfo.dbKey, memberRecord.value)
    } finally {
      release()
    }

    return {
      key: memberInfo.dbKey,
      dbUrl: db.members.constructEntryUrl(memberInfo.dbKey)
    }
  })

  define('ctzn.network/methods/community-update-config', async (auth, args) => {
    // TODO get db
    await assertUserPermission(db, auth.dbKey, 'ctzn.network/perm-community-update-config')
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