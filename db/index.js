import { promises as fsp } from 'fs'
import * as path from 'path'
import * as os from 'os'
import * as hyperspace from './hyperspace.js'
import { PublicServerDB, PrivateServerDB } from './server.js'
import { UserDB } from './user.js'

const HYPER_KEY = /[0-9a-f]{64}/i

export let configPath = undefined
export let config = undefined
export let publicServerDb = undefined
export let privateServerDb = undefined

export async function setup () {
  await hyperspace.setup()

  configPath = path.join(os.homedir(), '.ctzn', 'dbconfig.json')
  await readDbConfig()

  publicServerDb = new PublicServerDB(config.publicServer)
  await publicServerDb.setup()
  privateServerDb = new PrivateServerDB(config.privateServer)
  await privateServerDb.setup()

  config.publicServer = publicServerDb.key.toString('hex')
  config.privateServer = privateServerDb.key.toString('hex')
  await saveDbConfig()
}

export async function cleanup () {
  await hyperspace.cleanup()
}

async function readDbConfig () {
  try {
    let str = await fsp.readFile(configPath)
    config = JSON.parse(str)
  } catch (e) {
    if (e.code !== 'ENOENT') {
      console.error('Failed to read', configPath)
      console.error(e)
      process.exit(1)
    }
    config = {
      publicServer: null,
      privateServer: null
    }
  }

  if (!config.publicServer) {
    config.publicServer = null
  } else if (typeof config.publicServer !== 'string' || !HYPER_KEY.test(config.publicServer)) {
    console.error('Invalid dbconfig value for publicServer:', config.publicServer)
    console.error('Must be a 64-character hex string representing a hyperbee key')
    process.exit(1)
  }
  if (!config.privateServer) {
    config.privateServer = null
  } else if (typeof config.privateServer !== 'string' || !HYPER_KEY.test(config.privateServer)) {
    console.error('Invalid dbconfig value for privateServer:', config.privateServer)
    console.error('Must be a 64-character hex string representing a hyperbee key')
    process.exit(1)
  }
}

async function saveDbConfig () {
  await fsp.mkdir(path.join(os.homedir(), '.ctzn')).catch(e => undefined)
  await fsp.writeFile(configPath, JSON.stringify(config, null, 2))
}