import express from 'express'
import { Server as WebSocketServer } from 'rpc-websockets'
import cors from 'cors'
import * as db from './db/index.js'
import * as api from './api/index.js'
import * as perf from './lib/perf.js'
import * as path from 'path'
import { fileURLToPath } from 'url'
import * as os from 'os'
import { setOrigin, getDomain, parseAcctUrl, usernameToUserId, constructUserUrl, DEBUG_MODE_PORTS_MAP } from './lib/strings.js'
import * as dbGetters from './db/getters.js'

const DEFAULT_USER_THUMB_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'static', 'img', 'default-user-thumb.jpg')

let app

export async function start ({port, configDir, simulateHyperspace, domain, debugMode, benchmarkMode}) {
  configDir = configDir || path.join(os.homedir(), '.ctzn')
  if (benchmarkMode) {
    perf.enable()
  }
  if (debugMode && DEBUG_MODE_PORTS_MAP[domain]) {
    port = DEBUG_MODE_PORTS_MAP[domain]
  }
  setOrigin(`http://${domain || 'localhost'}:${port}`)

  app = express()
  app.set('view engine', 'ejs')
  app.use(cors())

  app.get('/', (req, res) => {
    res.render('index')
  })

  app.use('/img', express.static('static/img'))
  app.use('/css', express.static('static/css'))
  app.use('/js', express.static('static/js'))
  app.use('/vendor', express.static('static/vendor'))
  app.use('/webfonts', express.static('static/webfonts'))
  app.use('/_schemas', express.static('schemas'))

  app.get('/.well-known/webfinger', async (req, res) => {
    try {
      if (!req.query.resource) throw new Error('?resource is required')
      const {username, domain} = parseAcctUrl(req.query.resource)
      if (domain !== getDomain()) throw 'Not found'
      const profile = await db.publicServerDb.users.get(username)
      if (!profile || !profile.value.dbUrl) throw 'Not found'
      res.status(200).json({
        subject: `acct:${username}@${domain}`,
        links: [{rel: 'self', href: profile.value.dbUrl}]
      })
    } catch (e) {
      json404(res, e)
    }
  })

  app.get('/ctzn/profile/:username([^\/]{3,})', async (req, res) => {
    try {
      const userId = usernameToUserId(req.params.username)
      const db = getDb(req.params.username)
      const profileEntry = await db.profile.get('self')
      if (!profileEntry) {
        throw new Error('User profile not found')
      }
      res.status(200).json({
        url: constructUserUrl(userId),
        userId: userId,
        dbUrl: db.url,
        dbType: publicUserDb.dbType,
        value: profileEntry.value
      })
    } catch (e) {
      json404(res, e)
    }
  })

  app.get('/ctzn/avatar/:username([^\/]{3,})', async (req, res) => {
    try {
      const userId = usernameToUserId(req.params.username)
      const userDb = db.publicUserDbs.get(userId)
      if (!userDb) {
        res.sendFile(DEFAULT_USER_THUMB_PATH)
        return
      }

      const s = await userDb.blobs.createReadStream('avatar')
      s.pipe(res)
    } catch (e) {
      res.sendFile(DEFAULT_USER_THUMB_PATH)
    }
  })

  app.get('/ctzn/followers/:username', async (req, res) => {
    try {
      res.status(200).json(await dbGetters.listFollowers(usernameToUserId(req.params.username)))
    } catch (e) {
      json404(res, e)
    }
  })

  app.get('/ctzn/follows/:username', async (req, res) => {
    try {
      const db = getDb(req.params.username)
      res.status(200).json(await dbGetters.listFollows(db, getListOpts(req)))
    } catch (e) {
      json404(res, e)
    }
  })

  app.get('/ctzn/members/:username', async (req, res) => {
    try {
      const db = getDb(req.params.username)
      res.status(200).json(await dbGetters.listCommunityMembers(db, getListOpts(req)))
    } catch (e) {
      json404(res, e)
    }
  })

  app.get('/ctzn/memberships/:username', async (req, res) => {
    try {
      const db = getDb(req.params.username)
      res.status(200).json(await dbGetters.listCommunityMemberships(db, getListOpts(req)))
    } catch (e) {
      json404(res, e)
    }
  })

  app.get('/ctzn/post/:username([^\/]{3,})/:key', async (req, res) => {
    try {
      const db = getDb(req.params.username)
      res.status(200).json(await dbGetters.getPost(db, req.params.key, usernameToUserId(req.params.username)))
    } catch (e) {
      json404(res, e)
    }
  })

  app.get('/ctzn/posts/:username([^\/]{3,})', async (req, res) => {
    try {
      const db = getDb(req.params.username)
      res.status(200).json(await dbGetters.listPosts(db, getListOpts(req), usernameToUserId(req.params.username)))
    } catch (e) {
      json404(res, e)
    }
  })

  app.get('/ctzn/thread/:url', async (req, res) => {
    try {
      res.status(200).json(await dbGetters.getThread(req.params.url))
    } catch (e) {
      json404(res, e)
    }
  })

  app.get('/hyper/:username([^\/]{3,})/:schemaNs/:schemaName', async (req, res) => {
    try {
      const db = getDb(req.params.username)
      const table = db.tables[`${req.params.schemaNs}/${req.params.schemaName}`]
      if (!table) throw new Error('User table not found')     
      res.status(200).json(await table.list(getListOpts(req)))
    } catch (e) {
      json404(res, e)
    }
  })

  app.get('/hyper/:username([^\/]{3,})/:schemaNs/:schemaName/:key', async (req, res) => {
    try {
      const db = getDb(req.params.username)
      const table = db.tables[`${req.params.schemaNs}/${req.params.schemaName}`]
      if (!table) throw new Error('User table not found')
      res.status(200).json(await table.get(req.params.key))
    } catch (e) {
      json404(res, e)
    }
  })

  app.use((req, res) => {
    res.status(404).send('404 Page not found')
  })

  const server = await new Promise((resolve, reject) => {
    let s = app.listen(port, async () => {
      console.log(`CTZN server listening at http://localhost:${port}`)

      try {
        await db.setup({configDir, simulateHyperspace})
        resolve(s)
      } catch (e) {
        reject(e)
      }
    })
  })

  const wsServer = new WebSocketServer({server})
  api.setup(wsServer, {debugMode})

  // process.on('SIGINT', close)
  // process.on('SIGTERM', close)
  // async function close () {
  //   console.log('Shutting down, this may take a moment...')
  //   await db.cleanup()
  //   server.close()
  // }

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
  const opts = {limit: 10}
  if (req.query.limit) opts.limit = Math.max(Math.min(req.query.limit, 100), 0)
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
  const publicUserDb = db.publicUserDbs.get(userId)
  if (!publicUserDb) throw new Error('User database not found')
  return publicUserDb
}