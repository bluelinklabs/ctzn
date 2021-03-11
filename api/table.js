import { publicUserDbs } from '../db/index.js'
import { constructEntryUrl } from '../lib/strings.js'
import { fetchUserId } from '../lib/network.js'

export function setup (wsServer) {
  wsServer.register('table.list', async ([databaseId, schemaId, opts], client) => {
    databaseId = await fetchUserId(databaseId)
    const db = getDb(databaseId)
    const table = db.tables[schemaId]
    if (!table) throw new Error('Table not found')  
    const entries = await table.list(getListOpts(opts))
    for (let entry of entries) {
      entry.url = constructEntryUrl(db.url, schemaId, entry.key)
    }
    return {entries}
  })

  wsServer.register('table.get', async ([databaseId, schemaId, key], client) => {
    databaseId = await fetchUserId(databaseId)
    const db = getDb(databaseId)
    const table = db.tables[schemaId]
    if (!table) throw new Error('Table not found')  
    const entry = await table.get(key)
    if (entry) {
      entry.url = constructEntryUrl(db.url, schemaId, entry.key)
    }
    return entry
  })
}

function getListOpts (listOpts = {}) {
  const opts = {}
  if (typeof listOpts.limit === 'number') opts.limit = listOpts.limit
  if (typeof listOpts.lt === 'string') opts.lt = listOpts.lt
  if (typeof listOpts.lte === 'string') opts.lte = listOpts.lte
  if (typeof listOpts.gt === 'string') opts.gt = listOpts.gt
  if (typeof listOpts.gte === 'string') opts.gte = listOpts.gte
  if (listOpts.reverse) opts.reverse = true
  return opts
}

function getDb (userId) {
  const publicUserDb = publicUserDbs.get(userId)
  if (!publicUserDb) throw new Error(`User database "${userId}" not found`)
  return publicUserDb
}