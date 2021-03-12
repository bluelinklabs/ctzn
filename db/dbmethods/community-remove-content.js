import { assertUserPermission } from './_util.js'
import { dbGet } from '../util.js'
import { parseEntryUrl } from '../../lib/strings.js'

export default async function (db, caller, args) {
  const { schemaId } = parseEntryUrl(args.contentUrl)
  if (schemaId === 'ctzn.network/post') {
    await assertUserPermission(db, caller.userId, 'ctzn.network/perm-community-remove-post')
    const feedIdxEntry = await db.feedIdx.scanFind({reverse: true}, entry => (
      entry.value.item.dbUrl === args.contentUrl
    ))
    if (!feedIdxEntry) {
      throw new Error('Unable to find post in the community feed')
    }
    await db.feedIdx.del(feedIdxEntry.key)
  } else if (schemaId === 'ctzn.network/comment') {
    await assertUserPermission(db, caller.userId, 'ctzn.network/perm-community-remove-comment')
    const res = await dbGet(args.contentUrl)
    if (!res?.entry) {
      throw new Error('Unable to lookup comment')
    }
    const threadIdxEntry = await db.threadIdx.get(res.entry.value.reply.root.dbUrl)
    if (!threadIdxEntry) {
      throw new Error('Unable to find thread the comment is a part of')
    }
    let commentIndex = threadIdxEntry.value.items?.findIndex(c => c.dbUrl === args.contentUrl)
    if (commentIndex !== -1) {
      threadIdxEntry.value.items.splice(commentIndex, 1)
      await db.threadIdx.put(threadIdxEntry.key, threadIdxEntry.value)
    } else {
      throw new Error('Unable to find comment in the thread')
    }
  } else {
    throw new Error(`Unable remove content of type "${schemaId}"`)
  }
}