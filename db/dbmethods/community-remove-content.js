import { assertUserPermission } from './_util.js'
import { dbGet, addPrefixToRangeOpts } from '../util.js'
import { publicServerDb } from '../index.js'
import { parseEntryUrl } from '../../lib/strings.js'

export default async function (db, caller, args) {
  const { schemaId } = parseEntryUrl(args.contentUrl)
  if (schemaId === 'ctzn.network/post') {
    await assertUserPermission(db, caller.userId, 'ctzn.network/perm-community-remove-post')
    const feedIdxEntry = await publicServerDb.feedIdx.scanFind(addPrefixToRangeOpts(db.userId, {reverse: true}), entry => (
      entry.value.item.dbUrl === args.contentUrl
    )).catch(e => undefined)
    if (!feedIdxEntry) {
      throw new Error('Unable to find post in the community feed')
    }
    await publicServerDb.feedIdx.del(feedIdxEntry.key)
  } else if (schemaId === 'ctzn.network/comment') {
    await assertUserPermission(db, caller.userId, 'ctzn.network/perm-community-remove-comment')
    const res = await dbGet(args.contentUrl)
    if (!res?.entry) {
      throw new Error('Unable to lookup comment')
    }
    const [rootRes, threadIdxEntry] = await Promise.all([
      dbGet(res.entry.value.reply.root.dbUrl),
      publicServerDb.threadIdx.get(res.entry.value.reply.root.dbUrl)
    ])
    if (!rootRes || !threadIdxEntry) {
      throw new Error('Unable to find thread the comment is a part of')
    }
    if (rootRes.entry?.value?.community?.userId !== db.userId) {
      throw new Error('Thread is not a part of this community')
    }
    let commentIndex = threadIdxEntry.value.items?.findIndex(c => c.dbUrl === args.contentUrl)
    if (commentIndex !== -1) {
      threadIdxEntry.value.items.splice(commentIndex, 1)
      await publicServerDb.threadIdx.put(threadIdxEntry.key, threadIdxEntry.value)
    } else {
      throw new Error('Unable to find comment in the thread')
    }
  } else {
    throw new Error(`Unable remove content of type "${schemaId}"`)
  }
}