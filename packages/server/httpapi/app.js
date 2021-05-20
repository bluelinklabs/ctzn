import pump from 'pump'
import { debugLog } from '../lib/debug-log.js'
import * as methods from '../methods/index.js'
import * as dbViews from '../db/views.js'
import { getDomain } from '../lib/strings.js'
import { publicServerDb, publicDbs, onDatabaseChange } from '../db/index.js'
import { constructEntryUrl } from '../lib/strings.js'
import * as errors from '../lib/errors.js'
import * as metrics from '../lib/metrics.js'
import * as cache from '../lib/cache.js'

export function setup (app, config) {
  app.get('/_api/table/:username([^\/]{3,})/:schemaNs/:schemaName', async (req, res) => {
    try {
      debugLog.httpCall('table.list', req.ip, req.params, req.query)
      const db = getDb(req.params.username)
      const schemaId = `${req.params.schemaNs}/${req.params.schemaName}`
      const table = db.tables[schemaId]
      if (!table) throw new Error('Table not found')
      const entries = await table.list(getListOpts(req))
      for (let entry of entries) {
        entry.url = table.constructEntryUrl(entry.key)
      }
      res.setHeader('Content-Security-Policy', `default-src 'none'; sandbox;`)
      res.status(200).json({entries})
    } catch (e) {
      error(res, e, config)
    }
  })

  app.get('/_api/table/:username([^\/]{3,})/:schemaNs/:schemaName/:key', async (req, res) => {
    try {
      debugLog.httpCall('table.get', req.ip, req.params, req.query)
      const db = getDb(req.params.username)
      const table = db.tables[`${req.params.schemaNs}/${req.params.schemaName}`]
      if (!table) throw new Error('Table not found')
      const entry = await table.get(req.params.key)
      if (entry) {
        entry.url = table.constructEntryUrl(entry.key)
      }
      res.setHeader('Content-Security-Policy', `default-src 'none'; sandbox;`)
      res.status(200).json(entry)
    } catch (e) {
      error(res, e, config)
    }
  })

  app.post('/_api/table/:username([^\/]{3,})/:schemaNs/:schemaName', async (req, res) => {
    try {
      debugLog.httpCall('table.create', req.ip, req.params, req.query)
      const db = getDb(req.params.username)
      const schemaId = `${req.params.schemaNs}/${req.params.schemaName}`
      const table = db.tables[schemaId]
      const value = req.body

      if (req.session.auth?.username !== req.params.username) {
        throw new errors.PermissionsError()
      }
      // TODO blobs

      const key = table.schema.generateKey(value)
      if (!value?.createdAt && table.schema.hasCreatedAt) {
        value.createdAt = (new Date()).toISOString()
      }
      await table.put(key, value)
      await onDatabaseChange(db)

      if (schemaId === 'ctzn.network/post') {
        metrics.postCreated({user: req.session.auth.username})
      } else if (schemaId === 'ctzn.network/comment') {
        metrics.commentCreated({user: req.session.auth.username})
      }
      cache.onDatabaseChange(req.session.auth.username, schemaId)

      const dbUrl = constructEntryUrl(db.url, schemaId, key)
      res.status(200).json({key, dbUrl})
    } catch (e) {
      error(res, e, config)
    }
  })

  app.put('/_api/table/:username([^\/]{3,})/:schemaNs/:schemaName/:key', async (req, res) => {
    try {
      debugLog.httpCall('table.update', req.ip, req.params, req.query)
      const db = getDb(req.params.username)
      const schemaId = `${req.params.schemaNs}/${req.params.schemaName}`
      const key = req.params.key
      const table = db.tables[schemaId]
      const value = req.body

      if (req.session.auth?.username !== req.params.username) {
        throw new errors.PermissionsError()
      }
      // TODO blobs
      
      const release = await table.lock(key)
      try {
        const entry = await table.get(key)
        if (!entry) {
          throw new errors.NotFoundError()
        }
        
        await table.put(key, value)
        await onDatabaseChange(db)
        cache.onDatabaseChange(req.session.auth.username, schemaId)

        const dbUrl = constructEntryUrl(db.url, schemaId, key)
        res.status(200).json({key, dbUrl})
      } finally {
        release()
      }
    } catch (e) {
      error(res, e, config)
    }
  })

  app.delete('/_api/table/:username([^\/]{3,})/:schemaNs/:schemaName/:key', async (req, res) => {
    try {
      debugLog.httpCall('table.delete', req.ip, req.params, req.query)
      const db = getDb(req.params.username)
      const schemaId = `${req.params.schemaNs}/${req.params.schemaName}`
      const key = req.params.key
      const table = db.tables[schemaId]

      if (req.session.auth?.username !== req.params.username) {
        throw new errors.PermissionsError()
      }

      const release = await table.lock(key)
      try {
        await table.del(key)
        await onDatabaseChange(db)
        cache.onDatabaseChange(req.session.auth.username, schemaId)
        res.status(200).json({})
      } finally {
        release()
      }
    } catch (e) {
      error(res, e, config)
    }
  })

  app.get('/_api/view/:schemaNs/views/:schemaName', async (req, res) => {
    try {
      debugLog.httpCall('view.get', req.ip, req.params, req.query)
      const schemaId = `${req.params.schemaNs}/views/${req.params.schemaName}`
      const args = getQuery(req)
      if (dbViews.getType(schemaId) === 'blob-view') {
        const {etag, createStream, mimeType} = await dbViews.exec(schemaId, undefined, args)
          if (req.headers['if-none-match'] === etag) {
          return res.status(304).end()
        }
        res.setHeader('ETag', etag)
        if (mimeType) res.setHeader('Content-Type', mimeType)
        res.setHeader('Content-Security-Policy', `default-src 'none'; sandbox;`)
        pump(await createStream(), res, () => res.end())
      } else {
        res.setHeader('Content-Security-Policy', `default-src 'none'; sandbox;`)
        res.status(200).json(await dbViews.exec(schemaId, undefined, args))
      }
    } catch (e) {
      error(res, e, config)
    }
  })

  app.post('/_api/method/:schemaNs/methods/:schemaName', async (req, res) => {
    debugLog.httpCall('method.call', req.ip, req.params, req.query)
    const schemaId = `${req.params.schemaNs}/methods/${req.params.schemaName}`
    try {
      const auth = req.session.auth
      const methodres = await methods.exec(schemaId, auth, req.body, req, res)
      res.status(200).json(methodres || {})
    } catch (e) {
      error(res, e, config)
    }
  })
}

function error (res, e, config) {
  let status = 400
  if (e.code === 'not-found') status = 404
  let message = e.message || e.toString()
  if (config.debugMode) message += `\n${e.stack}`
  res.status(status).json({
    error: true,
    code: e.code || 'error',
    message
  })
}

function getQuery (req) {
  const query = req.query
  for (let k in query) {
    if (query[k] === 'true') {
      query[k] = true
    } else if (query[k] === 'false') {
      query[k] = false
    } else if (/^[\d\.]+$/.test(query[k])) {
      query[k] = Number(query[k])
    }
  }
  return query
}

function getListOpts (req) {
  const opts = {}
  if (req.query.limit) opts.limit = Number(req.query.limit)
  if (req.query.lt) opts.lt = req.query.lt
  if (req.query.lte) opts.lte = req.query.lte
  if (req.query.gt) opts.gt = req.query.gt
  if (req.query.gte) opts.gte = req.query.gte
  if (req.query.reverse) opts.reverse = true
  return opts
}

function getDb (dbId) {
  if (dbId === 'server' || dbId === publicServerDb.dbKey) {
    return publicServerDb
  }
  const publicDb = publicDbs.get(dbId)
  if (!publicDb) throw new Error('User database not found')
  return publicDb
}