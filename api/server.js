import * as db from '../db/index.js'
import * as issues from '../lib/issues.js'
import { constructUserId } from '../lib/strings.js'

export function setup (wsServer) {
  wsServer.registerLoopback('server.listDatabases', async ([]) => {
    return (
      [db.publicServerDb, db.privateServerDb]
      .concat(Array.from(db.publicUserDbs.values()))
      .concat(Array.from(db.privateUserDbs.values()))
    ).map(db => ({
      dbType: db.dbType,
      writable: db.writable,
      key: db.key.toString('hex'),
      userId: db.userId,
      isPrivate: db.isPrivate,
      peerCount: db.peers?.length || 0,
      blobs: db.blobs.feed ? {
        key: db.blobs.feed.key.toString('hex'),
        writable: db.blobs.writable,
        isPrivate: db.blobs.isPrivate,
        peerCount: db.blobs.peers?.length || 0
      } : undefined
    }))
  })

  wsServer.registerLoopback('server.listIssues', () => {
    return Object.entries(issues.getAll()).map(([id, entries]) => {
      return {
        id,
        entries: entries.map(entry => ({
          description: entry.description,
          cause: entry.cause,
          error: entry.error,
          canRecover: entry.canRecover
        }))
      }
    })
  })

  wsServer.registerLoopback('server.recoverIssue', ([issueId]) => {
    return issues.recover(issueId)
  })

  wsServer.registerLoopback('server.dismissIssue', ([issueId, opts]) => {
    return issues.dismiss(issueId, opts)
  })

  wsServer.registerLoopback('server.listAccounts', async ([]) => {
    let userRecords = await db.publicServerDb.users.list()
    return await Promise.all(userRecords.map(async userRecord => {
      const userId = constructUserId(userRecord.key)
      const publicUserDb = db.publicUserDbs.get(userId)
      const profile = publicUserDb ? await publicUserDb.profile.get('self') : undefined
      return {
        userId,
        type: userRecord.value.type,
        displayName: profile?.value?.displayName || ''
      }
    }))
  })

  wsServer.registerLoopback('server.listCommunities', async ([]) => {
    let communityDbs = Array.from(db.publicUserDbs.values()).filter(db => db.dbType === 'ctzn.network/public-community-db')
    return Promise.all(communityDbs.map(async db => {
      let profile = await db.profile.get('self')
      let members = await db.members.list()
      return {
        userId: db.userId,
        displayName: profile?.value?.displayName || '',
        numMembers: members?.length,
        admins: members?.filter(m => m.value.roles?.includes('admin')).map(m => m.value.user.userId)
      }
    }))
  })

  wsServer.registerLoopback('server.addCommunityAdmin', async ([communityUserId, adminUserId]) => {
    await updateCommunityMemberRole(communityUserId, adminUserId, memberRecordValue => {
      memberRecordValue.roles = memberRecordValue.roles || []
      if (!memberRecordValue.roles.includes('admin')) {
        memberRecordValue.roles.push('admin')
      }
    })
  })

  wsServer.registerLoopback('server.removeCommunityAdmin', async ([communityUserId, adminUserId]) => {
    await updateCommunityMemberRole(communityUserId, adminUserId, memberRecordValue => {
      memberRecordValue.roles = memberRecordValue.roles || []
      if (memberRecordValue.roles.includes('admin')) {
        memberRecordValue.roles = memberRecordValue.roles.filter(r => r !== 'admin')
      }
    })
  })

  wsServer.registerLoopback('server.removeUser', async ([username]) => {
    await db.deleteUser(username)
  })
}

async function updateCommunityMemberRole (communityUserId, memberUserId, fn) {
  const publicCommunityDb = db.publicUserDbs.get(communityUserId)
  const publicCitizenDb = db.publicUserDbs.get(memberUserId)

  if (!publicCommunityDb) throw new Error('Community DB not found')
  if (!publicCitizenDb) throw new Error('Citizen DB not found')

  let memberRecord = await publicCommunityDb.members.get(memberUserId)
  if (!memberRecord) {
    // create member and membership records
    const joinDate = (new Date()).toISOString()
    const membershipValue = {community: {userId: communityUserId, dbUrl: publicCommunityDb.url}, joinDate}
    const memberValue = {user: {userId: memberUserId, dbUrl: publicCitizenDb.url}, joinDate}

    fn(memberValue)

    // validate before writing to avoid partial transactions
    publicCitizenDb.memberships.schema.assertValid(membershipValue)
    publicCommunityDb.members.schema.assertValid(memberValue)

    await publicCitizenDb.memberships.put(communityUserId, membershipValue)
    await publicCommunityDb.members.put(memberUserId, memberValue)
  } else {
    // update existing record
    fn(memberRecord.value)
    await publicCommunityDb.members.put(memberUserId, memberRecord.value)
  }
}