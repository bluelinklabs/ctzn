import { publicUserDbs, onDatabaseChange, loadExternalDb } from '../db/index.js'
import { constructEntryUrl, isUserIdOurs, parseUserId } from '../lib/strings.js'
import { fetchUserInfo, reverseDns, connectWs } from '../lib/network.js'
import * as errors from '../lib/errors.js'
import _pick from 'lodash.pick'

const RESULT_CHECK_INTERVAL = 5e3

export function setup (wsServer, config) {
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
    if (isUserIdOurs(value.database.userId) && getDb(value.database.userId)) {
      await onDatabaseChange(userDb)
    }

    // wait for a result
    const callUrl = constructEntryUrl(userDb.url, 'ctzn.network/dbmethod-call', key)
    const result = await getResult(value.database.userId, callUrl, userDb, opts)

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
    if (!callEntry) {
      throw new errors.NotFoundError()
    }
    const callUrl = constructEntryUrl(userDb.url, 'ctzn.network/dbmethod-call', opts.call)

    return getResult(callEntry.value.database.userId, callUrl, userDb, opts)
  })

  wsServer.register('dbmethod.remoteHandle', async ([opts], client) => {
    opts = opts && typeof opts === 'object' ? opts : {}

    // validate the server making the request is the home of the calling user
    const clientDomain = await reverseDns(client, (config.debugMode) ? () => {
      return parseUserId(opts.caller.userId).domain
    } : undefined)
    if (!opts.caller.userId.endsWith(`@${clientDomain}`)) {
      throw new errors.ConfigurationError(`Calling user's ID (${opts.caller.userId}) does not match client domain (${clientDomain})`)
    }

    const dbInfo = await fetchUserInfo(opts.database)
    const db = publicUserDbs.get(dbInfo.userId)
    if (!db?.writable) {
      throw new errors.NotFoundError('Database not hosted here')
    }
    const callerInfo = await fetchUserInfo(opts.caller)
    const callerDb = await getOrLoadDb(callerInfo.userId)
    if (!callerDb) {
      throw new errors.NotFoundError('Caller not hosted here')
    }

    await onDatabaseChange(callerDb)
  })
}

async function getResult (databaseUserId, callUrl, callerDb, opts) {
  // call remoteHandle if not local
  if (!isUserIdOurs(databaseUserId)) {
    await callRemoteHandle(databaseUserId, {dbUrl: callerDb.url, userId: callerDb.userId}, callUrl)
  }

  const targetDb = await getOrLoadDb(databaseUserId)
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

      // call remoteHandle if not local
      if (!isUserIdOurs(databaseUserId)) {
        await callRemoteHandle(databaseUserId, {dbUrl: callerDb.url, userId: callerDb.userId}, callUrl)
      }

      const resultEntry = await resultTable.get(callUrl)
      if (resultEntry) return resultEntry
    }
  }
  
  return undefined
}

async function callRemoteHandle (databaseUserId, caller, callUrl) {
  const ws = await connectWs(parseUserId(databaseUserId).domain)
  const remoteHandleOpts = {
    database: databaseUserId,
    caller,
    call: callUrl
  }
  try {
    await ws.call('dbmethod.remoteHandle', [remoteHandleOpts])
  } catch (e) {
    // ignore
  }
}

function getDb (userId) {
  const publicUserDb = publicUserDbs.get(userId)
  if (!publicUserDb) throw new Error(`User database "${userId}" not found`)
  return publicUserDb
}

async function getOrLoadDb (userId) {
  let publicUserDb = publicUserDbs.get(userId)
  if (!publicUserDb && await loadExternalDb(userId)) {
    publicUserDb = publicUserDbs.get(userId)
  }
  if (!publicUserDb) {
    throw new Error(`User database "${userId}" not found`)
  }
  return publicUserDb
}