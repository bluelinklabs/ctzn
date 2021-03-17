import * as errors from '../../lib/errors.js'

export async function assertUserPermission (publicCommunityDb, userId, permId) {
  const memberRecord = await publicCommunityDb.members.get(userId)
  if (!memberRecord?.value?.roles?.length) throw new errors.PermissionsError(`Permission denied: ${permId}`)
  const roles = memberRecord.value.roles
  if (roles.includes('admin')) {
    return true
  }
  let roleRecords = (await publicCommunityDb.roles.list()).filter(r => roles.includes(r.value.roleId))
  for (let roleRecord of roleRecords) {
    if (roleRecord.value.permissions?.find(p => p.permId === permId)) {
      return true
    }
  }
  throw new errors.PermissionsError(`Permission denied: ${permId}`)
}

export async function addOwnedItemsIdx (db, itemKey, itemUrl) {
  const key = `${db.userId}:${itemKey}`
  await db.ownedItemsIndex.put(key, {
    item: {
      key: itemKey,
      userId: db.userId,
      dbUrl: itemUrl
    },
    createdAt: (new Date()).toISOString()
  })
}

export async function delOwnedItemsIdx (db, itemKey) {
  const key = `${db.userId}:${itemKey}`
  await db.ownedItemsIndex.del(key)
}