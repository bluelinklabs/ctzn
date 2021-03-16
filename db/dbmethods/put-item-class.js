import { assertUserPermission } from './_util.js'

export default async function (db, caller, args) {
  await assertUserPermission(db, caller.userId, 'ctzn.network/perm-manage-item-classes')

  const release = await db.itemClasses.lock(args.classId)
  try {
    let classEntry = await db.itemClasses.get(args.classId)
    await db.itemClasses.put(args.classId, {
      id: args.classId,
      keyTemplate: args.keyTemplate,
      definition: args.definition,
      createdAt: classEntry?.value?.createdAt || (new Date()).toISOString()
    })
  } finally {
    release()
  }

  return {
    key: args.classId,
    url: db.itemClasses.constructEntryUrl(args.classId)
  }
}