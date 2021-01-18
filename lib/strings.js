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
  return `/${username}/data?schema=${schemaUrl}&key=${key}`
}

export function constructEntryUrl (schemaUrl, username, key) {
  return `${_origin}${constructEntryPath(schemaUrl, username, key)}`
}

export function parseEntryUrl (url) {
  const urlp = new URL(url)
  return {
    username: urlp.pathname.split('/')[1],
    schemaUrl: urlp.searchParams.get('schema'),
    key: urlp.searchParams.get('key')
  }
}