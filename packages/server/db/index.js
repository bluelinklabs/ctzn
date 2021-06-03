import { promises as fsp } from 'fs'
import * as path from 'path'
import _debounce from 'lodash.debounce'
import { client } from './hyperspace.js'
import Hyperbee from 'hyperbee'
import * as hyperspace from './hyperspace.js'
import { PublicServerDB, PrivateServerDB } from './server.js'
import { PublicUserDB, PrivateUserDB } from './user.js'
import * as diskusageTracker from './diskusage-tracker.js'
import * as schemas from '../lib/schemas.js'
import * as views from './views.js'
import { RESERVED_USERNAMES, HYPER_KEY, hyperUrlToKey, isHyperKey } from '../lib/strings.js'
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

  publicServerDb = new PublicServerDB(config.publicServer, 'server')
  await publicServerDb.setup()
  publicDbs.set(publicServerDb.dbKey, publicServerDb)
  publicDbs.set(publicServerDb.username, publicServerDb)
  publicServerDb.watch(onDatabaseChange)
  privateServerDb = new PrivateServerDB(config.privateServer, publicServerDb)
  await privateServerDb.setup()
  privateDbs.set(publicServerDb.dbKey, privateServerDb)
  privateDbs.set(publicServerDb.username, privateServerDb)

  config.publicServer = publicServerDb.dbKey.toString('hex')
  config.privateServer = privateServerDb.dbKey.toString('hex')
  await saveDbConfig()

  views.setup()
  await loadMemberUserDbs()
  await loadOrUnloadExternalUserDbsDebounced()
  /* dont await */ catchupAllIndexes()

  scheduleIndexExternalDb()
  const sweepInterval = setInterval(sweepInactiveDbs, SWEEP_INACTIVE_DBS_INTERVAL)
  sweepInterval.unref()
}

export async function createUser ({type, username, email, password, profile}) {
  if (type !== 'user') {
    throw new Error(`Invalid type "${type}": must be 'user'`)
  }
  if (RESERVED_USERNAMES.includes(username)) {
    throw new Error(`Username is reserved: ${username}`)
  }

  let release = await lock(`create-user:${username}`)
  try {
    const account = {
      email,
      hashedPassword: password ? (await hashPassword(password)) : undefined,
      privateDbKey: '0'.repeat(64)
    }
    const user = {
      type,
      username,
      dbKey: '0'.repeat(64),
      joinDate: (new Date()).toISOString(),
    }

    schemas.get('ctzn.network/profile').assertValid(profile)
    if (type === 'user') schemas.get('ctzn.network/account').assertValid(account)
    schemas.get('ctzn.network/user').assertValid(user)

    if (publicDbs.has(username)) {
      throw new Error('Username already in use.')
    }

    let publicDb
    let privateDb
    if (type === 'user') {
      publicDb = new PublicUserDB(null, username)
      await publicDb.setup()
      publicDb.watch(onDatabaseChange)
      publicDb.on('subscriptions-changed', loadOrUnloadExternalUserDbsDebounced)
      await catchupIndexes(publicDb)
      user.dbKey = publicDb.dbKey

      privateDb = new PrivateUserDB(null, username, publicServerDb, publicDb)
      await privateDb.setup()
      await catchupIndexes(privateDb)
      account.privateDbKey = privateDb.dbKey
    }

    await publicDb.profile.put('self', profile)
    await publicServerDb.users.put(username, user)
    if (type === 'user') await privateServerDb.accounts.put(username, account)
    await onDatabaseChange(publicServerDb, [privateServerDb])
    
    publicDbs.set(publicDb.dbKey, publicDb)
    publicDbs.set(username, publicDb)
    publicServerDb.memberDbKeys.add(publicDb.dbKey)
    await catchupAllIndexes([publicDb])
    if (privateDb) {
      privateDbs.set(privateDb.dbKey, privateDb)
      privateDbs.set(username, privateDb)
      privateDb.on('subscriptions-changed', loadOrUnloadExternalUserDbsDebounced)
    }
    return {privateDb, publicDb, username}
  } finally {
    release()
  }
}

export async function deleteUser (username) {
  console.log('Deleting user:', username)
  try {
    if (publicDbs.has(username)) {
      if (publicDbs.get(username).dbType === 'ctzn.network/public-server-db') {
        throw new Error('Cannot delete server database')
      }
      let {dbKey} = publicDbs.get(username)
      await publicDbs.get(username).teardown({unswarm: true})
      publicDbs.delete(username)
      publicDbs.delete(dbKey)
      publicServerDb.memberDbKeys.remove(dbKey)
    }
    if (privateDbs.has(username)) {
      let {dbKey} = publicDbs.get(username)
      await privateDbs.get(username).teardown({unswarm: true})
      privateDbs.delete(username)
      privateDbs.delete(dbKey)
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

export function getDb (dbId) {
  let db = publicDbs.get(dbId) || privateDbs.get(dbId)
  if (!db && isHyperKey(dbId)) {
    db = new PublicUserDB(Buffer.from(dbId, 'hex'))
    publicDbs.set(dbId, db)
  }
  return db
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
      if (user.value.type === 'user') {
        if (publicDbs.has(user.key)) {
          console.error('Skipping db load due to duplicate username', user.key)
          return
        }
        let publicDb = new PublicUserDB(user.value.dbKey, user.key)
        await publicDb.setup()
        publicDbs.set(publicDb.dbKey, publicDb)
        publicDbs.set(user.key, publicDb)
        publicServerDb.memberDbKeys.add(publicDb.dbKey)
        publicDb.watch(onDatabaseChange)
        publicDb.on('subscriptions-changed', loadOrUnloadExternalUserDbsDebounced)

        let accountEntry = await privateServerDb.accounts.get(user.value.username)
        let privateDb = new PrivateUserDB(accountEntry.value.privateDbKey, user.key, publicServerDb, publicDb)
        await privateDb.setup()
        privateDbs.set(user.key, privateDb)
        privateDbs.set(privateDb.dbKey, privateDb)
        privateDb.on('subscriptions-changed', loadOrUnloadExternalUserDbsDebounced)

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
  let dbs = Array.from(new Set(Array.from(publicDbs.values()).concat(Array.from(privateDbs.values()))))
  for (let db of dbs) {
    yield db
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
    await indexingDb.updateIndexes({changedDb})
  }

  pend()
}

export async function catchupAllIndexes (dbsToCatchup = undefined) {
  for (let indexingDb of getAllIndexingDbs()) {
    await catchupIndexes(indexingDb, dbsToCatchup)
  }
}

export async function catchupIndexes (indexingDb, dbsToCatchup = undefined) {
  const pend = perf.measure('catchupIndexes')
  _didIndexRecently = true
  if (!Array.from(getAllIndexingDbs()).includes(indexingDb)) {
    pend()
    return
  }
  for (let changedDb of (dbsToCatchup || getAllDbs())) {
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

async function loadDbByType (dbUrl) {
  const key = hyperUrlToKey(dbUrl)
  const bee = new Hyperbee(client.corestore().get(key), {
    keyEncoding: 'utf8',
    valueEncoding: 'json'
  })
  await bee.ready()
  client.replicate(bee.feed)

  const dbDesc = await bee.get('_db', {wait: true, timeout: 60e3})
  if (!dbDesc) throw new Error('Failed to load database description')
  if (dbDesc.value?.dbType === 'ctzn.network/public-user-db') {
    return new PublicUserDB(key)
  } else if (dbDesc.value?.dbType === 'ctzn.network/public-server-db') {
    return new PublicServerDB(key)
  }
  throw new Error(`Unknown database type: ${dbDesc.value?.dbType}`)
}

export function getAllLoadedMemberDbs () {
  return Array.from(new Set(publicDbs.values())).filter(db => db.writable)
}

export function getAllLoadedExternalDbs () {
  return Array.from(new Set(publicDbs.values())).filter(db => !db.writable)
}

async function fetchAllExternalFollowedDbKeys () {
  const dbKeys = new Set()
  for (let db of publicDbs.values()) {
    if (!db.writable) continue
    if (db.dbType === 'ctzn.network/public-user-db') {
      const follows = await db.follows.list()
      for (let follow of follows) {
        const dbKey = follow.value.subject.dbKey
        if (!publicDbs.has(dbKey) || !publicDbs.get(dbKey).writable) {
          dbKeys.add(follow.value.subject.dbKey)
        }
      }
    }
  }
  publicServerDb.memberFollowedDbKeys = dbKeys
}

let _loadExternalDbPromises = {}
export async function loadExternalDb (dbKey) {
  if (_loadExternalDbPromises[dbKey]) {
    return _loadExternalDbPromises[dbKey]
  }
  const done = () => {
    delete _loadExternalDbPromises[dbKey]
  }
  _loadExternalDbPromises[dbKey] = loadExternalDbInner(dbKey)
  _loadExternalDbPromises[dbKey].then(done, done)
  return _loadExternalDbPromises[dbKey]
}
async function loadExternalDbInner (dbKey) {
  let publicDb
  try {
    publicDb = await loadDbByType(dbKey)
    await publicDb.setup()
    publicDbs.set(dbKey, publicDb)
    await catchupAllIndexes([publicDb])
  } catch (e) {
    issues.add(new LoadExternalUserDbIssue({dbKey, cause: 'Failed to load the database', error: e}))
    return false
  }
  return publicDb
}

export async function loadOrUnloadExternalUserDbs () {
  // load any new follows
  await fetchAllExternalFollowedDbKeys()
  for (let dbKey of Array.from(publicServerDb.memberFollowedDbKeys)) {
    if (!publicDbs.has(dbKey)) {
      /* dont await */ loadExternalDb(dbKey)
    }
  }
  // unload any unfollowed
  for (let value of publicDbs.values()) {
    const {dbKey} = value
    if (!publicServerDb.memberFollowedDbKeys.has(dbKey) && !value.writable) {
      const username = publicDbs.get(dbKey).username
      publicDbs.get(dbKey).teardown({unswarm: true})
      publicDbs.delete(dbKey)
      if (username) publicDbs.delete(username) // shouldn't be the case since usernames are only given to "our" users
    }
  }
}
const loadOrUnloadExternalUserDbsDebounced = _debounce(loadOrUnloadExternalUserDbs, 30e3)

function scheduleIndexExternalDb () {
  let to = setTimeout(indexExternalDb, 5e3)
  to.unref()
}

let lastExternalDbIndexed = undefined
async function indexExternalDb () {
  const externalDbs = getAllLoadedExternalDbs()
  if (externalDbs.length) {
    let db
    if (!lastExternalDbIndexed) {
      db = externalDbs[0]
    } else {
      let i = externalDbs.indexOf(lastExternalDbIndexed)
      i++
      if (i >= externalDbs.length) i = 0
      db = externalDbs[i]
    }
    await db.optimisticRecordSync()
    await catchupAllIndexes([db])
  }

  scheduleIndexExternalDb()
}

async function sweepInactiveDbs () {
  const ts = Date.now()
  for (let db of getAllDbs()) {
    if (db.isEjectableFromMemory(ts)) {
      await db.teardown({unswarm: false})
    }
  }
}

export async function isRecordBlobCached (dbUrl, blobName) {
  const urlp = new URL(dbUrl)
  const db = publicDbs.get(urlp.hostname)
  const pathParts = urlp.pathname.split('/').filter(Boolean)
  const table = db.getTable(`${pathParts[0]}/${pathParts[1]}`)
  return await table.isBlobCached(pathParts[2], blobName)
}