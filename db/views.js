import * as path from 'path'
import * as fs from 'fs'
import { fileURLToPath } from 'url'
import * as db from './index.js'
import { constructUserUrl, constructEntryUrl, isHyperUrl, parseEntryUrl } from '../lib/strings.js'
import { fetchUserId } from '../lib/network.js'
import * as dbGetters from './getters.js'
import * as schemas from '../lib/schemas.js'
import * as errors from '../lib/errors.js'
import { listHomeFeed } from './feed-getters.js'
import { fetchNotications, countNotications, dbGet, fetchReactions } from './util.js'

const DEFAULT_USER_AVATAR_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'static', 'img', 'default-user-avatar.jpg')
const DEFAULT_COMMUNITY_AVATAR_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'static', 'img', 'default-community-avatar.jpg')

// globals
// =

const _views = new Map()

// exported api
// =

export function getType (schemaId) {
  const view = _views.get(schemaId)
  if (!view) return undefined
  return view.schema?.schemaObject?.type
}

export async function exec (schemaId, auth, ...args) {
  const view = _views.get(schemaId)
  if (!view) {
    throw new Error(`View "${schemaId}" not found`)
  }
  view.validateParameters.assert(args)
  const res = await view.fn(auth, ...args)
  if (res) view.validateResponse.assert(res)
  return res
}

export function setup () {
  define('ctzn.network/avatar-view', async (auth, userId) => {
    let userDb
    try {
      userId = await fetchUserId(userId)
      userDb = db.publicUserDbs.get(userId)
      if (!userDb) throw 'Not found'
      
      const ptr = await userDb.blobs.getPointer('avatar')
      if (!ptr) throw 'Not found'

      return {
        ptr,
        etag: `W/block-${ptr.start}`,
        createStream: () => userDb.blobs.createReadStreamFromPointer(ptr)
      }
    } catch (e) {
      if (userDb?.dbType === 'ctzn.network/public-community-db') {
        return {
          ptr: null,
          etag: `W/default-community-avatar`,
          createStream: () => fs.createReadStream(DEFAULT_COMMUNITY_AVATAR_PATH)
        }
      } else {
        return {
          ptr: null,
          etag: `W/default-citizen-avatar`,
          createStream: () => fs.createReadStream(DEFAULT_USER_AVATAR_PATH)
        }
      }
    }
  })

  define('ctzn.network/blob-view', async (auth, userId, blobname) => {
    userId = await fetchUserId(userId)
    const userDb = db.publicUserDbs.get(userId)
    if (!userDb) throw 'Not found'
    
    const ptr = await userDb.blobs.getPointer(blobname)
    if (!ptr) throw 'Not found'

    return {
      ptr,
      etag: `W/block-${ptr.start}`,
      createStream: () => userDb.blobs.createReadStreamFromPointer(ptr)
    }
  })

  define('ctzn.network/comment-view', async (auth, userId, commentKey) => {
    if (!commentKey && isHyperUrl(userId)) {
      let {origin, schemaId, key} = parseEntryUrl(userId)
      if (schemaId !== 'ctzn.network/comment') {
        return undefined
      }
      userId = await fetchUserId(origin)
      commentKey = key
    } else {
      userId = await fetchUserId(userId)
    }
    const db = getDb(userId)
    return dbGetters.getComment(db, commentKey, userId, auth)
  })

  define('ctzn.network/community-user-permission-view', async (auth, communityId, citizenId, permId) => {
    communityId = await fetchUserId(communityId)
    citizenId = await fetchUserId(citizenId)
    const db = getDb(communityId)
    const memberRecord = await db.members.get(citizenId)
    if (!memberRecord) return undefined
    if (memberRecord.value.roles?.includes('admin')) {
      return {permId: 'ctzn.network/perm-admin'}
    }
    const roleRecords = await Promise.all(memberRecord.value.roles?.map(roleId => db.roles.get(roleId)) || [])
    for (let roleRecord of roleRecords) {
      const perm = roleRecord.value.permissions?.find(p => p.permId === permId)
      if (perm) return perm
    }
    return undefined
  })

  define('ctzn.network/community-user-permissions-view', async (auth, communityId, citizenId) => {
    communityId = await fetchUserId(communityId)
    citizenId = await fetchUserId(citizenId)
    const db = getDb(communityId)
    const memberRecord = await db.members.get(citizenId)
    if (!memberRecord) return {permissions: []}
    if (memberRecord.value.roles?.includes('admin')) {
      return {permissions: [{permId: 'ctzn.network/perm-admin'}]}
    }
    const roleRecords = await Promise.all(memberRecord.value.roles?.map(roleId => db.roles.get(roleId)) || [])
    return {permissions: roleRecords.map(roleRecord => roleRecord.value.permissions || []).flat()}
  })

  define('ctzn.network/dbmethod-calls-view', async (auth, databaseId, opts) => {
    databaseId = await fetchUserId(databaseId)
    const db = getDb(databaseId)
    const table = db.getTable('ctzn.network/dbmethod-call')
    const entries = await table.list(getListOpts(opts))
    for (let entry of entries) {
      entry.url = table.constructEntryUrl(entry.key)
      let resultUrl = constructEntryUrl(entry.value.database.dbUrl, 'ctzn.network/dbmethod-result', entry.url)
      entry.result = (await dbGet(resultUrl))?.entry
      if (entry.result) {
        entry.result.url = resultUrl
      }
    }
    return {calls: entries}
  })

  define('ctzn.network/feed-view', async (auth, opts) => {
    return {feed: await listHomeFeed(opts, auth)}
  })

  define('ctzn.network/followers-view', async (auth, userId) => {
    userId = await fetchUserId(userId)
    return dbGetters.listFollowers(userId, auth)
  })

  define('ctzn.network/notifications-view', async (auth, opts) => {
    if (!auth) throw new errors.SessionError()
    return {notifications: await fetchNotications(auth, opts)}
  })

  define('ctzn.network/notifications-cleared-at-view', async (auth) => {
    if (!auth) throw new errors.SessionError()
    const accountRecord = await db.privateServerDb.accounts.get(auth.username)
    if (!accountRecord) throw new errors.NotFoundError('User account record not found')
    return {notificationsClearedAt: accountRecord.value.notificationsClearedAt || undefined}
  })

  define('ctzn.network/notifications-count-view', async (auth, opts) => {
    if (!auth) throw new errors.SessionError()
    const privateUserDb = db.privateUserDbs.get(auth.userId)
    if (!privateUserDb) throw new errors.NotFoundError('User database not found')
    return {count: await countNotications(auth, opts)}
  })

  define('ctzn.network/reactions-to-view', async (auth, subjectUrl) => {
    const subject = await dbGet(subjectUrl).catch(e => undefined)
    const subjectEntry = subject ? subject.entry : {}
    if (subject) subjectEntry.author = {userId: subject.db.userId, dbUrl: subject.db.url}
    subjectEntry.url = subjectUrl
    const res = await fetchReactions(subjectEntry, auth?.userId)
    return {subject: res.subject, reactions: res.reactions}
  })

  define('ctzn.network/post-view', async (auth, userId, postKey) => {
    if (!postKey && isHyperUrl(userId)) {
      let {origin, schemaId, key} = parseEntryUrl(userId)
      if (schemaId !== 'ctzn.network/post') {
        return undefined
      }
      userId = await fetchUserId(origin)
      postKey = key
    } else {
      userId = await fetchUserId(userId)
    }
    const db = getDb(userId)
    return dbGetters.getPost(db, postKey, userId, auth)
  })

  define('ctzn.network/posts-view', async (auth, userId, opts) => {
    userId = await fetchUserId(userId)
    const db = getDb(userId)
    return {posts: await dbGetters.listPosts(db, getListOpts(opts), userId, auth)}
  })

  define('ctzn.network/profile-view', async (auth, userId) => {
    userId = await fetchUserId(userId)
    const db = getDb(userId)
    const profileEntry = await db.profile.get('self')
    if (!profileEntry) {
      throw new Error('User profile not found')
    }
    return {
      url: constructUserUrl(userId),
      userId: userId,
      dbUrl: db.url,
      dbType: db.dbType,
      value: profileEntry.value
    }
  })

  define('ctzn.network/thread-view', async (auth, url) => {
    return {comments: await dbGetters.getThread(url, auth)}
  })
}

// internal methods
// =

function define (schemaId, fn) {
  const schema = schemas.get(schemaId)
  if (!schema) throw new Error(`View schema "${schemaId}" not found`)
  const s = schema.schemaObject
  let validateParameters
  let validateResponse
  try {
    validateParameters = s.parameters ? schemas.createValidator(s.parameters) : {assert: noop}
    validateResponse = s.definition ? schemas.createValidator(s.definition) : {assert: noop}
  } catch (e) {
    console.error('Error while compiling view schema:', schemaId)
    console.error(e)
    process.exit(1)
  }
  _views.set(schemaId, {
    validateParameters,
    validateResponse,
    schema,
    fn
  })
}

function getListOpts (listOpts = {}) {
  const opts = {}
  if (listOpts.limit) opts.limit = listOpts.limit
  if (listOpts.lt) opts.lt = listOpts.lt
  if (listOpts.lte) opts.lte = listOpts.lte
  if (listOpts.gt) opts.gt = listOpts.gt
  if (listOpts.gte) opts.gte = listOpts.gte
  if (listOpts.reverse) opts.reverse = true
  return opts
}

function getDb (userId) {
  const publicUserDb = db.publicUserDbs.get(userId)
  if (!publicUserDb) throw new Error('User database not found')
  return publicUserDb
}

function noop () {}