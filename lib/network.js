import { isHyperUrl, toOrigin, domainToOrigin, parseUserId } from './strings.js'
import { publicUserDbs, privateServerDb } from '../db/index.js'
import fetch from 'node-fetch'

export async function webfinger (userId) {
  const userIdp = parseUserId(userId)
  const url = `${domainToOrigin(userIdp.domain)}.well-known/webfinger?resource=${userId}`
  let jrd
  try {
    jrd = await (await fetch(url)).json()
  } catch (e) {
    throw new Error('Failed to lookup userid: ' + e.message)
  }
  let href
  try {
    href = jrd.links.find(l => l.rel === 'self' && l.href.startsWith('hyper://')).href
    if (!href) throw new Error('Hyper URL not found')
  } catch (e) {
    throw new Error('Failed to read user identity document: ' + e.message)
  }
  return href
}

export async function fetchDbUrl (userId) {
  if (isHyperUrl(userId)) return userId
  const publicUserDb = publicUserDbs.get(userId)
  if (publicUserDb) return publicUserDb.url
  return webfinger(userId)
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
    dbUrl = await fetchDbUrl(str)
  }
  return {userId, dbUrl}
}