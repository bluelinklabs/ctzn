import { assertUserPermission } from './_util.js'

export default async function (db, caller, args) {
  await assertUserPermission(db, caller.userId, 'ctzn.network/perm-manage-pages')

  const key = db.pages.schema.generateKey(args)
  const existingRecord = await db.pages.get(key)
  if (existingRecord) {
    args.createdAt = existingRecord.value.createdAt
    args.updatedAt = (new Date()).toISOString()
  } else {
    args.createdAt = (new Date()).toISOString()
    args.updatedAt = undefined
  }
  await db.pages.put(key, {
    id: args.id,
    title: args.title,
    content: {
      mimeType: args.content.mimeType,
      blobName: args.content.blobName
    },
    createdAt: args.createdAt,
    updatedAt: args.updatedAt
  })
  return {
    key,
    url: db.pages.constructEntryUrl(key)
  }
}