import { assertUserPermission } from './_util.js'
import * as errors from '../../lib/errors.js'

export default async function (db, caller, args) {
  if (args.roleId === 'admin') throw new errors.PermissionsError('Cannot edit the admin role')
  await assertUserPermission(db, caller.userId, 'ctzn.network/perm-community-manage-roles')

  const release = await db.lock('roles')
  try {
    let roleEntry = await db.roles.get(args.roleId)
    await db.roles.put(args.roleId, {
      roleId: args.roleId,
      permissions: args.permissions,
      createdAt: roleEntry?.value?.createdAt || (new Date()).toISOString()
    })
  } finally {
    release()
  }

  return {
    key: args.roleId,
    url: db.roles.constructEntryUrl(args.roleId)
  }
}
