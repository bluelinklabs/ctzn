import createMlts from 'monotonic-lexicographic-timestamp'
import { assertUserPermission } from './_util.js'
import { blobGet } from '../util.js'
import * as errors from '../../lib/errors.js'
import { Config } from '../../lib/config.js'
import { timeoutRace } from '../../lib/functions.js'
import bytes from 'bytes'

const mlts = createMlts()

export default async function (db, caller, args) {
  let targetBlobName = args.target?.blobName
  if (targetBlobName === 'avatar' || targetBlobName === 'profile-banner' || targetBlobName.startsWith('ui:profile:')) {
    await assertUserPermission(db, caller.userId, 'ctzn.network/perm-community-edit-profile')
  } else if (targetBlobName.startsWith('ui:pages:')) {
    await assertUserPermission(db, caller.userId, 'ctzn.network/perm-manage-pages')
  } else {
    throw new Error(`Invalid blob name: "${targetBlobName}". This method only supports avatar and profile-banner, or no name (autogenerate).`)
  }

  targetBlobName = targetBlobName || mlts()

  const blob = await timeoutRace(30e3, undefined, blobGet(args.source.userId, args.source.blobName))
  if (!blob?.buf) {
    throw new Error('Failed to read blob from source database')
  }
  if (targetBlobName === 'avatar') {
    if (blob.buf.length > (Config.getActiveConfig()?.avatarSizeLimit || 0)) {
      throw new errors.ValidationError(`Your avatar image is too big! It must be smaller than ${bytes(Config.getActiveConfig().avatarSizeLimit)}.`)
    }
  } else {
    if (blob.buf.length > (Config.getActiveConfig()?.blobSizeLimit || 0)) {
      throw new errors.ValidationError(`Your image is too big! It must be smaller than ${bytes(Config.getActiveConfig().blobSizeLimit)}.`)
    }
  }
  await db.blobs.put(targetBlobName, blob.buf, {mimeType: blob.mimeType})

  return {blobName: targetBlobName}
}