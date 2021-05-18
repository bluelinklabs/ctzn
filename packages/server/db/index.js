import { promises as fsp } from 'fs'
import * as path from 'path'
import _debounce from 'lodash.debounce'
import { client } from './hyperspace.js'
import Hyperbee from 'hyperbee'
import * as hyperspace from './hyperspace.js'
import { PublicServerDB, PrivateServerDB } from './server.js'
import { PublicCitizenDB, PrivateCitizenDB } from './citizen.js'
import { PublicCommunityDB } from './community.js'
import * as diskusageTracker from './diskusage-tracker.js'
import * as schemas from '../lib/schemas.js'
import * as views from './views.js'
import { RESERVED_USERNAMES, HYPER_KEY, hyperUrlToKey, constructUserId, getDomain, getServerIdForUserId } from '../lib/strings.js'
import { fetchDbUrl } from '../lib/network.js'
import { hashPassword } from '../lib/crypto.js'
import * as perf from '../lib/perf.js'
import * as issues from '../lib/issues.js'
import { CaseInsensitiveMap } from '../lib/map.js'
import { LoadExternalUserDbIssue } from '../lib/issues/load-external-user-db.js'
import { UnknownUserTypeIssue } from '../lib/issues/unknown-user-type.js'
import lock from '../lib/lock.js'

const SWEEP_INACTIVE_DBS_INTERVAL = 10e3

let _configDir = undefined
export let configPath = undefined
export let config = undefined
export let publicServerDb = undefined
export let privateServerDb = undefined
export let publicDbs = new CaseInsensitiveMap()
export let privateDbs = new CaseInsensitiveMap()

export async function setup ({configDir, hyperspaceHost, hyperspaceStorage, simulateHyperspace}) {
  await hyperspace.setup({configDir, hyperspaceHost, hyperspaceStorage, simulateHyperspace})
  await schemas.setup()
  diskusageTracker.setup()
  
  _configDir = configDir
  configPath = path.join(configDir, 'dbconfig.json')
  await readDbConfig()

  publicServerDb = new PublicServerDB(constructUserId('server'), config.publicServer)
  await publicServerDb.setup()
  publicDbs.set(publicServerDb.userId, publicServerDb)
  publicServerDb.watch(onDatabaseChange)
  privateServerDb = new PrivateServerDB(config.privateServer, publicServerDb)
  await privateServerDb.setup()
  privateDbs.set(publicServerDb.userId, privateServerDb)

  config.publicServer = publicServerDb.key.toString('hex')
  config.privateServer = privateServerDb.key.toString('hex')
  await saveDbConfig()

  views.setup()
  await loadMemberUserDbs()
  await loadOrUnloadExternalUserDbsDebounced()
  /* dont await */ catchupAllIndexes()

  const sweepInterval = setInterval(sweepInactiveDbs, SWEEP_INACTIVE_DBS_INTERVAL)
  sweepInterval.unref()
}

export async function createUser ({type, username, email, password, profile}) {
  if (type !== 'citizen' && type !== 'community') {
    throw new Error(`Invalid type "${type}": must be 'citizen' or 'community'`)
  }
  if (RESERVED_USERNAMES.includes(username)) {
    throw new Error(`Username is reserved: ${username}`)
  }

  let release = await lock(`create-user:${username}`)
  try {
    const userId = constructUserId(username)
    const account = {
      email,
      hashedPassword: password ? (await hashPassword(password)) : undefined,
      privateDbUrl: `hyper://${'0'.repeat(64)}/`
    }
    const user = {
      type,
      username,
      dbUrl: `hyper://${'0'.repeat(64)}/`,
      joinDate: (new Date()).toISOString(),
    }

    schemas.get('ctzn.network/profile').assertValid(profile)
    if (type === 'citizen') schemas.get('ctzn.network/account').assertValid(account)
    schemas.get('ctzn.network/user').assertValid(user)

    if (publicDbs.has(userId)) {
      throw new Error('Username already in use.')
    }

    let publicDb
    let privateDb
    if (type === 'citizen') {
      publicDb = new PublicCitizenDB(userId, null)
      await publicDb.setup()
      publicDb.watch(onDatabaseChange)
      publicDb.on('subscriptions-changed', loadOrUnloadExternalUserDbsDebounced)
      await catchupIndexes(publicDb)
      user.dbUrl = publicDb.url

      privateDb = new PrivateCitizenDB(userId, null, publicServerDb, publicDb)
      await privateDb.setup()
      await catchupIndexes(privateDb)
      account.privateDbUrl = privateDb.url
    } else if (type === 'community') {
      publicDb = new PublicCommunityDB(userId, null)
      await publicDb.setup()
      publicDb.watch(onDatabaseChange)
      publicDb.on('subscriptions-changed', loadOrUnloadExternalUserDbsDebounced)
      user.dbUrl = publicDb.url
    }

    await publicDb.profile.put('self', profile)
    await publicServerDb.users.put(username, user)
    if (type === 'citizen') await privateServerDb.accounts.put(username, account)
    await onDatabaseChange(publicServerDb, [privateServerDb])
    
    publicDbs.set(userId, publicDb)
    if (privateDb) {
      privateDbs.set(userId, privateDb)
      privateDb.on('subscriptions-changed', loadOrUnloadExternalUserDbsDebounced)
    }
    return {privateDb, publicDb, userId}
  } finally {
    release()
  }
}

export async function deleteUser (username) {
  console.log('Deleting user:', username)
  try {
    const userId = constructUserId(username)
    if (publicDbs.has(userId)) {
      if (publicDbs.get(userId).dbType === 'ctzn.network/public-server-db') {
        throw new Error('Cannot delete server database')
      }
      await publicDbs.get(userId).teardown({unswarm: true})
      publicDbs.delete(userId)
    }
    if (privateDbs.has(userId)) {
      await privateDbs.get(userId).teardown({unswarm: true})
      privateDbs.delete(userId)
    }
    await publicServerDb.users.del(username)
    await privateServerDb.accounts.del(username)
    await onDatabaseChange(publicServerDb, [privateServerDb])
    console.log('Successfully deleted user:', username)
  } catch (e) {
    console.error('Failed to delete user:', username)
    console.error(e)
    throw e
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
  let numLoaded = 0
  let users = await publicServerDb.users.list()
  await Promise.allSettled(users.map(async (user) => {
    try {
      if (user.value.type === 'citizen') {
        const userId = constructUserId(user.key)
        if (publicDbs.has(userId)) {
          console.error('Skipping db load due to duplicate userId', userId)
          return
        }
        let publicDb = new PublicCitizenDB(userId, hyperUrlToKey(user.value.dbUrl))
        await publicDb.setup()
        publicDbs.set(userId, publicDb)
        publicDb.watch(onDatabaseChange)
        publicDb.on('subscriptions-changed', loadOrUnloadExternalUserDbsDebounced)

        // DISABLED
        // we may not use these anymore
        // -prf
        // let accountEntry = await privateServerDb.accounts.get(user.value.username)
        // let privateDb = new PrivateCitizenDB(userId, hyperUrlToKey(accountEntry.value.privateDbUrl), publicServerDb, publicDb)
        // await privateDb.setup()
        // privateDbs.set(userId, privateDb)
        // privateDb.on('subscriptions-changed', loadOrUnloadExternalUserDbsDebounced)

        numLoaded++
      } else if (user.value.type === 'community') {
        const userId = constructUserId(user.key)
        if (publicDbs.has(userId)) {
          console.error('Skipping db load due to duplicate userId', userId)
          return
        }
        let publicDb = new PublicCommunityDB(userId, hyperUrlToKey(user.value.dbUrl))
        await publicDb.setup()
        publicDbs.set(userId, publicDb)
        publicDb.watch(onDatabaseChange)
        publicDb.on('subscriptions-changed', loadOrUnloadExternalUserDbsDebounced)
        numLoaded++
      } else {
        issues.add(new UnknownUserTypeIssue(user))
      }
    } catch (e) {
      console.error('Failed to load database for', user.key)
      console.error(e)
    }
  }))
  console.log('Loaded', numLoaded, 'user DBs (from', users.length, 'member records)')
}

export function* getAllDbs () {
  for (let db of publicDbs) {
    yield db[1]
  }
  for (let db of privateDbs) {
    yield db[1]
  }
}

export function* getAllIndexingDbs () {
  if (publicServerDb) yield publicServerDb
  if (privateServerDb) yield privateServerDb
}

var _didIndexRecently = false // NOTE used only for tests, see whenAllSynced
export async function onDatabaseChange (changedDb, indexingDbsToUpdate = undefined) {
  const pend = perf.measure('onDatabaseChange')
  _didIndexRecently = true

  for (let indexingDb of (indexingDbsToUpdate || getAllIndexingDbs())) {
    let subscribedUrls = await indexingDb.getSubscribedDbUrls()
    if (!subscribedUrls.includes(changedDb.url)) continue
    await indexingDb.updateIndexes({changedDb})
  }

  pend()
}

export async function catchupAllIndexes () {
  for (let indexingDb of getAllIndexingDbs()) {
    await catchupIndexes(indexingDb)
  }
}

export async function catchupIndexes (indexingDb, dbsToCatchup = undefined) {
  const pend = perf.measure('catchupIndexes')
  _didIndexRecently = true
  if (!Array.from(getAllIndexingDbs()).includes(indexingDb)) {
    pend()
    return
  }
  let subscribedUrls = dbsToCatchup ? dbsToCatchup.map(db => db.url) : await indexingDb.getSubscribedDbUrls()
  for (let changedDb of (dbsToCatchup || getAllDbs())) {
    if (!subscribedUrls.includes(changedDb.url)) {
      continue
    }
    await indexingDb.updateIndexes({changedDb})
  }
  pend()
}

// NOTE
// this method should only be used for tests
export async function whenAllSynced () {
  for (let db of getAllDbs()) {
    await db.whenSynced()
  }
  while (_didIndexRecently) {
    _didIndexRecently = false
    await new Promise(r => setTimeout(r, 100))
  }
}

export function getDbByUrl (url) {
  if (publicServerDb.url === url) return publicServerDb
  if (privateServerDb.url === url) return privateServerDb
  for (let db of publicDbs.values()) {
    if (db.url === url) return db
  }
  for (let db of privateDbs.values()) {
    if (db.url === url) return db
  }
}

export function getDbByDkey (dkey) {
  if (publicServerDb.discoveryKey.toString('hex') === dkey) return publicServerDb
  if (privateServerDb.discoveryKey.toString('hex') === dkey) return privateServerDb
  for (let db of publicDbs.values()) {
    if (db.discoveryKey.toString('hex') === dkey) return db
  }
  for (let db of privateDbs.values()) {
    if (db.discoveryKey.toString('hex') === dkey) return db
  }
}

async function loadDbByType (userId, dbUrl) {
  const key = hyperUrlToKey(dbUrl)
  const bee = new Hyperbee(client.corestore().get(key), {
    keyEncoding: 'utf8',
    valueEncoding: 'json'
  })
  await bee.ready()
  client.replicate(bee.feed)

  const dbDesc = await bee.get('_db', {wait: true, timeout: 60e3})
  if (!dbDesc) throw new Error('Failed to load database description')
  if (dbDesc.value?.dbType === 'ctzn.network/public-citizen-db') {
    return new PublicCitizenDB(userId, key) 
  } else if (dbDesc.value?.dbType === 'ctzn.network/public-community-db') {
    return new PublicCommunityDB(userId, key) 
  } else if (dbDesc.value?.dbType === 'ctzn.network/public-server-db') {
    return new PublicServerDB(userId, key)
  }
  throw new Error(`Unknown database type: ${dbDesc.value?.dbType}`)
}

async function getAllExternalDbIds () {
  const userIdEnding = `@${getDomain()}`
  const ids = new Set()
  for (let db of publicDbs.values()) {
    if (!db.writable) continue
    if (db.dbType === 'ctzn.network/public-citizen-db') {
      const [follows, memberships] = await Promise.all([
        db.follows.list(),
        db.memberships.list()
      ])
      for (let follow of follows) {
        if (!follow.value.subject.userId.endsWith(userIdEnding)) {
          ids.add(getServerIdForUserId(follow.value.subject.userId))
          ids.add(follow.value.subject.userId)
        }
      }
      for (let membership of memberships) {
        if (!membership.value.community.userId.endsWith(userIdEnding)) {
          ids.add(getServerIdForUserId(membership.value.community.userId))
          ids.add(membership.value.community.userId)
        }
      }
    } else if (db.dbType === 'ctzn.network/public-community-db') {
      const members = await db.members.list()
      for (let member of members) {
        if (!member.value.user.userId.endsWith(userIdEnding)) {
          ids.add(getServerIdForUserId(member.value.user.userId))
          ids.add(member.value.user.userId)
        }
      }
    }
  }
  return Array.from(ids)
}

let _loadExternalDbPromises = {}
export async function loadExternalDb (userId) {
  if (_loadExternalDbPromises[userId]) {
    return _loadExternalDbPromises[userId]
  }
  const done = () => {
    delete _loadExternalDbPromises[userId]
  }
  _loadExternalDbPromises[userId] = loadExternalDbInner(userId)
  _loadExternalDbPromises[userId].then(done, done)
  return _loadExternalDbPromises[userId]
}
async function loadExternalDbInner (userId) {
  let dbUrl, publicDb
  try {
    dbUrl = await fetchDbUrl(userId)
  } catch (e) {
    issues.add(new LoadExternalUserDbIssue({userId, cause: 'Failed to lookup DNS ID', error: e}))
    return false
  }
  try {
    publicDb = await loadDbByType(userId, dbUrl)
    await publicDb.setup()
    publicDbs.set(userId, publicDb)
    publicDb.watch(onDatabaseChange)
  } catch (e) {
    issues.add(new LoadExternalUserDbIssue({userId, cause: 'Failed to load the database', error: e}))
    return false
  }
  try {
    // update our local db index of url -> userid
    await privateServerDb.userDbIdx.put(dbUrl, {dbUrl, userId})
  } catch (e) {
    issues.add(new LoadExternalUserDbIssue({userId, cause: 'Failed to update our DNS-ID -> URL database', error: e}))
    return false    
  }

  return publicDb
}

async function loadOrUnloadExternalUserDbs () {
  // load any new follows
  const externalUserIds = await getAllExternalDbIds()
  for (let userId of externalUserIds) {
    if (!publicDbs.has(userId)) {
      /* dont await */ loadExternalDb(userId)
    }
  }
  // unload any unfollowed
  for (let value of publicDbs.values()) {
    const {userId} = value
    if (userId.endsWith(getDomain()) || externalUserIds.includes(userId)) {
      continue
    }
    publicDbs.get(userId).teardown({unswarm: true})
    publicDbs.delete(userId)
  }
}
const loadOrUnloadExternalUserDbsDebounced = _debounce(loadOrUnloadExternalUserDbs, 30e3)

async function sweepInactiveDbs () {
  const ts = Date.now()
  for (let db of getAllDbs()) {
    if (db.isEjectableFromMemory(ts)) {
      await db.teardown({unswarm: false})
    }
  }
}