import { assertUserPermission } from './_util.js'
import * as errors from '../../lib/errors.js'
import _pick from 'lodash.pick'
import createMlts from 'monotonic-lexicographic-timestamp'
import { blobGet } from '../util.js'
import { Config } from '../../lib/config.js'
import { timeoutRace } from '../../lib/functions.js'
import bytes from 'bytes'

const mlts = createMlts()

export default async function (db, caller, args) {
  await assertUserPermission(db, caller.userId, 'ctzn.network/perm-manage-item-classes')

  const release = await db.itemClasses.lock(args.classId)
  try {
    let classEntry = await db.itemClasses.get(args.classId)
    if (classEntry) {
      throw new Error(`Item class "${args.classId}" already exists`)
    }

    let blobName
    if (args.iconSource) {
      const blob = await timeoutRace(30e3, undefined, blobGet(args.iconSource.userId, args.iconSource.blobName))
      if (!blob) {
        throw new Error('Failed to read blob from source database')
      }
      if (blob.length > (Config.getActiveConfig()?.blobSizeLimit || 0)) {
        throw new errors.ValidationError(`Your image is too big! It must be smaller than ${bytes(Config.getActiveConfig().blobSizeLimit)}.`)
      }
      blobName = mlts()
      await db.blobs.put(blobName, blob)
    }

    await db.itemClasses.put(args.classId, {
      id: args.classId,
      keyTemplate: args.keyTemplate,
      displayName: args.displayName,
      description: args.description,
      iconBlobName: blobName,
      definition: args.definition,
      createdAt: classEntry?.value?.createdAt || (new Date()).toISOString()
    })
  } finally {
    release()
  }

  return {
    key: args.classId,
    url: db.itemClasses.constructEntryUrl(args.classId)
  }
}