import { assertUserPermission } from './_util.js'
import * as errors from '../../lib/errors.js'
import { keyGenerators } from '../../lib/items.js'
import { publicServerDb } from '../index.js'

export default async function (db, caller, args, callMetadata) {
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

    const generateKey = keyGenerators[itemClassEntry.value.grouping]
    if (!generateKey) {
      throw new Error(`Unsupported grouping for item class: ${itemClassEntry.value.grouping}`)
    }

    const relatedTo = args.relatedTo
    if (relatedTo && !relatedTo.dbUrl.startsWith(args.recp.dbUrl)) {
      throw new Error(`Item transfers can only be related to records created by the recipient`)
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

    await db.touch()
    const batch = db.bee.batch()

    if (destKey === args.itemKey) {
      // not a divisible item, just transfer ownership
      destValue.qty = sourceItemEntry.value.qty
      // await db.items.put(destKey, destValue) TODO
      await batch.put(db.items.constructBeeKey(destKey), destValue)
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
          destItemEntry.value.qty += args.qty
          // await db.items.put(destItemEntry.key, destItemEntry.value)
          await batch.put(db.items.constructBeeKey(destItemEntry.key), destItemEntry.value)
        } else {
          // new entry
          destValue.qty = args.qty
          // await db.items.put(destKey, destValue)
          await batch.put(db.items.constructBeeKey(destKey), destValue)
        }
      } finally {
        release2()
      }

      // update source
      sourceItemEntry.value.qty -= args.qty
      if (sourceItemEntry.value.qty) {
        // await db.items.put(sourceItemEntry.key, sourceItemEntry.value)
        await batch.put(db.items.constructBeeKey(sourceItemEntry.key), sourceItemEntry.value)
      } else {
        // await db.items.del(sourceItemEntry.key)
        await batch.del(db.items.constructBeeKey(sourceItemEntry.key))
      }
    }

    await batch.flush()

    if (relatedTo) {
      let relatedToValue = {
        subject: {
          dbUrl: relatedTo.dbUrl,
          authorId: args.recp.userId
        },
        transfers: [{
          dbmethodCall: {
            dbUrl: callMetadata.url,
            authorId: caller.userId
          },
          itemClassId: destValue.classId,
          qty: args.qty,
          createdAt: (new Date()).toISOString()
        }]
      }
      const itemTfxRelationIdxTable = publicServerDb.getTable('ctzn.network/item-tfx-relation-idx')
      const relatedToKey = itemTfxRelationIdxTable.schema.generateKey(relatedToValue)
      const existingRelationsIdxEntry = await itemTfxRelationIdxTable.get(relatedToKey)
      if (existingRelationsIdxEntry) {
        existingRelationsIdxEntry.value.transfers.push(relatedToValue.transfers[0])
        relatedToValue = existingRelationsIdxEntry.value
      }
      await itemTfxRelationIdxTable.put(relatedToKey, relatedToValue)
    }

    return {
      key: destKey,
      url: db.items.constructEntryUrl(destKey)
    }
  } finally {
    release()
  }
}