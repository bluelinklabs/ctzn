import { promises as fsp } from 'fs'
import * as path from 'path'
import pump from 'pump'
import concat from 'concat-stream'
import Hyperbee from 'hyperbee'
import { client } from './hyperspace.js'
import * as hyperspace from './hyperspace.js'
import { PublicServerDB, PrivateServerDB } from './server.js'
import { PublicCitizenDB, PrivateCitizenDB } from './citizen.js'
import { PublicCommunityDB } from './community.js'
import * as schemas from '../lib/schemas.js'
import { HYPER_KEY, hyperUrlToKey, constructUserId, getDomain } from '../lib/strings.js'
import { fetchDbUrl } from '../lib/network.js'
import { hashPassword } from '../lib/crypto.js'
import * as perf from '../lib/perf.js'
import * as issues from '../lib/issues.js'
import { CaseInsensitiveMap } from '../lib/map.js'
import { LoadExternalUserDbIssue } from '../lib/issues/load-external-user-db.js'
import { UnknownUserTypeIssue } from '../lib/issues/unknown-user-type.js'
import lock from '../lib/lock.js'

let _configDir = undefined
export let configPath = undefined
export let config = undefined
export let publicServerDb = undefined
export let privateServerDb = undefined
export let publicUserDbs = new CaseInsensitiveMap()
export let privateUserDbs = new CaseInsensitiveMap()

export async function setup ({configDir, hyperspaceHost, hyperspaceStorage, simulateHyperspace}) {
  await hyperspace.setup({hyperspaceHost, hyperspaceStorage, simulateHyperspace})
  await schemas.setup()
  
  _configDir = configDir
  configPath = path.join(configDir, 'dbconfig.json')
  await readDbConfig()

  publicServerDb = new PublicServerDB(config.publicServer)
  await publicServerDb.setup()
  publicServerDb.watch(onDatabaseChange)
  await catchupIndexes(publicServerDb)
  privateServerDb = new PrivateServerDB(config.privateServer, publicServerDb)
  await privateServerDb.setup()
  await catchupIndexes(privateServerDb)

  config.publicServer = publicServerDb.key.toString('hex')
  config.privateServer = privateServerDb.key.toString('hex')
  await saveDbConfig()

  await loadMemberUserDbs()
  await loadOrUnloadExternalUserDbs()
}

export async function createUser ({type, username, email, password, profile}) {
  if (type !== 'citizen' && type !== 'community') {
    throw new Error(`Invalid type "${type}": must be 'citizen' or 'community'`)
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

    if (publicUserDbs.has(userId)) {
      throw new Error('Username already in use.')
    }

    let publicUserDb
    let privateUserDb
    if (type === 'citizen') {
      publicUserDb = new PublicCitizenDB(userId, null)
      await publicUserDb.setup()
      publicUserDb.watch(onDatabaseChange)
      publicUserDb.on('subscriptions-changed', loadOrUnloadExternalUserDbs)
      await catchupIndexes(publicUserDb)
      user.dbUrl = publicUserDb.url

      privateUserDb = new PrivateCitizenDB(userId, null, publicServerDb, publicUserDb)
      await privateUserDb.setup()
      await catchupIndexes(privateUserDb)
      account.privateDbUrl = privateUserDb.url
    } else if (type === 'community') {
      publicUserDb = new PublicCommunityDB(userId, null)
      await publicUserDb.setup()
      publicUserDb.watch(onDatabaseChange)
      publicUserDb.on('subscriptions-changed', loadOrUnloadExternalUserDbs)
      user.dbUrl = publicUserDb.url
    }

    await publicUserDb.profile.put('self', profile)
    await publicServerDb.users.put(username, user)
    if (type === 'citizen') await privateServerDb.accounts.put(username, account)
    await onDatabaseChange(publicServerDb, [privateServerDb])
    
    publicUserDbs.set(userId, publicUserDb)
    if (privateUserDb) {
      privateUserDbs.set(userId, privateUserDb)
      privateUserDb.on('subscriptions-changed', loadOrUnloadExternalUserDbs)
    }
    return {privateUserDb, publicUserDb, userId}
  } finally {
    release()
  }
}

export async function deleteUser (username) {
  console.log('Deleting user:', username)
  try {
    const userId = constructUserId(username)
    if (publicUserDbs.has(userId)) {
      await publicUserDbs.get(userId).teardown()
      publicUserDbs.delete(userId)
    }
    if (privateUserDbs.has(userId)) {
      await privateUserDbs.get(userId).teardown()
      privateUserDbs.delete(userId)
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
  for (let user of users) {
    if (user.value.type === 'citizen') {
      const userId = constructUserId(user.key)
      if (publicUserDbs.has(userId)) {
        console.error('Skipping db load due to duplicate userId', userId)
        continue
      }
      let publicUserDb = new PublicCitizenDB(userId, hyperUrlToKey(user.value.dbUrl))
      await publicUserDb.setup()
      publicUserDbs.set(userId, publicUserDb)
      publicUserDb.watch(onDatabaseChange)
      publicUserDb.on('subscriptions-changed', loadOrUnloadExternalUserDbs)
      await catchupIndexes(publicUserDb)

      let accountEntry = await privateServerDb.accounts.get(user.value.username)
      let privateUserDb = new PrivateCitizenDB(userId, hyperUrlToKey(accountEntry.value.privateDbUrl), publicServerDb, publicUserDb)
      await privateUserDb.setup()
      privateUserDbs.set(userId, privateUserDb)
      privateUserDb.on('subscriptions-changed', loadOrUnloadExternalUserDbs)
      await catchupIndexes(privateUserDb)

      numLoaded++
    } else if (user.value.type === 'community') {
      const userId = constructUserId(user.key)
      if (publicUserDbs.has(userId)) {
        console.error('Skipping db load due to duplicate userId', userId)
        continue
      }
      let publicUserDb = new PublicCommunityDB(userId, hyperUrlToKey(user.value.dbUrl))
      await publicUserDb.setup()
      publicUserDbs.set(userId, publicUserDb)
      publicUserDb.watch(onDatabaseChange)
      publicUserDb.on('subscriptions-changed', loadOrUnloadExternalUserDbs)
      await catchupIndexes(publicUserDb)
      numLoaded++
    } else {
      issues.add(new UnknownUserTypeIssue(user))
    }
  }
  console.log('Loaded', numLoaded, 'user DBs (from', users.length, 'member records)')
}

export function* getAllDbs () {
  if (publicServerDb) yield publicServerDb
  if (privateServerDb) yield privateServerDb
  for (let db of publicUserDbs) {
    yield db[1]
  }
  for (let db of privateUserDbs) {
    yield db[1]
  }
}

export function* getAllIndexingDbs () {
  if (publicServerDb) yield publicServerDb
  if (privateServerDb) yield privateServerDb
  for (let db of privateUserDbs) {
    yield db[1]
  }
  for (let db of publicUserDbs) {
    if (db[1].writable) {
      yield db[1]
    }
  }
}

var _didIndexRecently = false // NOTE used only for tests, see whenAllSynced
export async function onDatabaseChange (changedDb, indexingDbsToUpdate = undefined) {
  const pend = perf.measure('onDatabaseChange')
  _didIndexRecently = true
  let lowestStart = undefined
  const dbIndexStates = {}
  for (let indexingDb of (indexingDbsToUpdate || getAllIndexingDbs())) {
    let subscribedUrls = await indexingDb.getSubscribedDbUrls()
    if (subscribedUrls.includes(changedDb.url)) {
      const indexStates = await Promise.all(
        indexingDb.indexers.map(indexer => indexer.getState(changedDb.url))
      )
      dbIndexStates[indexingDb.url] = indexStates
      
      let indexLowestStart = indexStates.reduce((acc, state) => {
        let start = state?.value?.subject?.lastIndexedSeq || 0
        if (acc === undefined) return start
        return Math.min(acc, start)
      }, undefined)
      lowestStart = lowestStart === undefined ? indexLowestStart : Math.min(lowestStart, indexLowestStart)
    }
  }
  if (lowestStart === undefined) {
    pend()
    return
  }

  const pend2 = perf.measure('createHistoryStream')
  let changes = await new Promise((resolve, reject) => {
    pump(
      changedDb.bee.createHistoryStream({gt: lowestStart}),
      concat(resolve),
      err => {
        if (err) reject(err)
      }
    )
  })
  pend2()
  if (changes.length === 0) {
    pend()
    return
  }

  for (let indexingDb of (indexingDbsToUpdate || getAllIndexingDbs())) {
    if (dbIndexStates[indexingDb.url]) {
      await indexingDb.updateIndexes({
        changedDb,
        indexStates: dbIndexStates[indexingDb.url],
        changes,
        lowestStart
      })
    }
  }
  pend()
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

    const indexStates = await Promise.all(
      indexingDb.indexers.map(indexer => indexer.getState(changedDb.url))
    )
        
    const lowestStart = indexStates.reduce((acc, state) => {
      let start = state?.value?.subject?.lastIndexedSeq || 0
      if (acc === undefined) return start
      return Math.min(acc, start)
    }, undefined) || 0

    await changedDb.whenSynced()
    const pend2 = perf.measure('createHistoryStream')
    let changes = await new Promise((resolve, reject) => {
      pump(
        changedDb.bee.createHistoryStream({gt: lowestStart}),
        concat(resolve),
        err => {
          if (err) reject(err)
        }
      )
    })
    pend2()
    if (changes.length === 0) {
      continue
    }

    await indexingDb.updateIndexes({
      changedDb,
      indexStates,
      changes,
      lowestStart
    })
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
  for (let db of publicUserDbs.values()) {
    if (db.url === url) return db
  }
  for (let db of privateUserDbs.values()) {
    if (db.url === url) return db
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

  const dbDesc = await bee.get('_db')
  if (!dbDesc) throw new Error('Failed to load database description')
  if (dbDesc.value?.dbType === 'ctzn.network/public-citizen-db') {
    return new PublicCitizenDB(userId, key) 
  } else if (dbDesc.value?.dbType === 'ctzn.network/public-community-db') {
    return new PublicCommunityDB(userId, key) 
  }
  throw new Error(`Unknown database type: ${dbDesc.value?.dbType}`)
}

async function getAllExternalDbIds () {
  const userIdEnding = `@${getDomain()}`
  const ids = new Set()
  for (let db of publicUserDbs.values()) {
    if (!db.writable) continue
    if (db.dbType === 'ctzn.network/public-citizen-db') {
      const [follows, memberships] = await Promise.all([
        db.follows.list(),
        db.memberships.list()
      ])
      for (let follow of follows) {
        if (!follow.value.subject.userId.endsWith(userIdEnding)) {
          ids.add(follow.value.subject.userId)
        }
      }
      for (let membership of memberships) {
        if (!membership.value.community.userId.endsWith(userIdEnding)) {
          ids.add(membership.value.community.userId)
        }
      }
    } else if (db.dbType === 'ctzn.network/public-community-db') {
      const members = await db.members.list()
      for (let member of members) {
        if (!member.value.user.userId.endsWith(userIdEnding)) {
          ids.add(member.value.user.userId)
        }
      }
    }
  }
  return Array.from(ids)
}

export async function loadExternalDb (userId) {
  let dbUrl, publicUserDb
  try {
    dbUrl = await fetchDbUrl(userId)
  } catch (e) {
    issues.add(new LoadExternalUserDbIssue({userId, cause: 'Failed to lookup DNS ID', error: e}))
    return false
  }
  try {
    publicUserDb = await loadDbByType(userId, dbUrl)
    await publicUserDb.setup()
    publicUserDbs.set(userId, publicUserDb)
    publicUserDb.watch(onDatabaseChange)
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

  return true
}

async function loadOrUnloadExternalUserDbs () {
  // load any new follows
  const externalUserIds = await getAllExternalDbIds()
  for (let userId of externalUserIds) {
    if (!publicUserDbs.has(userId)) {
      /* dont await */ loadExternalDb(userId)
    }
  }
  // unload any unfollowed
  for (let value of publicUserDbs.values()) {
    const {userId} = value
    if (userId.endsWith(getDomain()) || externalUserIds.includes(userId)) {
      continue
    }
    publicUserDbs.get(userId).teardown()
    publicUserDbs.delete(userId)
  }
}