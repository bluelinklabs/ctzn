import { assertUserPermission } from './_util.js'

export default async function (db, caller, args) {
  await assertUserPermission(db, caller.userId, 'ctzn.network/perm-community-ban')
  await db.bans.del(args.bannedUser.userId)
}