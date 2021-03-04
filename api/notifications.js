import { privateUserDbs, privateServerDb } from '../db/index.js'
import { createValidator } from '../lib/schemas.js'
import { fetchNotications, countNotications } from '../db/util.js'
import * as errors from '../lib/errors.js'

const listParam = createValidator({
  type: 'object',
  additionalProperties: false,
  properties: {
    after: {type: 'string', format: 'date-time'},
    before: {type: 'string', format: 'date-time'},
    limit: {type: 'number'}
  }
})

export function setup (wsServer) {
  wsServer.register('notifications.list', async ([opts], client) => {
    if (!client?.auth) throw new errors.SessionError()

    opts = opts || {}
    listParam.assert(opts)
    return fetchNotications(client.auth, opts)
  })

  wsServer.register('notifications.count', async ([opts], client) => {
    if (!client?.auth) throw new errors.SessionError()
    const privateUserDb = privateUserDbs.get(client.auth.userId)
    if (!privateUserDb) throw new errors.NotFoundError('User database not found')

    opts = opts || {}
    listParam.assert(opts)
    return countNotications(client.auth, opts)
  })

  wsServer.register('notifications.getNotificationsClearedAt', async ([opts], client) => {
    if (!client?.auth) throw new errors.SessionError()

    const accountRecord = await privateServerDb.accounts.get(client.auth.username)
    if (!accountRecord) throw new errors.NotFoundError('User account record not found')
    
    return accountRecord.value.notificationsClearedAt || null
  })

  wsServer.register('notifications.updateNotificationsClearedAt', async ([opts], client) => {
    if (!client?.auth) throw new errors.SessionError()

    const release = await privateServerDb.lock(`accounts:${client.auth.username}`)
    try {
      const accountRecord = await privateServerDb.accounts.get(client.auth.username)
      if (!accountRecord) throw new errors.NotFoundError('User account record not found')
      accountRecord.value.notificationsClearedAt = (new Date()).toISOString()
      await privateServerDb.accounts.put(client.auth.username, accountRecord.value)
      return accountRecord.value.notificationsClearedAt
    } finally {
      release()
    }
  })
}