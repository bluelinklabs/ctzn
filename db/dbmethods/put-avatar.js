import { assertUserPermission } from './_util.js'
import { blobGet } from '../util.js'
import * as errors from '../../lib/errors.js'
import { Config } from '../../lib/config.js'
import { timeoutRace } from '../../lib/functions.js'
import bytes from 'bytes'

export default async function (db, caller, args) {
  await assertUserPermission(db, caller.userId, 'ctzn.network/perm-community-edit-profile')
  const avatar = await timeoutRace(30e3, undefined, blobGet(args.blobSource.userId, args.blobName))
  if (!avatar?.buf) {
    throw new Error('Failed to read blob from source database')
  }
  if (avatar.buf.length > (Config.getActiveConfig()?.avatarSizeLimit || 0)) {
    throw new errors.ValidationError(`Your avatar image is too big! It must be smaller than ${bytes(Config.getActiveConfig().avatarSizeLimit)}.`)
  }
  await db.blobs.put('avatar', avatar.buf, {mimeType: avatar.mimeType})
}