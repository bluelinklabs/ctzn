import { html } from '../../vendor/lit/lit.min.js'
import { unsafeHTML } from '../../vendor/lit/directives/unsafe-html.js'
import { asyncReplace } from '../../vendor/lit/directives/async-replace.js'
import { makeSafe } from './strings.js'
import { emojify } from './emojify.js'
import * as session from './session.js'

let _activeFetches = {}
let _cache = {}

export function render (dbKey) {
  return asyncReplace(fetcher(dbKey))
}

export async function* fetcher (dbKey) {
  let userId = get(dbKey)
  if (typeof userId === 'string' && userId.trim()) {
    yield userId
    return
  }
  yield (dbKey.slice(0, 6))

  if (!_activeFetches[dbKey]) {
    _activeFetches[dbKey] = (async () => {
      let profile = await session.api.getProfile(dbKey).catch(e => undefined)
      console.log('got', profile)
      return profile?.username || (dbKey.slice(0, 6))
    })()
  }
  userId = await _activeFetches[dbKey]
  if (typeof userId === 'string' && userId.trim()) {
    yield html`${unsafeHTML(emojify(makeSafe(userId), 'w-4', '0'))}`
    set(dbKey, userId)
  }
}

export function get (dbKey) {
  if (_cache[dbKey]) return _cache[dbKey]
  return sessionStorage.getItem(`uid:${dbKey}`)
}

export function set (dbKey, userId) {
  _cache[dbKey] = userId
  sessionStorage.setItem(`uid:${dbKey}`, userId)
}
