import { privateServerDb } from '../db/index.js'
import * as errors from '../lib/errors.js'

export function setup (wsServer) {
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