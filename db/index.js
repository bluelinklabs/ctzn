import { promises as fsp } from 'fs'
import * as path from 'path'
import * as hyperspace from './hyperspace.js'
import { PublicServerDB, PrivateServerDB } from './server.js'
import { PublicUserDB, PrivateUserDB } from './user.js'
import * as schemas from '../lib/schemas.js'
import { HYPER_KEY, hyperUrlToKey, constructUserId, getDomain } from '../lib/strings.js'
import { fetchDbUrl } from '../lib/network.js'
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
  publicServerDb.watch(onDatabaseChange)
  privateServerDb = new PrivateServerDB(config.privateServer, publicServerDb)
  await privateServerDb.setup()

  config.publicServer = publicServerDb.key.toString('hex')
  config.privateServer = privateServerDb.key.toString('hex')
  await saveDbConfig()

  await loadMemberUserDbs()
  await loadOrUnloadExternalUserDbs()
  publicServerDb.on('followed-users-changed', loadOrUnloadExternalUserDbs)
}

export async function createUser ({username, email, profile}) {
  let release = await lock(`create-user:${username}`)
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
    publicUserDb.watch(onDatabaseChange)
    user.dbUrl = publicUserDb.url

    const privateUserDb = new PrivateUserDB(null, publicServerDb, publicUserDb)
    await privateUserDb.setup()
    account.privateDbUrl = privateUserDb.url

    await publicUserDb.profile.put('self', profile)
    await publicServerDb.users.put(username, user)
    await privateServerDb.accounts.put(username, account)
    await onDatabaseChange(publicServerDb)
    
    const userId = constructUserId(username)
    publicUserDbs.set(userId, publicUserDb)
    privateUserDbs.set(userId, privateUserDb)
    return {privateUserDb, publicUserDb, userId}
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

async function loadMemberUserDbs () {
  let users = await publicServerDb.users.list()
  for (let user of users) {
    let publicUserDb = new PublicUserDB(hyperUrlToKey(user.value.dbUrl))
    await publicUserDb.setup()
    publicUserDbs.set(constructUserId(user.key), publicUserDb)
    publicUserDb.watch(onDatabaseChange)

    let accountEntry = await privateServerDb.accounts.get(user.value.username)
    let privateUserDb = new PrivateUserDB(hyperUrlToKey(accountEntry.value.privateDbUrl), publicServerDb, publicUserDb)
    await privateUserDb.setup()
    privateUserDbs.set(constructUserId(user.key), privateUserDb)
  }
  console.log('Loaded', users.length, 'member user databases')
}

export function* getAllIndexingDbs () {
  yield publicServerDb
  yield privateServerDb
  for (let db of privateUserDbs) {
    yield db[1]
  }
}

export async function onDatabaseChange (db) {
  for (let indexingDb of getAllIndexingDbs()) {
    let subscribedUrls = await indexingDb.getSubscribedDbUrls()
    if (subscribedUrls.includes(db.url)) {
      await indexingDb.updateIndexes(db)
    }
  }
}

async function loadOrUnloadExternalUserDbs () {
  // load any new follows
  let numLoaded = 0
  const followedUserIds = await publicServerDb.getAllExternalFollowedIds()
  for (let userId of followedUserIds) {
    if (!publicUserDbs.has(userId)) {
      try {
        const dbUrl = await fetchDbUrl(userId)
        let publicUserDb = new PublicUserDB(hyperUrlToKey(dbUrl))
        await publicUserDb.setup()
        publicUserDbs.set(userId, publicUserDb)
        publicUserDb.watch(onDatabaseChange)
        numLoaded++
      } catch (e) {
        console.error('Failed to load external user', userId)
        console.error(e)
      }
    }
  }
  if (numLoaded) {
    console.log('Loaded', numLoaded, 'external user databases')
  }
  // unload any unfollowed
  let numUnloaded = 0
  for (let userId of publicUserDbs.keys()) {
    if (userId.endsWith(getDomain()) || followedUserIds.includes(userId)) {
      continue
    }
    publicUserDbs.get(userId).teardown()
    publicUserDbs.delete(userId)
    numUnloaded++
  }
  if (numUnloaded) {
    console.log('Unloaded', numUnloaded, 'external user databases')
  }
}