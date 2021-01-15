import * as hyperspace from './hyperspace.js'
import { PublicServerDB, PrivateServerDB } from './server.js'

export let publicServerDb = undefined
export let privateServerDb = undefined

export async function setup () {
  await hyperspace.setup()

  publicServerDb = new PublicServerDB(null) // TODO get key from config
  await publicServerDb.setup()
  privateServerDb = new PrivateServerDB(null) // TODO get key from config
  await privateServerDb.setup()
}

export async function cleanup () {
  await hyperspace.cleanup()
}