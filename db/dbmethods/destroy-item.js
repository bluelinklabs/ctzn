import { assertUserPermission, delOwnedItemsIdx } from './_util.js'
import { onDatabaseChange } from '../index.js'
import * as errors from '../../lib/errors.js'

export default async function (db, caller, args) {
  const release = await db.items.lock(args.itemKey)
  try {
    const itemEntry = await db.items.get(args.itemKey)
    if (!itemEntry) {
      throw new errors.NotFoundError(`Item at "${args.itemKey}" not found`)
    }

    // permission check
    if (itemEntry.value.owner.userId !== caller.userId) {
      await assertUserPermission(db, caller.userId, 'perm-destroy-unowned-item')
    }

    // update source
    itemEntry.value.qty -= args.qty
    if (itemEntry.value.qty) {
      await db.items.put(itemEntry.key, itemEntry.value)
    } else {
      await db.items.del(itemEntry.key)
      if (itemEntry.value.owner.dbUrl === db.url) {
        await delOwnedItemsIdx(db, itemEntry.key)
      }
    }
    await onDatabaseChange(db)
  } finally {
    release()
  }
}
