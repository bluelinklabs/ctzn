import express from 'express'
import { Server as WebSocketServer } from 'rpc-websockets'
import * as db from './db/index.js'
import * as api from './api/index.js'
import * as path from 'path'
import { fileURLToPath } from 'url'
import * as os from 'os'
import * as schemas from './lib/schemas.js'
import { setOrigin } from './lib/strings.js'

const DEFAULT_USER_THUMB_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'static', 'img', 'default-user-thumb.jpg')

let app

export async function start ({debugMode, port, configDir, simulateHyperspace}) {
  configDir = configDir || path.join(os.homedir(), '.ctzn')
  if (debugMode) {
    schemas.setDebugEndpoint(port)
  }
  setOrigin(`http://localhost:${port}`)

  app = express()
  app.set('view engine', 'ejs')

  app.get('/', (req, res) => {
    res.render('index')
  })

  app.use('/img', express.static('static/img'))
  app.use('/css', express.static('static/css'))
  app.use('/js', express.static('static/js'))
  app.use('/vendor', express.static('static/vendor'))
  app.use('/webfonts', express.static('static/webfonts'))
  app.use('/_schemas', express.static('schemas'))

  app.get('/login', (req, res) => {
    res.render('login')
  })

  app.get('/signup', (req, res) => {
    res.render('signup')
  })

  app.get('/forgot-password', (req, res) => {
    res.render('forgot-password')
  })

  app.get('/notifications', (req, res) => {
    res.render('notifications')
  })

  app.get('/profile', (req, res) => {
    res.render('user')
  })

  app.get('/search', (req, res) => {
    res.render('search')
  })

  app.get('/:username([^\/]{3,})/avatar', async (req, res) => {
    try {
      const userDb = db.userDbs.get(req.params.username)
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

  app.get('/:username([^\/]{3,})', (req, res) => {
    res.render('user')
  })

  app.use((req, res) => {
    res.status(404).send('404 Page not found')
  })

  const server = await new Promise(r => {
    let s = app.listen(port, async () => {
      console.log(`Example app listening at http://localhost:${port}`)

      await db.setup({configDir, simulateHyperspace})
      r(s)
    })
  })

  const wsServer = new WebSocketServer({server})
  api.setup(wsServer)

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