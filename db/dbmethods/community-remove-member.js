import { assertUserPermission } from './_util.js'
import { fetchUserInfo } from '../../lib/network.js'

export default async function (db, caller, args) {
  await assertUserPermission(db, caller.userId, 'ctzn.network/perm-community-ban')

  // (optionally) create ban record
  if (args.ban) {
    let bannedUserInfo = await fetchUserInfo(args.member.userId)
    await db.bans.put(args.member.userId, {
      bannedUser: bannedUserInfo,
      createdBy: {userId: caller.userId, dbUrl: caller.url},
      reason: args.banReason,
      createdAt: (new Date()).toISOString()
    })
  }

  const release = await db.lock('members')
  try {
    // delete member record
    await db.members.del(args.member.userId)
  } finally {
    release()
  }

  return {
    banRecord: args.ban ? {
      key: args.member.userId,
      url: db.bans.constructEntryUrl(args.member.userId)
    } : undefined
  }
}
