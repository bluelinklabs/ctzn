import { privateServerDb } from '../db/index.js'
import * as errors from '../lib/errors.js'

export function setup (define) {
  define('ctzn.network/methods/mark-notifications-read', async (auth) => {
    if (!auth) throw new errors.SessionError()

    const release = await privateServerDb.lock(`accounts:${auth.username}`)
    try {
      const accountRecord = await privateServerDb.accounts.get(auth.username)
      if (!accountRecord) throw new errors.NotFoundError('User account record not found')
      accountRecord.value.notificationsClearedAt = (new Date()).toISOString()
      await privateServerDb.accounts.put(auth.username, accountRecord.value)
      return {
        clearedAt: accountRecord.value.notificationsClearedAt
      }
    } finally {
      release()
    }
  })
}