import { assertUserPermission, addOwnedItemsIdx, delOwnedItemsIdx } from './_util.js'
import { onDatabaseChange } from '../index.js'
import * as errors from '../../lib/errors.js'
import { compileKeyGenerator } from '../../lib/schemas.js'

export default async function (db, caller, args) {
  const release = await db.items.lock(args.itemKey)
  try {
    const sourceItemEntry = await db.items.get(args.itemKey)
    if (!sourceItemEntry) {
      throw new errors.NotFoundError(`Item at "${args.itemKey}" not found`)
    }

    // permission check
    if (sourceItemEntry.value.owner.userId !== caller.userId) {
      await assertUserPermission(db, caller.userId, 'perm-transfer-unowned-item')
    }

    const itemClassEntry = await db.itemClasses.get(sourceItemEntry.value.classId)
    if (!itemClassEntry) {
      throw new errors.NotFoundError(`Item class "${sourceItemEntry.value.classId}" not found`)
    }

    let generateKey
    try {
      generateKey = compileKeyGenerator(itemClassEntry.value.keyTemplate)
    } catch (e) {
      throw new Error(`Failed to generate keyTemplate from item class: ${e.message}`)
    }

    const destValue = {
      classId: sourceItemEntry.value.classId,
      qty: undefined,
      properties: sourceItemEntry.value.properties,
      owner: args.recp,
      createdBy: sourceItemEntry.value.createdBy,
      createdAt: sourceItemEntry.value.createdAt
    }

    let destKey
    try {
      destKey = `${sourceItemEntry.value.classId}:${generateKey(destValue)}`
    } catch (e) {
      throw new Error(`Failed to generate key: ${e.message}`)
    }

    if (destKey === args.itemKey) {
      // not a divisible item, just transfer ownership
      destValue.qty = sourceItemEntry.value.qty
      await db.items.put(destKey, destValue)
      if (destValue.owner.dbUrl === db.url) {
        await addOwnedItemsIdx(db, destKey, db.items.constructEntryUrl(destKey))
      } else if (sourceItemEntry.value.owner.userId === db.url) {
        await delOwnedItemsIdx(db, destKey)
      }
      await onDatabaseChange(db)
      return {
        key: destKey,
        url: db.items.constructEntryUrl(destKey)
      }
    } else {
      // apply availability check
      if (sourceItemEntry.value.qty < args.qty) {
        throw new Error(`Not enough items available, attempted to transfer ${args.qty} but only have ${sourceItemEntry.value.qty}`)
      }

      // update destination
      const release2 = await db.items.lock(destKey)
      try {
        const destItemEntry = await db.items.get(destKey)
        if (destItemEntry) {
          // add to existing
          destItemEntry.qty += args.qty
          await db.items.put(destItemEntry.key, destItemEntry.value)
        } else {
          // new entry
          destValue.qty = args.qty
          await db.items.put(destKey, destValue)
          if (destValue.owner.dbUrl === db.url) {
            await addOwnedItemsIdx(db, destKey, db.items.constructEntryUrl(destKey))
          }
        }
      } finally {
        release2()
      }

      // update source
      sourceItemEntry.value.qty -= args.qty
      if (sourceItemEntry.value.qty) {
        await db.items.put(sourceItemEntry.key, sourceItemEntry.value)
      } else {
        await db.items.del(sourceItemEntry.key)
        if (sourceItemEntry.value.owner.dbUrl === db.url) {
          await delOwnedItemsIdx(db, destKey)
        }
      }

      await onDatabaseChange(db)
      return {
        key: destKey,
        url: db.items.constructEntryUrl(destKey)
      }
    }    
  } finally {
    release()
  }
}