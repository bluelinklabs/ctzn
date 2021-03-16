import { assertUserPermission } from './_util.js'

export default async function (db, caller, args) {
  await assertUserPermission(db, caller.userId, 'ctzn.network/perm-manage-item-classes')

  const release = await db.itemClasses.lock(args.classId)
  try {
    await db.itemClasses.del(args.classId)
  } finally {
    release()
  }
}