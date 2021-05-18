import { assertUserPermission } from './_util.js'
import _pick from 'lodash.pick'

export default async function (db, caller, args) {
  await assertUserPermission(db, caller.userId, 'ctzn.network/perm-community-update-config')
  const release = await db.communityConfig.lock()
  try {
    const configEntry = await db.communityConfig.get('self')
    const updates = _pick(args, ['joinMode'])
    const value = configEntry?.value || ({
      createdAt: (new Date()).toISOString()
    })
    value.updatedAt = (new Date()).toISOString()
    await db.communityConfig.put('self', Object.assign(value, updates))
  } finally {
    release()
  }
}