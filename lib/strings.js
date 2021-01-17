export const HYPER_KEY = /([0-9a-f]{64})/i

let _origin = 'undefined'

export function setOrigin (origin) {
  _origin = origin
}

export function hyperUrlToKey (str) {
  let matches = HYPER_KEY.exec(str)
  return Buffer.from(matches[1], 'hex')
}

export function constructPath (schemaUrl, username, recordkey) {
  switch (schemaUrl) {
    case 'https://ctzn.network/comment.json':
      return `/${username}/comments/${recordkey}`
    case 'https://ctzn.network/post.json':
      return `/${username}/posts/${recordkey}`
    case 'https://ctzn.network/user.json':
      return `/${username}`
  }
  throw new Error('Unable to construct path for ' + schemaUrl)
}

export function constructUrl (schemaUrl, username, recordkey) {
  return `${_origin}${constructPath(schemaUrl, username, recordkey)}`
}