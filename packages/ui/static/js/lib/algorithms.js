import * as session from './session.js'
import { chunkMapAsync } from './functions.js'

export async function getFollowedUsersCommunities ({cachedOnly} = {cachedOnly: false}) {
  const cache = getCache('followed-users-communities')
  if (cache) return cache
  if (cachedOnly) return undefined

  if (!session.myFollowing?.length) return undefined
  const followedsMemberships = await chunkMapAsync(session.myFollowing, 5, async (userId) => {
    return {
      userId,
      memberships: await session.ctzn.db(userId).table('ctzn.network/community-membership').list().catch(e => [])
    }
  })
  let communities = {}
  const skipSet = new Set(session.myCommunities.map(c => c.userId))
  for (let {userId, memberships} of followedsMemberships) {
    for (let membership of memberships) {
      const communityId = membership.value.community.userId
      if (skipSet.has(communityId)) {
        continue
      }
      communities[communityId] = communities[communityId] || {userId: communityId, members: []}
      communities[communityId].members.push(userId)
    }
  }
  const res = Object.values(communities)
  setCache('followed-users-communities', res)
  return res
}

function setCache (key, value, ttl = 60e3*60*24*3/* 3 days */) {
  localStorage.setItem(`alg-cache:${key}`, JSON.stringify({
    expires: Date.now() + ttl,
    value
  }))
}

function getCache (key) {
  try {
    const obj = JSON.parse(localStorage.getItem(`alg-cache:${key}`))
    if (obj.expires < Date.now()) return undefined
    return obj.value
  } catch (e) {
    return undefined
  }
}