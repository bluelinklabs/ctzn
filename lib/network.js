import { isHyperUrl, toOrigin } from './strings.js'
import { publicUserDbs, privateServerDb } from '../db/index.js'

export function fetchDbUrl (userId) {
  if (isHyperUrl(userId)) return userId
  const publicUserDb = publicUserDbs.get(userId)
  if (!publicUserDb) throw new Error('User not found: ' + userId)
  return publicUserDb.url
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