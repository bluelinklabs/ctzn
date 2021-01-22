import { isHyperUrl, toOrigin } from './strings.js'
import { userDbs, privateServerDb } from '../db/index.js'

export function fetchDbUrl (userId) {
  if (isHyperUrl(userId)) return userId
  const user = userDbs.get(userId)
  if (!user) throw new Error('User not found: ' + userId)
  return user.url
}

export async function fetchUserId (dbUrl) {
  if (!isHyperUrl(dbUrl)) return dbUrl
  const origin = toOrigin(dbUrl)
  return (await privateServerDb.userDbIdx.get(origin))?.value?.userId
}

export async function fetchUserInfo (str) {
  let dbUrl
  let userId
  if (isHyperUrl(str)) {
    dbUrl = str
    userId = await fetchUserId(str)
  } else {
    userId = str
    dbUrl = fetchDbUrl(str)
  }
  return {userId, dbUrl}
}