import lexint from 'lexicographic-integer-encoding'
import { publicServerDb, publicDbs, loadExternalDb } from '../db/index.js'
import { constructUserUrl, parseEntryUrl, hyperUrlToKeyStr } from '../lib/strings.js'
import { debugLog } from '../lib/debug-log.js'

const lexintEncoder = lexint('hex')
const SEP = Buffer.from([0])
const MIN = SEP
const MAX = Buffer.from([255])

export async function dbGet (dbUrl, opts = undefined) {
  debugLog.dbCall('dbGet', undefined, undefined, dbUrl)
  const wait = typeof opts?.wait === 'boolean' ? opts.wait : true
  const urlp = new URL(dbUrl)
  const dbKey = urlp.hostname
  let db = publicDbs.get(dbKey)
  if (!db) {
    if (opts?.noLoadExternal) {
      throw new Error(`Database "${dbKey}" not found`)
    }
    db = await loadExternalDb(dbKey)
    if (!db) {
      throw new Error(`Database "${dbKey}" not found`)
    }
  }
  const pathParts = urlp.pathname.split('/').filter(Boolean)
  await db.touch()
  let bee = db.bee
  for (let i = 0; i < pathParts.length - 1; i++) {
    bee = bee.sub(decodeURIComponent(pathParts[i]))
  }
  debugLog.dbCall('bee.get', db._ident, urlp.pathname)
  return {
    db,
    entry: await bee.get(decodeURIComponent(pathParts[pathParts.length - 1]), {wait})
  }
}

export async function blobGet (dbKey, blobName, opts = undefined) {
  debugLog.dbCall('blobGet', dbKey, undefined, blobName)
  if (typeof opts === 'string') {
    opts = {encoding: opts}
  }
  if (!blobName) throw new Error('Must specify a blob name')
  let db = publicDbs.get(dbKey)
  if (!db) {
    if (opts?.noLoadExternal) {
      throw new Error(`Database "${dbKey}" not found`)
    }
    db = await loadExternalDb(dbKey)
  }
  return db.blobs.get(blobName, opts?.encoding)
}

export async function fetchAuthor (dbKey, cache = undefined) {
  if (cache && cache[dbKey]) {
    return cache[dbKey]
  } else {
    let publicDb = publicDbs.get(dbKey)
    let profileEntry
    if (publicDb) profileEntry = await publicDb.profile.get('self')
    let author = {
      dbKey: dbKey,
      displayName: profileEntry?.value?.displayName
    }
    if (cache) cache[dbKey] = author
    return author
  }
}

export async function fetchIndexedFollowerIds (subjectDbKey) {
  const followsIdxEntry = await publicServerDb.followsIdx.get(subjectDbKey)
  return followsIdxEntry?.value?.followerDbKeys || []
}

export async function fetchReactions (subject) {
  const reactionsIdxEntry = await publicServerDb.reactionsIdx.get(subject.url)

  // go from {reaction: [urls]} to [reaction,[dbKeys]]
  let reactionsIdsPairs
  if (reactionsIdxEntry?.value?.reactions) {
    reactionsIdsPairs = await Promise.all(
      Object.entries(reactionsIdxEntry.value.reactions).map(async ([reaction, urls]) => {
        return [
          reaction,
          (await Promise.all(urls.map(hyperUrlToKeyStr))).filter(Boolean)
        ]
      })
    )
  }

  return {
    subject: reactionsIdxEntry?.value?.subject || {dbUrl: subject.url},
    reactions: reactionsIdsPairs ? Object.fromEntries(reactionsIdsPairs) : {}
  }
}

export async function fetchReplies (subject) {
  const threadIdxEntry = await publicServerDb.threadIdx.get(subject.url)
  return threadIdxEntry?.value.items || []
}

export async function fetchReplyCount (subject) {
  const comments = await fetchReplies(subject)
  return comments.length
}

async function fetchNotificationsInner (userInfo, {lt, gt, after, before, limit} = {}) {
  let notificationEntries = []
  limit = Math.max(Math.min(limit || 20, 20), 1)

  const ltKey = lt ? lt : before ? lexintEncoder.encode(Number(new Date(before))) : undefined
  const gtKey = gt ? gt : after ? lexintEncoder.encode(Number(new Date(after))) : undefined

  notificationEntries = await publicServerDb.notificationsIdx.list({
    lt: ltKey ? `${userInfo.dbKey}:${ltKey}` : `${userInfo.dbKey}:\xff`,
    gt: gtKey ? `${userInfo.dbKey}:${gtKey}` : `${userInfo.dbKey}:\x00`,
    limit,
    reverse: true
  })
  return notificationEntries
}

export async function fetchNotications (userInfo, opts) {
  const notificationEntries = await fetchNotificationsInner(userInfo, opts)
  return (await Promise.all(notificationEntries.map(fetchNotification))).filter(Boolean)
}

export async function countNotications (userInfo, opts) {
  const notificationEntries = await fetchNotificationsInner(userInfo, opts)
  return notificationEntries.length
}

export function addPrefixToRangeOpts (prefix, opts) {
  opts = Object.assign({}, opts || {})
  if (opts.lt || opts.lte) {
    if (opts.lt) opts.lt = `${prefix}:${opts.lt}`
    if (opts.lte) opts.lte = `${prefix}:${opts.lte}`
  } else {
    opts.lt = `${prefix}:\xff`
  }
  if (opts.gt || opts.gte) {
    if (opts.gt) opts.gt = `${prefix}:${opts.gt}`
    if (opts.gte) opts.gte = `${prefix}:${opts.gte}`
  } else {
    opts.gt = `${prefix}:\x00`
  }
  return opts
}

async function fetchNotification (notificationEntry) {
  const itemUrlp = parseEntryUrl(notificationEntry.value.itemUrl)
  const dbKey = itemUrlp.hostname
  if (!dbKey) return undefined
  const db = publicDbs.get(dbKey)
  let item
  if (db) {
    try {
      item = await db.getTable(itemUrlp.schemaId).get(itemUrlp.key)
    } catch (e) {}
  }
  return {
    key: notificationEntry.key.includes(':') ? notificationEntry.key.split(':')[1] : notificationEntry.key,
    itemUrl: notificationEntry.value.itemUrl,
    createdAt: notificationEntry.value.createdAt,
    blendedCreatedAt: item?.value?.createdAt
      ? (item.value.createdAt < notificationEntry.value.createdAt ? item.value.createdAt : notificationEntry.value.createdAt)
      : notificationEntry.value.createdAt,
    author: {
      dbKey
    },
    item: item?.value
  }
}

function pathToKey (segments) {
  var arr = new Array((segments.length * 2) - 1)
  for (let i = 0; i < segments.length; i++) {
    arr[i * 2] = Buffer.from(segments[i], 'utf8')
    if (i < segments.length - 1) arr[i * 2 + 1] = SEP
  }
  return Buffer.concat(arr)
}

function keyToPath (key, asArray = false) {
  var start = 0
  var arr = []
  for (let i = 0; i < key.length; i++) {
    if (key[i] === 0) {
      arr.push(key.slice(start, i).toString('utf8'))
      start = i + 1
    }
  }
  if (start < key.length) {
    arr.push(key.slice(start).toString('utf8'))
  }
  return asArray ? arr : arr.join('/')
}

function isArrayEqual (a, b) {
  if (a?.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

export async function beeShallowList (bee, path) {
  if (typeof path === 'string') {
    path = path.split('/').filter(Boolean)
  }

  var arr = []
  var pathlen = path && path.length > 0 ? path.length : 0
  var bot = pathlen > 0 ? Buffer.concat([pathToKey(path), SEP, MIN]) : MIN
  var top = pathlen > 0 ? Buffer.concat([pathToKey(path), SEP, MAX]) : MAX
  do {
    let item = await bee.peek({gt: bot, lt: top})
    if (!item) return arr

    let itemPath = keyToPath(Buffer.from(item.key, 'utf8'), true)
    if (itemPath.length > pathlen + 1) {
      let containerPath = itemPath.slice(0, pathlen + 1)
      if (arr.length && isArrayEqual(containerPath, arr[arr.length - 1].path)) {
        return arr
      }
      arr.push({path: containerPath, isContainer: true})
      bot = Buffer.concat([pathToKey(containerPath), SEP, MAX])
    } else {
      arr.push({path: itemPath, isContainer: false, value: item.value})
      bot = pathToKey(itemPath)
    }
  } while (true)
}