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

export function setup (app) {
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

  app.post('_api/admin/toggle-profiling-cpu', async (req, res) => {
    if (_inspectorSession) {
      try {
        await stopProfilingCPU()
        res.status(200).json({isActive: false})
      } catch (e) {
        res.status(500).json({
          error: true,
          message: e.message || e.toString()
        })
      }
    } else {
      _inspectorSession = new inspector.Session()
      _inspectorSession.connect()
      _inspectorSession.post('Profiler.enable', () => {
        _inspectorSession.post('Profiler.start', () => {
          console.log('Started CPU profiler')
          _inspectorTimeout = setTimeout(stopProfilingCPU, 120e3)
          res.status(200).json({isActive: true})
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

  app.get('_api/admin/database-info', async (req, res) => {
    const thisDb = db.getDbByDkey(req.query.dkey)
    if (!thisDb) return res.status(404).json({error: true, message: 'Database not found'})
    try {
      const info = await getDbInfo(thisDb, true)
      res.status(200).json(info)
    } catch (e) {
      res.status(500).json({error: true, message: e.message || e.toString()})
    }
  })

  app.get('_api/admin/databases', async (req, res) => {
    try {
      const databases = await Promise.all((
        Array.from(db.publicDbs.values()).concat(Array.from(db.privateDbs.values()))
      ).map(db => getDbInfo(db)))
      res.status(200).json({databases})
    } catch (e) {
      res.status(500).json({error: true, message: e.message || e.toString()})
    }
  })

  app.get('_api/admin/bee-shallow-list', async (req, res) => {
    const thisDb = db.getDbByDkey(req.query.dkey)
    if (!thisDb) return res.status(404).json({error: true, message: 'Database not found'})
    try {
      await thisDb.touch()
      const rows = await beeShallowList(thisDb.bee, req.query.path)
      res.status(200).json({rows})
    } catch (e) {
      res.status(500).json({error: true, message: e.message || e.toString()})
    }
  })

  app.get('_api/admin/hyperspace-log', async (req, res) => {
    try {
      const hasKeys = Object.keys(req.query).length > 0
      const entries = await hyperspaceLog.query(entry => {
        if (hasKeys) {
          for (let k in req.query) {
            if (entry[k] !== req.query[k]) {
              return false
            }
          }
        }
        return true
      })
      res.status(200).json({entries})
    } catch (e) {
      res.status(500).json({error: true, message: e.message || e.toString()})
    }
  })

  app.post('_api/admin/rebuild-database-indexes', async (req, res) => {
    let targetDb = db.publicDbs.get(req.body.userId)
    if (!targetDb && req.body.userId === db.publicServerDb.userId) {
      targetDb = db.publicServerDb
    }
    if (!targetDb) {
      console.error('Unable to rebuild indexes for', req.body.userId, '- database not found')
      return res.status(404).json({error: true, message: 'Database not found'})
    }
    try {
      await targetDb.rebuildIndexes(req.body.indexIds)
      res.status(200).json({})
    } catch (e) {
      res.status(500).json({error: true, message: e.message || e.toString()})
    }
  })
  
  app.get('_api/admin/issues', (req, res) => {
    try {
      const issuesListing = Object.entries(issues.getAll()).map(([id, entries]) => {
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
      res.status(200).json({issues: issuesListing})
    } catch (e) {
      res.status(500).json({error: true, message: e.message || e.toString()})
    }
  })

  app.post('_api/admin/recover-issue', async (req, res) => {
    try {
      const result = await issues.recover(req.body.issueId)
      res.status(200).json({result})
    } catch (e) {
      res.status(500).json({error: true, message: e.message || e.toString()})
    }
  })

  app.post('_api/admin/dismiss-issue', (req, res) => {
    issues.dismiss(req.body.issueId, req.body.opts)
    res.status(200).json({})
  })

  app.get('_api/admin/accounts', async (req, res) => {
    try {
      const userRecords = await db.publicServerDb.users.list()
      const fullUserRecords = await Promise.all(userRecords.map(async userRecord => {
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
      res.status(200).json({accounts: fullUserRecords})
    } catch (e) {
      res.status(500).json({error: true, message: e.message || e.toString()})
    }
  })

  app.get('_api/admin/account', async (req, res) => {
    try {
      let userRecord = await db.publicServerDb.users.get(req.query.username)
      const userId = constructUserId(userRecord.key)
      const publicDb = db.publicDbs.get(userId)
      const profile = publicDb ? await publicDb.profile.get('self') : undefined
      let members
      if (userRecord.value.type === 'community') {
        members = await publicDb.members.list()
      }
      res.status(200).json({
        key: publicDb.key.toString('hex'),
        dkey: publicDb.discoveryKey.toString('hex'),
        username: userRecord.key,
        userId,
        type: userRecord.value.type,
        profile: profile?.value,
        members
      })
    } catch (e) {
      res.status(500).json({error: true, message: e.message || e.toString()})      
    }
  })

  app.get('_api/admin/communities', async (req, res) => {
    try {
      let communityDbs = Array.from(db.publicDbs.values()).filter(db => db.dbType === 'ctzn.network/public-community-db')
      const communities = await Promise.all(communityDbs.map(async db => {
        let profile = await db.profile.get('self')
        let members = await db.members.list()
        return {
          userId: db.userId,
          displayName: profile?.value?.displayName || '',
          numMembers: members?.length,
          admins: members?.filter(m => m.value.roles?.includes('admin')).map(m => m.value.user.userId)
        }
      }))
      res.status(200).json({communities})
    } catch (e) {
      res.status(500).json({error: true, message: e.message || e.toString()})     
    }
  })

  app.post('_api/admin/add-community-admin', async (req, res) => {
    try {
      await updateCommunityMemberRole(req.body.communityUserId, req.body.adminUserId, memberRecordValue => {
        memberRecordValue.roles = memberRecordValue.roles || []
        if (!memberRecordValue.roles.includes('admin')) {
          memberRecordValue.roles.push('admin')
        }
      })
      res.status(200).json({})
    } catch (e) {
      res.status(500).json({error: true, message: e.message || e.toString()})
    }
  })

  app.post('_api/admin/remove-community-admin', async (req, res) => {
    try {
      await updateCommunityMemberRole(req.body.communityUserId, req.body.adminUserId, memberRecordValue => {
        memberRecordValue.roles = memberRecordValue.roles || []
        if (memberRecordValue.roles.includes('admin')) {
          memberRecordValue.roles = memberRecordValue.roles.filter(r => r !== 'admin')
        }
      })
    } catch (e) {
      res.status(500).json({error: true, message: e.message || e.toString()})
    }
  })

  app.post('_api/admin/remove-user', async (req, res) => {
    try {
      await db.deleteUser(req.body.username)
      res.status(200).json({})
    } catch (e) {
      res.status(500).json({error: true, message: e.message || e.toString()})
    }
  })

  app.get('_api/admin/metrics-events', async (req, res) => {
    try {
      const events = await metrics.listEvents(req.query)
      res.status(200).json({events})
    } catch (e) {
      res.status(500).json({error: true, message: e.message || e.toString()})
    }
  })

  app.get('_api/admin/metrics-events-counts', async (req, res) => {
    try {
      const counts = await metrics.countEvents(req.query)
      res.status(200).json({counts})
    } catch (e) {
      res.status(500).json({error: true, message: e.message || e.toString()})
    }
  })

  app.get('_api/admin/multiple-metrics-events-counts', async (req, res) => {
    try {
      const count = await metrics.countMultipleEvents(req.query)
      res.status(200).json({count})
    } catch (e) {
      res.status(500).json({error: true, message: e.message || e.toString()})
    }
  })

  app.get('_api/admin/multiple-metrics-events-counts-over-time', async (req, res) => {
    try {
      const counts = await metrics.countMultipleEventsOverTime(req.query)
      res.status(200).json({counts})
    } catch (e) {
      res.status(500).json({error: true, message: e.message || e.toString()})
    }
  })

  app.get('_api/admin/aggregate-http-hits', async (req, res) => {
    try {
      const hits = await metrics.aggregateHttpHits(req.query)
      res.status(200).json({hits})
    } catch (e) {
      res.status(500).json({error: true, message: e.message || e.toString()})
    }
  })

  app.get('_api/admin/users-count', async (req, res) => {
    try {
      let userRecords = await db.publicServerDb.users.list()
      const count = userRecords.filter(u => u.value.type === 'citizen').length
      res.status(200).json({count})
    } catch (e) {
      res.status(500).json({error: true, message: e.message || e.toString()})
    }
  })

  app.get('_api/admin/is-debugger-enabled', (req, res) => {
    res.status(200).json({isEnabled: debugLog.debugLog.isEnabled()})
  })
  
  app.post('_api/admin/enable-debugger', (req, res) => {
    debugLog.debugLog.enable()
    res.status(200).json({})
  })
  
  app.post('_api/admin/disable-debugger', (req, res) => {
    debugLog.debugLog.disable()
    res.status(200).json({})
  })

  app.post('_api/admin/clear-debugger-log',  (req, res) => {
    debugLog.reset()
    res.status(200).json({})
  })

  app.get('_api/admin/debug-log', (req, res) => {
    res.status(200).json({log: debugLog.fetchAndClear()})
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