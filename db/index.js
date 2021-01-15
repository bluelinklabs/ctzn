import { promises as fsp } from 'fs'
import * as path from 'path'
import * as os from 'os'
import * as hyperspace from './hyperspace.js'
import { PublicServerDB, PrivateServerDB } from './server.js'

import pump from 'pump'
import concat from 'concat-stream'

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

  // DEBUG
  const peopleTable = await publicServerDb.getTable('https://ctzn.com/person.json')
  console.log(await peopleTable.put(1, {
    firstName: 'bob',
    lastName: 'roberts',
    age: 5
  }))
  console.log(await peopleTable.put(1, {
    firstName: 'bob',
    lastName: 'roberts'
  }))
  console.log(await peopleTable.put(1, {
    lastName: 'roberts',
    age: 5
  }))
  console.log(await peopleTable.put(1, {
    firstName: 'bob',
    lastName: 'roberts',
    age: -1
  }).catch(e => e))
  console.log(await peopleTable.put(1, {
    firstName: 10,
    lastName: 'roberts',
    age: 5
  }).catch(e => e))

  console.log(await peopleTable.get(1).catch(e => e))
  console.log(await new Promise((r, r2) => {
    pump(
      peopleTable.createReadStream(),
      concat(r),
      r2
    )
  }))
}

export async function cleanup () {
  await hyperspace.cleanup()
}

async function readDbConfig () {
  try {
    let str = await fsp.readFile(configPath)
    config = JSON.parse(str)
  } catch (e) {
    if (e.code !== 'NOENT') {
      console.error('Failed to read', configPath)
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