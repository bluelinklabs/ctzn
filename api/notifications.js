import { publicUserDbs, privateUserDbs } from '../db/index.js'
import { createValidator } from '../lib/schemas.js'
import { parseEntryUrl } from '../lib/strings.js'
import { fetchUserId } from '../lib/network.js'

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
    const privateUserDb = privateUserDbs.get(client.auth.userId)
    if (!privateUserDb) throw new Error('User database not found')

    opts = opts || {}
    listParam.assert(opts)

    const notificationEntries = await privateUserDb.notificationIdx.list(opts)
    return await Promise.all(notificationEntries.map(fetchNotification))
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
