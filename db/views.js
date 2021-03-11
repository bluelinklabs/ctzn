import * as db from './index.js'
import { usernameToUserId, constructUserUrl, constructEntryUrl } from '../lib/strings.js'
import * as dbGetters from './getters.js'
import * as schemas from '../lib/schemas.js'
import * as errors from '../lib/errors.js'
import { listHomeFeed } from './feed-getters.js'
import { fetchNotications, countNotications, dbGet, fetchReactions } from './util.js'

// globals
// =

const _views = new Map()

// exported api
// =

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
  define('ctzn.network/avatar-view', async (auth, params) => {
    // TODO
    let userDb
    try {
      const userId = usernameToUserId(req.params.username)
      userDb = db.publicUserDbs.get(userId)
      if (!userDb) throw 'Not found'
      
      const ptr = await userDb.blobs.getPointer('avatar')
      if (!ptr) throw 'Not found'

      const etag = `W/block-${ptr.start}`
      if (req.headers['if-none-match'] === etag) {
        return res.status(304).end()
      }

      res.setHeader('ETag', etag)
      const s = await userDb.blobs.createReadStreamFromPointer(ptr)
      s.pipe(res)
    } catch (e) {
      if (userDb?.dbType === 'ctzn.network/public-community-db') {
        if (req.headers['if-none-match'] === `W/default-community-avatar`) {
          return res.status(304).end()
        } else {
          res.setHeader('ETag', 'W/default-community-avatar')
          return res.sendFile(DEFAULT_COMMUNITY_AVATAR_PATH)
        }
      } else {
        if (req.headers['if-none-match'] === `W/default-citizen-avatar`) {
          return res.status(304).end()
        } else {
          res.setHeader('ETag', 'W/default-citizen-avatar')
          return res.sendFile(DEFAULT_USER_AVATAR_PATH)
        }
      }
    }
  })

  define('ctzn.network/blob-view', async (auth, params) => {
    // TODO
    let userDb
    try {
      const userId = usernameToUserId(req.params.username)
      userDb = db.publicUserDbs.get(userId)
      if (!userDb) return res.status(404).end()
      
      const ptr = await userDb.blobs.getPointer(req.params.blobname)
      if (!ptr) return res.status(404).end()

      const etag = `W/block-${ptr.start}`
      if (req.headers['if-none-match'] === etag) {
        return res.status(304).end()
      }

      res.setHeader('ETag', etag)
      const s = await userDb.blobs.createReadStreamFromPointer(ptr)
      s.pipe(res)
    } catch (e) {
      return res.status(404).end()
    }
  })

  define('ctzn.network/comment-view', async (auth, userId, commentKey) => {
    userId = usernameToUserId(userId)
    const db = getDb(userId)
    return dbGetters.getComment(db, commentKey, userId)
  })

  // define('ctzn.network/community-ban-view', async (communityId, citizenId) => {
  //   communityId = usernameToUserId(communityId)
  //   citizenId = usernameToUserId(citizenId)
  //   const db = getDb(communityId)
  //   const entry = await db.bans.get(citizenId)
  //   if (entry) {
  //     entry.url = constructEntryUrl(db.url, 'ctzn.network/community-ban', entry.key)
  //   }
  //   return entry
  // })

  // define('ctzn.network/community-bans-view', async (communityId, opts) => {
  //   communityId = usernameToUserId(communityId)
  //   const db = getDb(communityId)
  //   return {bans: await dbGetters.listCommunityBans(db, getListOpts(opts))}
  // })

  define('ctzn.network/community-members-view', async (auth, communityId, opts) => {
    communityId = usernameToUserId(communityId)
    const db = getDb(communityId)
    return {members: await dbGetters.listCommunityMembers(db, getListOpts(opts))}
  })

  define('ctzn.network/community-memberships-view', async (auth, citizenId, opts) => {
    citizenId = usernameToUserId(citizenId)
    const db = getDb(citizenId)
    return {memberships: await dbGetters.listCommunityMemberships(db, getListOpts(opts))}
  })

  define('ctzn.network/community-roles-view', async (auth, communityId, opts) => {
    communityId = usernameToUserId(communityId)
    const db = getDb(communityId)
    return {roles: await dbGetters.listCommunityRoles(db, getListOpts(opts))}
  })

  define('ctzn.network/community-user-permission-view', async (auth, communityId, citizenId, permId) => {
    communityId = usernameToUserId(communityId)
    citizenId = usernameToUserId(citizenId)
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
    communityId = usernameToUserId(communityId)
    citizenId = usernameToUserId(citizenId)
    const db = getDb(communityId)
    const memberRecord = await db.members.get(citizenId)
    if (!memberRecord) return {permissions: []}
    if (memberRecord.value.roles?.includes('admin')) {
      return {permissions: [{permId: 'ctzn.network/perm-admin'}]}
    }
    const roleRecords = await Promise.all(memberRecord.value.roles?.map(roleId => db.roles.get(roleId)) || [])
    return {permissions: roleRecords.map(roleRecord => roleRecord.value.permissions || []).flat()}
  })

  define('ctzn.network/feed-view', async (auth, opts) => {
    return {feed: await listHomeFeed(opts, auth)}
  })

  // define('ctzn.network/follow-view', async (fromUserId, toUserId) => {
  //   fromUserId = usernameToUserId(fromUserId)
  //   toUserId = usernameToUserId(toUserId)
  //   const db = getDb(fromUserId)
  //   const entry = await db.follows.get(subjectId)
  //   if (entry) {
  //     entry.url = constructEntryUrl(db.url, 'ctzn.network/follow', entry.key)
  //   }
  //   return entry
  // })

  define('ctzn.network/followers-view', async (auth, userId) => {
    userId = usernameToUserId(userId)
    return dbGetters.listFollowers(userId, auth)
  })

  // define('ctzn.network/follows-by-view', async (userId, opts) => {
  //   userId = usernameToUserId(userId)
  //   const db = getDb(userId)
  //   return {follows: await dbGetters.listFollows(db, getListOpts(opts))}
  // })

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
    const privateUserDb = privateUserDbs.get(auth.userId)
    if (!privateUserDb) throw new errors.NotFoundError('User database not found')
    return {count: await countNotications(client.auth, opts)}
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
    userId = usernameToUserId(userId)
    const db = getDb(userId)
    return dbGetters.getPost(db, postKey, userId)
  })

  define('ctzn.network/posts-view', async (auth, userId, opts) => {
    userId = usernameToUserId(userId)
    const db = getDb(userId)
    return {posts: await dbGetters.listPosts(db, getListOpts(opts), userId)}
  })

  define('ctzn.network/profile-view', async (auth, userId) => {
    userId = usernameToUserId(userId)
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

  define('ctzn.network/thread-view', async (url, auth) => {
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