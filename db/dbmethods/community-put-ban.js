import { assertUserPermission } from './_util.js'
import { fetchUserInfo } from '../../lib/network.js'

export default async function (db, caller, args) {
  await assertUserPermission(db, caller.userId, 'ctzn.network/perm-community-ban')

  const exstingBanRecord = await db.bans.get(args.bannedUser.userId)
  const bannedUserInfo = await fetchUserInfo(args.bannedUser.userId)
  await db.bans.put(args.bannedUser.userId, {
    bannedUser: bannedUserInfo,
    createdBy: {userId: caller.userId, dbUrl: caller.url},
    reason: args.reason,
    createdAt: exstingBanRecord?.value?.createdAt || (new Date()).toISOString()
  })

  return {
    key: args.bannedUser.userId,
    url: db.bans.constructEntryUrl(args.bannedUser.userId)
  }
}