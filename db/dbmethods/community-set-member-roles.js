import { assertUserPermission } from './_util.js'
import * as errors from '../../lib/errors.js'

export default async function (db, caller, args) {
  if (args.roleId === 'admin') throw new errors.PermissionsError('Cannot edit the admin role')
  await assertUserPermission(db, caller.userId, 'ctzn.network/perm-community-assign-roles')

  const release = await db.lock('members')
  try {
    let memberRecord = await db.members.get(args.member.userId)
    if (!memberRecord) throw new Error(`${args.member.userId} is not a member of this group`)
    memberRecord.value.roles = args.roles || []
    await db.members.put(args.member.userId, memberRecord.value)
  } finally {
    release()
  }

  return {
    key: args.member.userId,
    url: db.members.constructEntryUrl(args.member.userId)
  }
}