import { assertUserPermission } from './_util.js'
import { fetchUserInfo } from '../../lib/network.js'

export default async function (db, caller, args) {
  await assertUserPermission(db, caller.userId, 'ctzn.network/perm-community-invite')

  const existingInviteRecord = await db.invites.get(args.invitedUser.userId)
  if (existingInviteRecord) {
    return {
      key: args.invitedUser.userId,
      url: db.invites.constructEntryUrl(args.invitedUser.userId)
    }
  }
  const invitedUserInfo = await fetchUserInfo(args.invitedUser.userId)
  await db.invites.put(args.invitedUser.userId, {
    invitedUser: invitedUserInfo,
    createdBy: {userId: caller.userId, dbUrl: caller.url},
    createdAt: (new Date()).toISOString()
  })

  return {
    key: args.invitedUser.userId,
    url: db.invites.constructEntryUrl(args.invitedUser.userId)
  }
}