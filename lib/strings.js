export const HYPER_KEY = /([0-9a-f]{64})/i

let _origin = 'undefined'

export function setOrigin (origin) {
  _origin = origin
}

export function hyperUrlToKey (str) {
  let matches = HYPER_KEY.exec(str)
  return Buffer.from(matches[1], 'hex')
}

export function constructEntryPath (schemaUrl, username, key) {
  let urlp = new URL(schemaUrl)
  if (urlp.pathname.endsWith('.json')) {
    urlp.pathname = urlp.pathname.slice(0, -5)
  }
  return `/${username}/data/${urlp.hostname}${urlp.pathname}/${key}`
}

export function constructEntryUrl (schemaUrl, username, key) {
  return `${_origin}${constructEntryPath(schemaUrl, username, key)}`
}

export function constructUserUrl (username) {
  return `${_origin}/${username}`
}

export function extractUserUrl (url) {
  let urlp = new URL(url)
  return urlp.origin + urlp.pathname.split('/').slice(0, 2).join('/')
}

export function parseEntryUrl (url, {enforceOurOrigin} = {enforceOurOrigin: false}) {
  const urlp = new URL(url)
  const pathParts = urlp.pathname.split('/')
  if (enforceOurOrigin && urlp.origin !== _origin) {
    throw new Error('Must be a URL on the current server')
  }
  return {
    origin: urlp.origin,
    username: pathParts[1],
    schemaUrl: `https://${pathParts.slice(3, -1).join('/')}.json`,
    key: pathParts[pathParts.length - 1]
  }
}

export function parseUserUrl (url) {
  const urlp = new URL(url)
  return {
    username: urlp.pathname.split('/')[1]
  }
}