import { assertUserPermission } from './_util.js'
import { blobGet } from '../util.js'
import * as errors from '../../lib/errors.js'
import { Config } from '../../lib/config.js'
import { timeoutRace } from '../../lib/functions.js'
import bytes from 'bytes'

export default async function (db, caller, args) {
  const targetBlobName = args.target.blobName
  if (targetBlobName === 'avatar' || targetBlobName === 'profile-banner') {
    await assertUserPermission(db, caller.userId, 'ctzn.network/perm-community-edit-profile')
  } else {
    throw new Error(`Invalid blob name: "${targetBlobName}". This method only supports avatar and profile-banner.`)
  }

  const blob = await timeoutRace(30e3, undefined, blobGet(args.source.userId, args.source.blobName))
  if (!blob) {
    throw new Error('Failed to read blob from source database')
  }
  if (targetBlobName === 'avatar') {
    if (blob.length > (Config.getActiveConfig()?.avatarSizeLimit || 0)) {
      throw new errors.ValidationError(`Your avatar image is too big! It must be smaller than ${bytes(Config.getActiveConfig().avatarSizeLimit)}.`)
    }
  } else {
    if (blob.length > (Config.getActiveConfig()?.blobSizeLimit || 0)) {
      throw new errors.ValidationError(`Your image is too big! It must be smaller than ${bytes(Config.getActiveConfig().blobSizeLimit)}.`)
    }
  }
  await db.blobs.put(targetBlobName, blob)
}