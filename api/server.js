import os from 'os'
import path from 'path'
import inspector from 'inspector'
import { promises as fsp } from 'fs'
import * as db from '../db/index.js'
import * as issues from '../lib/issues.js'
import { constructUserId } from '../lib/strings.js'

let _inspectorSession
let _inspectorTimeout

export function setup (wsServer) {
  const stopProfilingCPU = () =>new Promise((resolve, reject) => {
    console.log('Stopping CPU profiler')
    clearTimeout(_inspectorTimeout)
    _inspectorSession.post('Profiler.stop', async (err, res) => {
      _inspectorSession.disconnect()
      _inspectorSession = undefined
      if (err) {
        console.error('Stopping CPU profiler failed', err)
        reject(err)
      } else {
        await fsp.writeFile(path.join(os.homedir(), 'ctzn.cpuprofile'), JSON.stringify(res.profile));
        console.log('Wrote CPU profile to ~/ctzn.cpuprofile')
        resolve({isActive: false})
      }
    });
  })

  wsServer.registerLoopback('server.toggleProfilingCPU', async ([]) => {
    if (_inspectorSession) {
      return stopProfilingCPU()
    } else {
      _inspectorSession = new inspector.Session()
      _inspectorSession.connect()
      return new Promise(resolve => {
        _inspectorSession.post('Profiler.enable', () => {
          _inspectorSession.post('Profiler.start', () => {
            console.log('Started CPU profiler')
            _inspectorTimeout = setTimeout(stopProfilingCPU, 120e3)
            resolve({isActive: true})
          })
        })
      })
    }
  })

  wsServer.registerLoopback('server.listDatabases', async ([]) => {
    return (
      [db.publicServerDb, db.privateServerDb]
      .concat(Array.from(db.publicDbs.values()))
      .concat(Array.from(db.privateDbs.values()))
    ).map(db => ({
      dbType: db.dbType,
      writable: db.writable,
      key: db.key.toString('hex'),
      userId: db.userId,
      isPrivate: db.isPrivate,
      peerCount: db.peers?.length || 0,
      indexers: db.indexers?.map(i => i.schemaId) || [],
      blobs: db.blobs.feed ? {
        key: db.blobs.feed.key.toString('hex'),
        writable: db.blobs.writable,
        isPrivate: db.blobs.isPrivate,
        peerCount: db.blobs.peers?.length || 0
      } : undefined
    }))
  })

  wsServer.registerLoopback('server.rebuildDatabaseIndexes', async ([userId, indexIds]) => {
    let targetDb = db.publicDbs.get(userId)
    if (!targetDb && userId === db.publicServerDb.userId) {
      targetDb = db.publicServerDb
    }
    if (!targetDb) {
      console.error('Unable to rebuild indexes for', userId, '- database not found')
      return []
    }
    return targetDb.rebuildIndexes(indexIds)
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
      const publicDb = db.publicDbs.get(userId)
      const profile = publicDb ? await publicDb.profile.get('self') : undefined
      return {
        userId,
        type: userRecord.value.type,
        displayName: profile?.value?.displayName || ''
      }
    }))
  })

  wsServer.registerLoopback('server.listCommunities', async ([]) => {
    let communityDbs = Array.from(db.publicDbs.values()).filter(db => db.dbType === 'ctzn.network/public-community-db')
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
  const publicCommunityDb = db.publicDbs.get(communityUserId)
  const publicCitizenDb = db.publicDbs.get(memberUserId)

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