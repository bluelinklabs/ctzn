import { promises as fsp } from 'fs'
import * as path from 'path'
import * as os from 'os'
import * as hyperspace from './hyperspace.js'
import { PublicServerDB, PrivateServerDB } from './server.js'
import { UserDB } from './user.js'
import * as schemas from './schemas.js'
import { HYPER_KEY, hyperUrlToKey } from '../lib/strings.js'
import lock from '../lib/lock.js'

export let configPath = undefined
export let config = undefined
export let publicServerDb = undefined
export let privateServerDb = undefined
export let userDbs = new Map()

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

  await loadUserDbs()
}

export async function createUser ({username, email, profile}) {
  let release = lock('db')
  try {
    const account = {email}
    const user = {
      username,
      dbUrl: `hyper://${'0'.repeat(64)}/`,
      joinDate: (new Date()).toISOString(),
    }

    ;(await schemas.fetch('https://ctzn.network/profile.json')).assertValid(profile)
    ;(await schemas.fetch('https://ctzn.network/account.json')).assertValid(account)
    ;(await schemas.fetch('https://ctzn.network/user.json')).assertValid(user)

    const db = new UserDB(null)
    await db.setup()
    user.dbUrl = db.url

    await user.profile.put('self', profile)
    await publicServerDb.users.put(username, user)
    await privateServerDb.accounts.put(username, account)
    
    userDbs.set(username, db)
    return db
  } finally {
    release()
  }
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

async function loadUserDbs () {
  let users = await publicServerDb.users.list()
  console.log('Loading', users.length, 'user databases')
  for (let user of users) {
    let userDb = new UserDB(hyperUrlToKey(user.value.dbUrl))
    await userDb.setup()
    userDbs.set(user.key, userDb)
  }
}