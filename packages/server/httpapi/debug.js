import { createUser, whenAllSynced, loadOrUnloadExternalUserDbs } from '../db/index.js'
import { debugGetLastEmail } from '../lib/email.js'
import { whenServerReady } from '../index.js'

export function setup (app) {
  console.log('Enabling /_api/debug endpoints')

  app.post('/_api/debug/create-user', async (req, res) => {
    try {
      const {username, publicDb} = await createUser(req.body)
      res.status(200).json({username, dbKey: publicDb.dbKey})
    } catch (e) {
      res.status(500).json({error: true, message: e.toString()})
    }
  })

  app.get('/_api/debug/when-server-ready', async (req, res) => {
    await whenServerReady
    res.status(200).json({})
  })

  app.get('/_api/debug/when-all-synced', async (req, res) => {
    await whenAllSynced()
    res.status(200).json({})
  })

  app.post('/_api/debug/update-external-dbs', async (req, res) => {
    await loadOrUnloadExternalUserDbs()
    res.status(200).json({})
  })
  
  app.get('/_api/debug/last-email', (req, res) => {
    res.status(200).json(debugGetLastEmail())
  })
}