import { html } from '../../vendor/lit/lit.min.js'
import { unsafeHTML } from '../../vendor/lit/directives/unsafe-html.js'
import { asyncReplace } from '../../vendor/lit/directives/async-replace.js'
import { makeSafe } from './strings.js'
import { emojify } from './emojify.js'
import * as session from './session.js'

let _activeFetches = {}
let _cache = {}

export function render (userId) {
  return asyncReplace(fetcher(userId))
}

export async function* fetcher (userId) {
  let displayName = get(userId)
  if (typeof displayName === 'string' && displayName.trim()) {
    yield displayName
    return
  }
  yield userId

  if (!_activeFetches[userId]) {
    _activeFetches[userId] = (async () => {
      let profile = await session.ctzn.getProfile(userId).catch(e => undefined)
      return profile?.value?.displayName || userId
    })()
  }
  displayName = await _activeFetches[userId]
  if (typeof displayName === 'string' && displayName.trim()) {
    yield html`${unsafeHTML(emojify(makeSafe(displayName), 'w-4', '0'))}`
    set(userId, displayName)
  }
}

export function get (userId) {
  if (_cache[userId]) return _cache[userId]
  return sessionStorage.getItem(`dn:${userId}`)
}

export function set (userId, displayName) {
  _cache[userId] = displayName
  sessionStorage.setItem(`dn:${userId}`, displayName)
}
