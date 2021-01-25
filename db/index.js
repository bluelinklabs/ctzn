import { promises as fsp } from 'fs'
import * as path from 'path'
import * as hyperspace from './hyperspace.js'
import { PublicServerDB, PrivateServerDB } from './server.js'
import { PublicUserDB, PrivateUserDB } from './user.js'
import * as schemas from '../lib/schemas.js'
import { HYPER_KEY, hyperUrlToKey, constructUserId } from '../lib/strings.js'
import lock from '../lib/lock.js'

let _configDir = undefined
export let configPath = undefined
export let config = undefined
export let publicServerDb = undefined
export let privateServerDb = undefined
export let publicUserDbs = new Map()
export let privateUserDbs = new Map()

export async function setup ({configDir, simulateHyperspace}) {
  await hyperspace.setup({simulateHyperspace})
  await schemas.setup()
  
  _configDir = configDir
  configPath = path.join(configDir, 'dbconfig.json')
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
  let release = await lock('db')
  try {
    const account = {
      email,
      privateDbUrl: `hyper://${'0'.repeat(64)}/`
    }
    const user = {
      username,
      dbUrl: `hyper://${'0'.repeat(64)}/`,
      joinDate: (new Date()).toISOString(),
    }

    schemas.get('ctzn.network/profile').assertValid(profile)
    schemas.get('ctzn.network/account').assertValid(account)
    schemas.get('ctzn.network/user').assertValid(user)

    const publicUserDb = new PublicUserDB(null)
    await publicUserDb.setup()
    user.dbUrl = publicUserDb.url

    const privateUserDb = new PrivateUserDB(null)
    await privateUserDb.setup()
    account.privateDbUrl = privateUserDb.url

    await publicUserDb.profile.put('self', profile)
    await publicServerDb.users.put(username, user)
    await privateServerDb.accounts.put(username, account)
    await privateServerDb.updateUserDbIndex({
      type: 'put',
      value: {
        userId: constructUserId(username),
        dbUrl: user.dbUrl
      }
    })
    
    publicUserDbs.set(constructUserId(username), publicUserDb)
    privateUserDbs.set(constructUserId(username), privateUserDb)
    return {privateUserDb, publicUserDb}
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
  await fsp.mkdir(_configDir).catch(e => undefined)
  await fsp.writeFile(configPath, JSON.stringify(config, null, 2))
}

async function loadUserDbs () {
  let users = await publicServerDb.users.list()
  console.log('Loading', users.length, 'user databases')
  for (let user of users) {
    let publicUserDb = new PublicUserDB(hyperUrlToKey(user.value.dbUrl))
    await publicUserDb.setup()
    publicUserDbs.set(constructUserId(user.key), publicUserDb)

    let accountEntry = await privateServerDb.accounts.get(user.value.username)
    let privateUserDb = new PrivateUserDB(hyperUrlToKey(accountEntry.value.privateDbUrl))
    await privateUserDb.setup()
    privateUserDbs.set(constructUserId(user.key), privateUserDb)
  }
}