const homeFeedCache = {}
const userFeedCache = {}

export function invalidateHomeFeed (userId) {
  delete homeFeedCache[userId]
}

export function getHomeFeed (userId, limit) {
  let entry = homeFeedCache[userId]
  if (!entry || entry.expires < Date.now() || entry.limit < limit) {
    return undefined
  }
  return entry.value
}

export function setHomeFeed (userId, value, limit, ttl) {
  if (homeFeedCache[userId] && limit < homeFeedCache[userId].limit) {
    return
  }
  homeFeedCache[userId] = {
    expires: Date.now() + ttl,
    limit,
    value
  }
}

export function invalidateUserFeed (userId) {
  delete userFeedCache[userId]
}

export function getUserFeed (userId, limit) {
  let entry = userFeedCache[userId]
  if (!entry || entry.limit < limit) {
    return undefined
  }
  return entry.value
}

export function setUserFeed (userId, value, limit, ttl) {
  if (userFeedCache[userId] && limit < userFeedCache[userId].limit) {
    return
  }
  userFeedCache[userId] = {
    limit,
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
    invalidateUserFeed(userId)
  }
}