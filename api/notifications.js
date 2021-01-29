import { privateUserDbs, publicServerDb, privateServerDb } from '../db/index.js'
import { createValidator } from '../lib/schemas.js'
import { hyperUrlToKey } from '../lib/strings.js'
import { fetchNotications } from '../db/util.js'

const listParam = createValidator({
  type: 'object',
  additionalProperties: false,
  properties: {
    after: {type: 'string', format: 'date-time'}
  }
})

export function setup (wsServer) {
  wsServer.register('notifications.list', async ([opts], client) => {
    if (!client?.auth) throw new Error('Must be logged in')

    opts = opts || {}
    listParam.assert(opts)
    return fetchNotications(client.auth, opts)
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

    const release = await privateServerDb.lock('accounts')
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