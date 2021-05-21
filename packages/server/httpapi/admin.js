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
      dbKey: db.key.toString('hex'),
      dbDkey: db.discoveryKey.toString('hex'),
      username: db.username,
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
    let targetDb = db.publicDbs.get(req.body.dbKey)
    if (!targetDb && req.body.dbKey === db.publicServerDb.dbKey) {
      targetDb = db.publicServerDb
    }
    if (!targetDb) {
      console.error('Unable to rebuild indexes for', req.body.dbKey, '- database not found')
      return res.status(404).json({error: true, message: 'Database not found'})
    }
    if (!targetDb.writable) {
      console.error('Unable to rebuild indexes for', req.body.dbKey, '- database not writable')
      return res.status(400).json({error: true, message: 'Database not writable'})
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
        const publicDb = db.publicDbs.get(userRecord.key)
        const profile = publicDb ? await publicDb.profile.get('self') : undefined
        return {
          dbKey: publicDb?.key?.toString('hex'),
          dbDkey: publicDb?.discoveryKey?.toString('hex'),
          username: userRecord.key,
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
      const publicDb = db.publicDbs.get(userRecord.key)
      const profile = publicDb ? await publicDb.profile.get('self') : undefined
      res.status(200).json({
        dbKey: publicDb.key.toString('hex'),
        dbDkey: publicDb.discoveryKey.toString('hex'),
        username: userRecord.key,
        type: userRecord.value.type,
        profile: profile?.value
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
