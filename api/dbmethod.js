import { publicUserDbs, onDatabaseChange } from '../db/index.js'
import { constructEntryUrl } from '../lib/strings.js'
import { fetchUserInfo } from '../lib/network.js'
import * as errors from '../lib/errors.js'
import _pick from 'lodash.pick'

const RESULT_CHECK_INTERVAL = 5e3

export function setup (wsServer) {
  wsServer.register('dbmethod.call', async ([opts], client) => {
    if (!client?.auth?.userId) {
      throw new errors.SessionError()
    }
    opts = opts && typeof opts === 'object' ? opts : {}

    // generate the method-call record
    const value = {
      database: await fetchUserInfo(opts.database),
      method: opts.method,
      args: opts.args,
      createdAt: (new Date()).toISOString()
    }
    const userDb = getDb(client.auth.userId)
    const table = userDb.getTable('ctzn.network/dbmethod-call')
    const key = table.schema.generateKey(value)
    await table.put(key, value)
    await onDatabaseChange(userDb)

    // wait for a result
    const callUrl = constructEntryUrl(userDb.url, 'ctzn.network/dbmethod-call', key)
    const result = await getResult(value.database.userId, callUrl, opts)

    return {
      key,
      url: callUrl,
      result: result?.value ? _pick(result.value, ['code', 'details', 'createdAt']) : undefined
    }
  })

  wsServer.register('dbmethod.getResult', async ([opts], client) => {
    if (!client?.auth?.userId) {
      throw new errors.SessionError()
    }
    opts = opts && typeof opts === 'object' ? opts : {}

    const userDb = getDb(client.auth.userId)
    const callTable = userDb.getTable('ctzn.network/dbmethod-call')
    const callEntry = await callTable.get(opts.call)
    if (!callEntry) throw new errors.NotFoundError()
    const callUrl = constructEntryUrl(userDb.url, 'ctzn.network/dbmethod-call', opts.call)

    return getResult(callEntry.value.database.userId, callUrl, opts)
  })
}

async function getResult (databaseUserId, callUrl, opts) {
  const targetDb = getDb(databaseUserId)
  const resultTable = targetDb.getTable('ctzn.network/dbmethod-result')

  const resultEntry = await resultTable.get(callUrl)
  if (resultEntry) return resultEntry

  if (opts.wait !== false) {
    let timeout = typeof opts.timeout === 'number' ? opts.timeout : 60e3
    timeout = Math.min(Math.max(timeout, 5e3), 60e3)

    let endTime = Date.now() + timeout
    while (Date.now() < endTime) {
      // wait a moment before trying again
      await new Promise(r => setTimeout(r, RESULT_CHECK_INTERVAL))

      const resultEntry = await resultTable.get(callUrl)
      if (resultEntry) return resultEntry
    }
  }
  
  return undefined
}

function getDb (userId) {
  const publicUserDb = publicUserDbs.get(userId)
  if (!publicUserDb) throw new Error(`User database "${userId}" not found`)
  return publicUserDb
}