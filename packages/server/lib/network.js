import ip from 'ip'
import { promises as dns } from 'dns'
import { isHyperUrl, toOrigin, domainToOrigin, parseUserId, domainToWsEndpoint, usernameToUserId } from './strings.js'
import { publicDbs, privateServerDb } from '../db/index.js'
import fetch from 'node-fetch'
import { ConfigurationError } from './errors.js'

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
  const publicDb = publicDbs.get(userId)
  if (publicDb) return publicDb.url
  return webfinger(userId)
}

export async function fetchUserId (dbUrl) {
  if (!isHyperUrl(dbUrl)) {
    return usernameToUserId(dbUrl, false)
  }
  const origin = toOrigin(dbUrl)

  for (let userDb of publicDbs.values()) {
    if (userDb.url === origin) return userDb.userId
  }

  return (await privateServerDb?.userDbIdx.get(origin))?.value?.userId
}

export async function fetchUserInfo (str) {
  if (str && typeof str === 'object') {
    return str
  }

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

export async function reverseDns (client, debugHandler) {
  client.headers = client.headers || {}
  const remoteAddress = client.headers['x-forwarded-for'] || client._socket.remoteAddress

  if (ip.isPrivate(remoteAddress)) {
    if (debugHandler) {
      return debugHandler()
    }
    throw new ConfigurationError('Cannot handle reverse-DNS lookups on private IP addresses')
  }
  return dns.reverse(remoteAddress)
}

export async function connectWs (domain) {
  const ws = new WebSocketClient(domainToWsEndpoint(domain))
  await new Promise((resolve, reject) => {
    ws.once('open', resolve)
    ws.once('error', reject)
    ws.once('close', reject)
  })
  return ws
}