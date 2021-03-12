import { assertUserPermission } from './_util.js'
import * as errors from '../../lib/errors.js'

export default async function (db, caller, args) {
  if (args.roleId === 'admin') throw new errors.PermissionsError('Cannot edit the admin role')
  await assertUserPermission(db, caller.userId, 'ctzn.network/perm-community-manage-roles')

  const release = await db.lock('roles')
  try {
    const release2 = await db.lock('members')
    try {
      // remove role from all members
      const memberRecords = await db.members.list()
      for (let memberRecord of memberRecords) {
        if (memberRecord.value.roles?.includes(args.roleId)) {
          memberRecord.value.roles = memberRecord.value.roles.filter(r => r !== args.roleId)
          await db.members.put(memberRecord.key, memberRecord.value)
        }
      }
    } finally {
      release2()
    }

    // delete role record
    await db.roles.del(args.roleId)
  } finally {
    release()
  }
}