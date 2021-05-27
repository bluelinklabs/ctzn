import { RateLimiter } from 'pauls-sliding-window-rate-limiter'
import * as http from 'http'
import express from 'express'
import cors from 'cors'
import { Config } from './lib/config.js'
import * as db from './db/index.js'
import * as methods from './methods/index.js'
import * as adminHttpAPI from './httpapi/admin.js'
import * as appHttpAPI from './httpapi/app.js'
import * as debugHttpAPI from './httpapi/debug.js'
import * as sessionMiddleware from './httpapi/session-middleware.js'
import cookieParser from 'cookie-parser'
import * as perf from './lib/perf.js'
import * as metrics from './lib/metrics.js'
import { NoTermsOfServiceIssue } from './lib/issues/no-terms-of-service.js'
import { NoPrivacyPolicyIssue } from './lib/issues/no-privacy-policy.js'
import * as issues from './lib/issues.js'
import * as email from './lib/email.js'
import * as path from 'path'
import * as fs from 'fs'
import { fileURLToPath } from 'url'
import * as os from 'os'
import { setOrigin, DEBUG_MODE_PORTS_MAP } from './lib/strings.js'
import { Liquid } from 'liquidjs'
import { resolve } from 'import-meta-resolve'
import sass from 'node-sass'

const INSTALL_PATH = path.dirname(fileURLToPath(import.meta.url))
const INSTALL_UI_PATH = path.join(fileURLToPath(await resolve('@bluelinklabs/ctzn-ui/package.json', import.meta.url)), '..')
const INSTALL_ADMIN_PATH = path.join(fileURLToPath(await resolve('@bluelinklabs/ctzn-adminui/package.json', import.meta.url)), '..')
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
  if (config.debugMode) console.log('Debug mode enabled')
  if (config.debugMode && DEBUG_MODE_PORTS_MAP[config.domain]) {
    config.overrides.port = DEBUG_MODE_PORTS_MAP[config.domain]
    config.overrides.adminPort = DEBUG_MODE_PORTS_MAP[config.domain] + 1
  }
  setOrigin(`http://${config.domain || 'localhost'}:${config.port}`)

  const appServer = createAppServer(config, opts.configDir)
  const adminServer = createAdminServer(config, opts.configDir)

  await email.setup(config)
  await db.setup(config)
  await methods.setup(config)

  process.on('SIGINT', close)
  process.on('SIGTERM', close)
  async function close () {
    console.log('Shutting down, this may take a moment...')
    await db.cleanup()
    appServer.close()
    adminServer.close()
    process.exit(0)
  }

  _serverReadyCb()
  return {
    appServer,
    adminServer,
    db,
    close: async () => {
      console.log('Shutting down, this may take a moment...')
      await db.cleanup()
      appServer.close()
      adminServer.close()
    }
  }
}

function createAppServer (config, configDir) {
  const TERMS_OF_SERVICE_PATH = path.join(configDir, 'terms-of-service.txt')
  const PRIVACY_POLICY_PATH = path.join(configDir, 'privacy-policy.txt')

  app = express()
  app.engine('liquid', (new Liquid()).express())
  app.set('views', path.join(INSTALL_UI_PATH, 'views'))
  app.set('view engine', 'liquid')
  app.set('trust proxy', 'loopback')
  app.use(cors())
  app.use(express.json())
  app.use(cookieParser())
  app.use(sessionMiddleware.setup())

  const rl = new RateLimiter({
    limit: 10000,
    window: 60e3
  })
  app.use((req, res, next) => {
    res.header('Cross-Origin-Opener-Policy', 'same-origin')
    res.header('Cross-Origin-Embedder-Policy', 'require-corp')

    metrics.httpRequest({path: req.url})
    if (!rl.hit(req.ip)) {
      return res.status(429).json({
        error: 'RateLimitError',
        message: 'Rate limit exceeded'
      })
    }
    next()
  })

  appHttpAPI.setup(app, config)
  if (config.debugMode) debugHttpAPI.setup(app)
  app.use('/_api', (req, res) => json404(res, 'Not found'))
  app.get('/', (req, res) => res.render('index'))
  app.get('/index', (req, res) => res.render('index'))
  app.get('/index.html', (req, res) => res.render('index'))
  app.get('/search', (req, res) => res.render('index'))
  app.get('/notifications', (req, res) => res.render('index'))
  app.get('/forgot-password', (req, res) => res.render('index'))
  app.get('/communities', (req, res) => res.render('index'))
  app.get('/account', (req, res) => res.render('index'))
  app.get('/signup', (req, res) => res.render('index'))
  app.use('/img', express.static(path.join(INSTALL_UI_PATH, 'static', 'img')))
  app.get('/css/themes/:filename', (req, res) => {
    const filepath = path.join(INSTALL_UI_PATH, 'static', 'css', 'themes', req.params.filename)
    sass.render({file: filepath}, (err, result) => {
      if (err) {
        console.log(err)
        json404(res, 'Not found')
      } else {
        res.header('Content-Type', 'text/css')
        res.status(200).end(result.css)
      }
    })
  })
  app.use('/css', express.static(path.join(INSTALL_UI_PATH, 'static', 'css')))
  app.get('/js/app.build.js', (req, res) => {
    if(process.env.NODE_ENV === 'production') {
      res.sendFile(path.join(INSTALL_UI_PATH, 'static', 'js', 'app.build.js'))
    } else {
      res.sendFile(path.join(INSTALL_UI_PATH, 'static', 'js', 'app.js'))
    }
  })
  app.use('/js', express.static(path.join(INSTALL_UI_PATH, 'static', 'js')))
  app.use('/vendor', express.static(path.join(INSTALL_UI_PATH, 'static', 'vendor')))
  app.use('/webfonts', express.static(path.join(INSTALL_UI_PATH, 'static', 'webfonts')))
  app.use('/_schemas', express.static('schemas'))
  app.get('/manifest.json', (req, res) => res.sendFile(path.join(INSTALL_UI_PATH, 'static', 'manifest.json')))
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
  app.get(new RegExp('/([^/])/ctzn.network/post/([^/]+)'), (req, res) => res.render('index'))
  app.get(new RegExp('/([^/])/ctzn.network/comment/([^/]+)'), (req, res) => res.render('index'))
  app.get(new RegExp('/([^/])'), (req, res) => res.render('index'))
  app.use((req, res) => {
    res.status(404).send('404 Page not found')
  })

  const server = new http.Server(app)
  server.listen(config.port, () => {
    console.log(`Application server listening at http://localhost:${config.port}`)
  })

  return server
}

function createAdminServer (config, configDir) {
  app = express()
  app.engine('liquid', (new Liquid()).express())
  app.set('views', path.join(INSTALL_ADMIN_PATH, 'views'))
  app.set('view engine', 'liquid')
  app.set('trust proxy', 'loopback')
  app.use(cors())
  app.use(express.json())
  app.use(cookieParser())
  app.use(sessionMiddleware.setup())

  app.use('/', (req, res, next) => {
    res.locals.issueCount = issues.count()
    next()
  })
  appHttpAPI.setup(app, config)
  if (config.debugMode) debugHttpAPI.setup(app)
  adminHttpAPI.setup(app, config)
  app.use('/_api', (req, res) => json404(res, 'Not found'))
  app.get('/', (req, res) => res.render('index', {topnav: 'dashboard'}))
  app.get('/hyperspace', (req, res) => res.render('hyperspace', {topnav: 'hyperspace'}))
  app.get('/hyperspace/log', (req, res) => res.render('hyperspace-log', {topnav: 'hyperspace'}))
  app.get('/hyperspace/db/:id', (req, res) => res.render('hyperspace-view-db', {topnav: 'hyperspace'}))
  app.get('/issues', (req, res) => res.render('issues', {topnav: 'issues'}))
  app.get('/issues/view/:id', (req, res) => res.render('issue-view', {topnav: 'issues', id: req.params.id}))
  app.get('/users', (req, res) => res.render('users', {topnav: 'users'}))
  app.get('/users/view/:username', (req, res) => res.render('user-view', {topnav: 'users', username: req.params.username}))
  app.get('/debug', (req, res) => res.render('debug', {topnav: 'debug'}))
  app.use('/img', express.static(path.join(INSTALL_ADMIN_PATH, 'static', 'img')))
  app.use('/css', express.static(path.join(INSTALL_ADMIN_PATH, 'static', 'css')))
  app.use('/js', express.static(path.join(INSTALL_ADMIN_PATH, 'static', 'js')))
  app.use('/vendor', express.static(path.join(INSTALL_ADMIN_PATH, 'static', 'vendor')))
  app.use('/webfonts', express.static(path.join(INSTALL_ADMIN_PATH, 'static', 'webfonts')))

  const server = new http.Server(app)
  server.listen(config.adminPort, () => {
    console.log(`Admin server listening at http://localhost:${config.adminPort}`)
    console.log(`Server admins:`, config.serverAdmins.join(', '))
  })

  return server

}

function json404 (res, e) {
  res.status(404).json({error: true, message: e.message || e.toString()})
}