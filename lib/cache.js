const homeFeedCache = {}

export function invalidateHomeFeed (userId) {
  delete homeFeedCache[userId]
}

export function getHomeFeed (userId) {
  let entry = homeFeedCache[userId]
  if (!entry || entry.expires < Date.now()) {
    return undefined
  }
  return entry.value
}

export function setHomeFeed (userId, value, ttl) {
  homeFeedCache[userId] = {
    expires: Date.now() + ttl,
    value
  }
}

export function onDatabaseChange (userId, schemaId) {
  if (
    schemaId === 'ctzn.network/post' ||
    schemaId === 'ctzn.network/follow' ||
    schemaId === 'ctzn.network/community-membership'
  ) {
    invalidateHomeFeed(userId)
  }
}