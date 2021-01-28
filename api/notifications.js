import { publicUserDbs, privateUserDbs, publicServerDb, privateServerDb } from '../db/index.js'
import { createValidator } from '../lib/schemas.js'
import { parseEntryUrl, hyperUrlToKey } from '../lib/strings.js'
import { fetchUserId } from '../lib/network.js'
import lock from '../lib/lock.js'

const listParam = createValidator({
  type: 'object',
  additionalProperties: false,
  properties: {
    lt: {type: 'string'},
    lte: {type: 'string'},
    gt: {type: 'string'},
    gte: {type: 'string'},
    reverse: {type: 'boolean'},
    limit: {type: 'number'}
  }
})

export function setup (wsServer) {
  wsServer.register('notifications.list', async ([opts], client) => {
    if (!client?.auth) throw new Error('Must be logged in')

    opts = opts || {}
    listParam.assert(opts)

    const dbKey = hyperUrlToKey(client.auth.dbUrl)
    if (opts.lt || opts.lte) {
      if (opts.lt) opts.lt = `${dbKey}:${opts.lt}`
      if (opts.lte) opts.lte = `${dbKey}:${opts.lte}`
    } else {
      opts.lte = `${dbKey}:\xff`
    }
    if (opts.gt || opts.gte) {
      if (opts.gt) opts.gt = `${dbKey}:${opts.gt}`
      if (opts.gte) opts.gte = `${dbKey}:${opts.gte}`
    } else {
      opts.gte = `${dbKey}:\x00`
    }

    const notificationEntries = await publicServerDb.notificationIdx.list(opts)
    return await Promise.all(notificationEntries.map(fetchNotification))
  })

  wsServer.register('notifications.count', async ([opts], client) => {
    if (!client?.auth) throw new Error('Must be logged in')
    const privateUserDb = privateUserDbs.get(client.auth.userId)
    if (!privateUserDb) throw new Error('User database not found')

    opts = opts || {}
    listParam.assert(opts)

    const dbKey = hyperUrlToKey(client.auth.dbUrl)
    if (opts.lt || opts.lte) {
      if (opts.lt) opts.lt = `${dbKey}:${opts.lt}`
      if (opts.lte) opts.lte = `${dbKey}:${opts.lte}`
    } else {
      opts.lte = `${dbKey}:\xff`
    }
    if (opts.gt || opts.gte) {
      if (opts.gt) opts.gt = `${dbKey}:${opts.gt}`
      if (opts.gte) opts.gte = `${dbKey}:${opts.gte}`
    } else {
      opts.gte = `${dbKey}:\x00`
    }

    const notificationEntries = await publicServerDb.notificationIdx.list(opts)
    return notificationEntries.length
  })

  wsServer.register('notifications.getNotificationsClearedAt', async ([opts], client) => {
    if (!client?.auth) throw new Error('Must be logged in')

    const accountRecord = await privateServerDb.accounts.get(client.auth.username)
    if (!accountRecord) throw new Error('User account record not found')
    
    return accountRecord.value.notificationsClearedAt
  })

  wsServer.register('notifications.updateNotificationsClearedAt', async ([opts], client) => {
    if (!client?.auth) throw new Error('Must be logged in')

    const release = await lock('accounts-db')
    try {
      const accountRecord = await privateServerDb.accounts.get(client.auth.username)
      if (!accountRecord) throw new Error('User account record not found')
      accountRecord.value.notificationsClearedAt = (new Date()).toISOString()
      await privateServerDb.accounts.put(client.auth.username, accountRecord.value)
      return accountRecord.value.notificationsClearedAt
    } finally {
      release()
    }
  })
}

async function fetchNotification (notificationEntry) {
  const itemUrlp = parseEntryUrl(notificationEntry.value.itemUrl)
  const userId = await fetchUserId(itemUrlp.origin)
  const db = publicUserDbs.get(userId)
  let item
  if (db) {
    item = await db.getTable(itemUrlp.schemaId).get(itemUrlp.key)
  }
  return {
    itemUrl: notificationEntry.value.itemUrl,
    createdAt: notificationEntry.value.createdAt,
    author: {
      userId
    },
    item: item?.value
  }
}
