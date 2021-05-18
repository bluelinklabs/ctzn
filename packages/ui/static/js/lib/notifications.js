import * as session from './session.js'

export async function getClearedAt () {
  const cached = getCache('cleared-at')
  if (typeof cached !== 'undefined') return cached
  setCache('cleared-at', cached) // "lock" by updating the cache ttl
  const res = await session.ctzn.view('ctzn.network/notifications-cleared-at-view')
  setCache('cleared-at', res?.notificationsClearedAt)
  return res?.notificationsClearedAt
}

export async function updateClearedAt () {
  await session.api.notifications.updateNotificationsClearedAt()
  setCache('cleared-at', undefined)
  setCache('unread', 0)
}

export async function countUnread () {
  const cached = getCache('unread')
  if (typeof cached !== 'undefined') return cached
  setCache('unread', undefined) // "lock" by updating the cache ttl
  const clearedAt = await getClearedAt()
  const count = (await session.ctzn.view('ctzn.network/notifications-count-view', {after: clearedAt})).count
  setCache('unread', count)
  return count
}

function setCache (key, value, ttl = 30e3/* 30 seconds */) {
  if (typeof value === 'undefined') {
    localStorage.removeItem(`notes-cache:${key}`)
  } else {
    localStorage.setItem(`notes-cache:${key}`, JSON.stringify({
      expires: Date.now() + ttl,
      value
    }))
  }
}

function getCache (key) {
  try {
    const obj = JSON.parse(localStorage.getItem(`notes-cache:${key}`))
    if (document.hasFocus() && obj.expires < Date.now()) {
      // NOTE:
      // we used the cached value if the tab isnt focused
      // ...or if it's still fresh
      // this is to reduce the number of server pings
      // -prf
      return undefined
    }
    return obj.value
  } catch (e) {
    return undefined
  }
}