import { assertUserPermission } from './_util.js'
import * as errors from '../../lib/errors.js'
import { keyGenerators } from '../../lib/items.js'

export default async function (db, caller, args) {
  await assertUserPermission(db, caller.userId, 'ctzn.network/perm-create-item')

  const itemClassEntry = await db.itemClasses.get(args.classId)
  if (!itemClassEntry) {
    throw new errors.NotFoundError(`Item class "${args.classId}" not found`)
  }

  const generateKey = keyGenerators[itemClassEntry.value.grouping]
  if (!generateKey) {
    throw new Error(`Unsupported grouping for item class: ${itemClassEntry.value.grouping}`)
  }

  const value = {
    classId: args.classId,
    qty: args.qty,
    properties: args.properties,
    owner: args.owner || {userId: db.userId, dbUrl: db.url},
    createdBy: {userId: caller.userId, dbUrl: caller.url},
    createdAt: (new Date()).toISOString()
  }

  let key
  try {
    key = `${args.classId}:${generateKey(value)}`
  } catch (e) {
    throw new Error(`Failed to generate key: ${e.message}`)
  }

  const release = await db.items.lock(key)
  try {
    const itemEntry = await db.items.get(key)
    if (itemEntry) {
      itemEntry.value.qty += value.qty
      await db.items.put(key, itemEntry.value)
    } else {
      await db.items.put(key, value)
    }
  } finally {
    release()
  }


  return {
    key,
    url: db.items.constructEntryUrl(key)
  }
}