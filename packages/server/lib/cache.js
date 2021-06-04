const homeFeedCache = {}
const userFeedCache = {}

export function invalidateHomeFeed (username) {
  delete homeFeedCache[username]
}

export function getHomeFeed (username, limit) {
  let entry = homeFeedCache[username]
  if (!entry || entry.expires < Date.now() || entry.limit < limit) {
    return undefined
  }
  return entry.value
}

export function setHomeFeed (username, value, limit, ttl) {
  if (homeFeedCache[username] && limit < homeFeedCache[username].limit) {
    return
  }
  homeFeedCache[username] = {
    expires: Date.now() + ttl,
    limit,
    value
  }
}

export function invalidateUserFeed (username) {
  delete userFeedCache[username]
}

export function getUserFeed (username, limit) {
  let entry = userFeedCache[username]
  if (!entry || entry.limit < limit) {
    return undefined
  }
  return entry.value
}

export function setUserFeed (username, value, limit, ttl) {
  if (userFeedCache[username] && limit < userFeedCache[username].limit) {
    return
  }
  userFeedCache[username] = {
    limit,
    value
  }
}

export function onDatabaseChange (username, schemaId) {
  if (
    schemaId === 'ctzn.network/post' ||
    schemaId === 'ctzn.network/follow' ||
    schemaId === 'ctzn.network/profile' // changes to communities
  ) {
    invalidateHomeFeed(username)
    invalidateUserFeed(username)
  }
}