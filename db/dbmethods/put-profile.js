import { assertUserPermission } from './_util.js'

export default async function (db, caller, args) {
  await assertUserPermission(db, caller.userId, 'ctzn.network/perm-community-edit-profile')
  await db.profile.put('self', args)
}