import os from 'os'
import path from 'path'
import inspector from 'inspector'
import { promises as fsp } from 'fs'
import * as db from '../db/index.js'
import { log as hyperspaceLog } from '../db/hyperspace.js'
import { beeShallowList } from '../db/util.js'
import * as diskusage from '../db/diskusage-tracker.js'
import * as issues from '../lib/issues.js'
import * as metrics from '../lib/metrics.js'
import * as debugLog from '../lib/debug-log.js'
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

  wsServer.registerAdminOnly('server.toggleProfilingCPU', async ([]) => {
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

  function getDbInfo (db, all = false) {
    return {
      dbType: db.dbType,
      writable: db.writable,
      key: db.key.toString('hex'),
      dkey: db.discoveryKey.toString('hex'),
      userId: db.userId,
      isPrivate: db.isPrivate,
      peerCount: db.peers?.length || 0,
      peers: all ? db.peers : undefined,
      indexers: db.indexers?.map(i => i.schemaId) || [],
      diskusage: diskusage.get(db.discoveryKey.toString('hex')),
      blobs: db.blobs.feedInfo ? {
        key: db.blobs.key.toString('hex'),
        dkey: db.blobs.discoveryKey.toString('hex'),
        writable: db.blobs.writable,
        isPrivate: db.blobs.isPrivate,
        peerCount: db.blobs.peers?.length || 0,
        peers: all ? db.blobs.peers : undefined,
        diskusage: diskusage.get(db.blobs.discoveryKey.toString('hex'))
      } : undefined
    }
  }

  wsServer.registerAdminOnly('server.getDatabaseInfo', async ([dkey]) => {
    const thisDb = db.getDbByDkey(dkey)
    if (!thisDb) throw new Error('Database not found')
    return getDbInfo(thisDb, true)
  })

  wsServer.registerAdminOnly('server.listDatabases', async ([]) => {
    return (
      Array.from(db.publicDbs.values()).concat(Array.from(db.privateDbs.values()))
    ).map(db => getDbInfo(db))
  })

  wsServer.registerAdminOnly('server.beeShallowList', async ([dkey, path]) => {
    const thisDb = db.getDbByDkey(dkey)
    if (!thisDb) throw new Error('Database not found')
    await thisDb.touch()
    return beeShallowList(thisDb.bee, path)
  })

  wsServer.registerAdminOnly('server.queryHyperspaceLog', async ([query]) => {
    return hyperspaceLog.query(entry => {
      if (query) {
        for (let k in query) {
          if (entry[k] !== query[k]) {
            return false
          }
        }
      }
      return true
    })
  })

  wsServer.registerAdminOnly('server.rebuildDatabaseIndexes', async ([userId, indexIds]) => {
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
  
  wsServer.registerAdminOnly('server.listIssues', () => {
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

  wsServer.registerAdminOnly('server.recoverIssue', ([issueId]) => {
    return issues.recover(issueId)
  })

  wsServer.registerAdminOnly('server.dismissIssue', ([issueId, opts]) => {
    return issues.dismiss(issueId, opts)
  })

  wsServer.registerAdminOnly('server.listAccounts', async ([]) => {
    let userRecords = await db.publicServerDb.users.list()
    return await Promise.all(userRecords.map(async userRecord => {
      if (!userRecord) return {}
      const userId = constructUserId(userRecord.key)
      const publicDb = db.publicDbs.get(userId)
      const profile = publicDb ? await publicDb.profile.get('self') : undefined
      return {
        key: publicDb?.key?.toString('hex'),
        dkey: publicDb?.discoveryKey?.toString('hex'),
        username: userRecord.key,
        userId,
        type: userRecord.value.type,
        displayName: profile?.value?.displayName || ''
      }
    }))
  })

  wsServer.registerAdminOnly('server.getAccount', async ([username]) => {
    let userRecord = await db.publicServerDb.users.get(username)
    const userId = constructUserId(userRecord.key)
    const publicDb = db.publicDbs.get(userId)
    const profile = publicDb ? await publicDb.profile.get('self') : undefined
    let members
    if (userRecord.value.type === 'community') {
      members = await publicDb.members.list()
    }
    return {
      key: publicDb.key.toString('hex'),
      dkey: publicDb.discoveryKey.toString('hex'),
      username: userRecord.key,
      userId,
      type: userRecord.value.type,
      profile: profile?.value,
      members
    }
  })

  wsServer.registerAdminOnly('server.listCommunities', async ([]) => {
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

  wsServer.registerAdminOnly('server.addCommunityAdmin', async ([communityUserId, adminUserId]) => {
    await updateCommunityMemberRole(communityUserId, adminUserId, memberRecordValue => {
      memberRecordValue.roles = memberRecordValue.roles || []
      if (!memberRecordValue.roles.includes('admin')) {
        memberRecordValue.roles.push('admin')
      }
    })
  })

  wsServer.registerAdminOnly('server.removeCommunityAdmin', async ([communityUserId, adminUserId]) => {
    await updateCommunityMemberRole(communityUserId, adminUserId, memberRecordValue => {
      memberRecordValue.roles = memberRecordValue.roles || []
      if (memberRecordValue.roles.includes('admin')) {
        memberRecordValue.roles = memberRecordValue.roles.filter(r => r !== 'admin')
      }
    })
  })

  wsServer.registerAdminOnly('server.removeUser', async ([username]) => {
    await db.deleteUser(username)
  })

  wsServer.registerAdminOnly('server.listMetricsEvents', async ([opts]) => {
    return metrics.listEvents(opts)
  })

  wsServer.registerAdminOnly('server.countMetricsEvents', async ([opts]) => {
    return metrics.countEvents(opts)
  })

  wsServer.registerAdminOnly('server.countMultipleMetricsEvents', async ([opts]) => {
    return metrics.countMultipleEvents(opts)
  })

  wsServer.registerAdminOnly('server.countMultipleMetricsEventsOverTime', async ([opts]) => {
    return metrics.countMultipleEventsOverTime(opts)
  })

  wsServer.registerAdminOnly('server.aggregateHttpHits', async ([opts]) => {
    return metrics.aggregateHttpHits(opts)
  })

  wsServer.registerAdminOnly('server.countUsers', async ([]) => {
    let userRecords = await db.publicServerDb.users.list()
    return userRecords.filter(u => u.value.type === 'citizen').length
  })

  wsServer.registerAdminOnly('server.isDebuggerEnabled', async ([]) => {
    return debugLog.debugLog.isEnabled()
  })
  
  wsServer.registerAdminOnly('server.setDebuggerEnabled', async ([b]) => {
    if (b) {
      return debugLog.debugLog.enable()
    } else {
      return debugLog.debugLog.disable()
    }
  })

  wsServer.registerAdminOnly('server.clearDebuggerLog', async ([b]) => {
    return debugLog.reset()
  })

  wsServer.registerAdminOnly('server.fetchAndClearDebugLog', async ([]) => {
    return debugLog.fetchAndClear()
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