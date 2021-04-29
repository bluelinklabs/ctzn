import { assertUserPermission } from './_util.js'

export default async function (db, caller, args) {
  await assertUserPermission(db, caller.userId, 'ctzn.network/perm-manage-pages')
  await db.pages.del(args.id)
}