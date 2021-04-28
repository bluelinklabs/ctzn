import { RateLimiter } from 'pauls-sliding-window-rate-limiter'
import * as http from 'http'
import express from 'express'
import { Server as WebSocketServer } from 'rpc-websockets'
import cors from 'cors'
import pump from 'pump'
import { Config } from './lib/config.js'
import * as db from './db/index.js'
import * as dbViews from './db/views.js'
import * as api from './api/index.js'
import * as perf from './lib/perf.js'
import * as metrics from './lib/metrics.js'
import { NoTermsOfServiceIssue } from './lib/issues/no-terms-of-service.js'
import { NoPrivacyPolicyIssue } from './lib/issues/no-privacy-policy.js'
import * as issues from './lib/issues.js'
import * as email from './lib/email.js'
import { debugLog } from './lib/debug-log.js'
import * as path from 'path'
import * as fs from 'fs'
import { fileURLToPath } from 'url'
import * as os from 'os'
import { setOrigin, getDomain, parseAcctUrl, usernameToUserId, DEBUG_MODE_PORTS_MAP } from './lib/strings.js'
import { Liquid } from 'liquidjs'

const INSTALL_PATH = path.dirname(fileURLToPath(import.meta.url))
const PACKAGE_JSON_PATH = path.join(INSTALL_PATH, 'package.json')
const PACKAGE_JSON = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'))

let app

let _serverReadyCb
export const whenServerReady = new Promise(r => {_serverReadyCb = r})

export async function start (opts) {
  opts.configDir = opts.configDir || path.join(os.homedir(), '.ctzn')
  let config = new Config(opts)
  Config.setActiveConfig(config)
  if (config.benchmarkMode) {
    perf.enable()
  }
  metrics.setup({configDir: opts.configDir})
  if (config.debugMode && DEBUG_MODE_PORTS_MAP[config.domain]) {
    config.overrides.port = DEBUG_MODE_PORTS_MAP[config.domain]
  }
  setOrigin(`http://${config.domain || 'localhost'}:${config.port}`)
  const TERMS_OF_SERVICE_PATH = path.join(opts.configDir, 'terms-of-service.txt')
  const PRIVACY_POLICY_PATH = path.join(opts.configDir, 'privacy-policy.txt')

  app = express()
  app.engine('liquid', (new Liquid()).express())
  app.set('views', path.join(path.dirname(fileURLToPath(import.meta.url)), 'frontend', 'views'))
  app.set('view engine', 'liquid')
  app.set('trust proxy', 'loopback')
  app.use(cors())

  const rl = new RateLimiter({
    limit: 300,
    window: 60e3
  })
  app.use((req, res, next) => {
    metrics.httpRequest({path: req.url})
    if (!rl.hit(req.ip)) {
      return res.status(429).json({
        error: 'RateLimitError',
        message: 'Rate limit exceeded'
      })
    }
    next()
  })

  app.get('/', (req, res) => res.render('index'))

  app.use('/admin', (req, res, next) => {
    res.locals.issueCount = issues.count()
    next()
  })
  app.get('/admin', (req, res) => res.render('admin/index', {topnav: 'dashboard'}))
  app.get('/admin/hyperspace', (req, res) => res.render('admin/hyperspace', {topnav: 'hyperspace'}))
  app.get('/admin/hyperspace/log', (req, res) => res.render('admin/hyperspace-log', {topnav: 'hyperspace'}))
  app.get('/admin/hyperspace/db/:id', (req, res) => res.render('admin/hyperspace-view-db', {topnav: 'hyperspace'}))
  app.get('/admin/issues', (req, res) => res.render('admin/issues', {topnav: 'issues'}))
  app.get('/admin/issues/view/:id', (req, res) => res.render('admin/issue-view', {topnav: 'issues', id: req.params.id}))
  app.get('/admin/users', (req, res) => res.render('admin/users', {topnav: 'users'}))
  app.get('/admin/users/view/:username', (req, res) => res.render('admin/user-view', {topnav: 'users', username: req.params.username}))
  app.get('/admin/debug', (req, res) => res.render('admin/debug', {topnav: 'debug'}))

  app.use('/img', express.static(path.join(INSTALL_PATH, 'frontend/static/img')))
  app.use('/css', express.static(path.join(INSTALL_PATH, 'frontend/static/css')))
  app.use('/js', express.static(path.join(INSTALL_PATH, 'frontend/static/js')))
  app.use('/vendor', express.static(path.join(INSTALL_PATH, 'frontend/static/vendor')))
  app.use('/webfonts', express.static(path.join(INSTALL_PATH, 'frontend/static/webfonts')))
  app.use('/_schemas', express.static('schemas'))

  app.get('/.well-known/webfinger', async (req, res) => {
    try {
      debugLog.httpCall('webfinger', req.ip, req.params, req.query)
      if (!req.query.resource) throw new Error('?resource is required')
      const {username, domain} = parseAcctUrl(req.query.resource)
      if (domain !== getDomain()) throw 'Not found'
      let profile = undefined
      if (username === 'server') {
        profile = {value: {dbUrl: db.publicServerDb.url}}
      } else {
        profile = await db.publicServerDb.users.get(username)
      }
      if (!profile || !profile.value.dbUrl) throw 'Not found'
      res.setHeader('Content-Security-Policy', `default-src 'none'; sandbox;`)
      res.status(200).json({
        subject: `acct:${username}@${domain}`,
        links: [{rel: 'self', href: profile.value.dbUrl}]
      })
    } catch (e) {
      json404(res, e)
    }
  })

  app.get('/.table/:username([^\/]{3,})/:schemaNs/:schemaName', async (req, res) => {
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
      json404(res, e)
    }
  })

  app.get('/.table/:username([^\/]{3,})/:schemaNs/:schemaName/:key', async (req, res) => {
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
      json404(res, e)
    }
  })

  async function serveView (req, res) {
    try {
      debugLog.httpCall('view.get', req.ip, req.params, req.query)
      const schemaId = `${req.params.viewns}/${req.params.viewname}`
      const path = req.url.split('?')[0]
      const args = path.split('/').filter(Boolean).slice(3).map(v => decodeURIComponent(v))
      if (Object.keys(req.query).length) args.push(getListOpts(req))
      if (dbViews.getType(schemaId) === 'blob-view') {
        const {etag, createStream, mimeType} = await dbViews.exec(schemaId, undefined, ...args)
          if (req.headers['if-none-match'] === etag) {
          return res.status(304).end()
        }
        res.setHeader('ETag', etag)
        if (mimeType) res.setHeader('Content-Type', mimeType)
        res.setHeader('Content-Security-Policy', `default-src 'none'; sandbox;`)
        pump(await createStream(), res, () => res.end())
      } else {
        res.setHeader('Content-Security-Policy', `default-src 'none'; sandbox;`)
        res.status(200).json(await dbViews.exec(schemaId, undefined, ...args))
      }
    } catch (e) {
      json404(res, e)
    }
  }
  app.get('/.view/:viewns/:viewname/*', (req, res) => serveView(req, res))
  app.get('/.view/:viewns/:viewname', (req, res) => serveView(req, res))

  app.get('/ctzn/server-info', async (req, res) => {
    res.status(200).json({
      version: PACKAGE_JSON.version
    })
  })

  app.get('/ctzn/server-terms-of-service', async (req, res) => {
    let txt
    try {
      txt = await fs.promises.readFile(TERMS_OF_SERVICE_PATH, 'utf8')
    } catch (e) {
      issues.add(new NoTermsOfServiceIssue())
    }
    if (txt) {
      res.status(200).end(txt)
    } else {
      res.status(404).end()
    }
  })

  app.get('/ctzn/server-privacy-policy', async (req, res) => {
    let txt
    try {
      txt = await fs.promises.readFile(PRIVACY_POLICY_PATH, 'utf8')
    } catch (e) {
      issues.add(new NoPrivacyPolicyIssue())
    }
    res.setHeader('Content-Security-Policy', `default-src 'none'; sandbox;`)
    if (txt) {
      res.status(200).end(txt)
    } else {
      res.status(404).end()
    }
  })

  app.use((req, res) => {
    res.status(404).send('404 Page not found')
  })

  const wsServer = new WebSocketServer({noServer: true})
  api.setup(wsServer, config)

  const server = new http.Server(app)
  server.on('upgrade', (request, socket, head) => {
    wsServer.wss.handleUpgrade(request, socket, head, socket => {
      wsServer.wss.emit('connection', socket, request)
    })
  })
  server.listen(config.port, () => {
    console.log(`CTZN server listening at http://localhost:${config.port}`)
    console.log(`Server admins:`, config.serverAdmins.join(', '))
  })

  await email.setup(config)
  await db.setup(config)

  // process.on('SIGINT', close)
  // process.on('SIGTERM', close)
  // async function close () {
  //   console.log('Shutting down, this may take a moment...')
  //   await db.cleanup()
  //   server.close()
  // }

  _serverReadyCb()
  return {
    server,
    db,
    close: async () => {
      console.log('Shutting down, this may take a moment...')
      await db.cleanup()
      server.close()
    }
  }
}

function json404 (res, e) {
  res.status(404).json({error: true, message: e.message || e.toString()})
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

function getDb (username) {
  if (username === getDomain()) {
    return db.publicServerDb
  }
  const userId = usernameToUserId(username)
  const publicDb = db.publicDbs.get(userId)
  if (!publicDb) throw new Error('User database not found')
  return publicDb
}