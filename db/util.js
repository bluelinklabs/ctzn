import lexint from 'lexicographic-integer-encoding'
import { publicUserDbs, privateUserDbs } from '../db/index.js'
import { constructUserUrl, parseEntryUrl, hyperUrlToKeyStr } from '../lib/strings.js'
import { fetchUserId } from '../lib/network.js'

const lexintEncoder = lexint('hex')

export async function dbGet (dbUrl) {
  const urlp = new URL(dbUrl)
  const userId = await fetchUserId(`hyper://${urlp.hostname}/`)
  const db = publicUserDbs.get(userId)
  if (!db) throw new Error('User database not found')
  const pathParts = urlp.pathname.split('/').filter(Boolean)
  let bee = db.bee
  for (let i = 0; i < pathParts.length - 1; i++) {
    bee = bee.sub(decodeURIComponent(pathParts[i]))
  }
  return {
    db,
    entry: await bee.get(decodeURIComponent(pathParts[pathParts.length - 1]))
  }
}

export async function fetchAuthor (authorId, cache = undefined) {
  if (cache && cache[authorId]) {
    return cache[authorId]
  } else {
    let publicUserDb = publicUserDbs.get(authorId)
    let profileEntry
    if (publicUserDb) profileEntry = await publicUserDb.profile.get('self')
    let author = {
      url: constructUserUrl(authorId),
      userId: authorId,
      displayName: profileEntry?.value?.displayName || authorId
    }
    if (cache) cache[authorId] = author
    return author
  }
}

export async function fetchSelfIndexFollowerIds (subjectUserId, selfIdxUserId) {
  let followsIdxEntry
  if (selfIdxUserId && privateUserDbs.has(selfIdxUserId)) {
    followsIdxEntry = await privateUserDbs.get(selfIdxUserId).followsIdx.get(subjectUserId)
  }
  return followsIdxEntry?.value?.followerIds || []
}

export async function fetchCommunityIndexesFollowerIds (subjectUserId, communityMemberUserId) {
  if (!publicUserDbs.has(communityMemberUserId)) {
    return []
  }
  let followerIds = []
  const memberships = await publicUserDbs.get(communityMemberUserId).memberships.list()
  for (let membership of memberships) {
    if (!publicUserDbs.has(membership.value.community.userId)) {
      continue
    }
    followerIds.push(
      await publicUserDbs.get(membership.value.community.userId).followsIdx.get(subjectUserId).then(entry => entry?.value?.followerIds)
    )
  }
  return concatUniq(...followerIds)
}

export async function fetchVotes (subject, userIdxId = undefined) {
  let subjectInfo
  let upvoteUrls
  let downvoteUrls

  if (subject?.value?.community?.userId) {
    // fetch votes in post's community index
    let votesCommunityIdxEntry
    let votesUserIdxEntry
    if (publicUserDbs.has(subject.value.community.userId)) {
      votesCommunityIdxEntry = await publicUserDbs.get(subject.value.community.userId).votesIdx.get(subject.url)
    }
    if (userIdxId && privateUserDbs.has(userIdxId)) {
      votesUserIdxEntry = await privateUserDbs.get(userIdxId).votesIdx.get(subject.url)
    }
    subjectInfo = votesCommunityIdxEntry?.value?.subject || votesUserIdxEntry?.value?.subject
    upvoteUrls = concatUniq(votesCommunityIdxEntry?.value?.upvoteUrls, votesUserIdxEntry?.value?.upvoteUrls)
    downvoteUrls = concatUniq(votesCommunityIdxEntry?.value?.downvoteUrls, votesUserIdxEntry?.value?.downvoteUrls)
  } else {
    // fetch votes in author and authed-user indexes
    let votesAuthorIdxEntry
    let votesUserIdxEntry
    if (subject.author && privateUserDbs.has(subject.author.userId)) {
      votesAuthorIdxEntry = await privateUserDbs.get(subject.author.userId).votesIdx.get(subject.url)
    }
    if (userIdxId && userIdxId !== subject.author?.userId && privateUserDbs.has(userIdxId)) {
      votesUserIdxEntry = await privateUserDbs.get(userIdxId).votesIdx.get(subject.url)
    }
    subjectInfo = votesAuthorIdxEntry?.value?.subject || votesUserIdxEntry?.value?.subject
    upvoteUrls = concatUniq(votesAuthorIdxEntry?.value?.upvoteUrls, votesUserIdxEntry?.value?.upvoteUrls)
    downvoteUrls = concatUniq(votesAuthorIdxEntry?.value?.downvoteUrls, votesUserIdxEntry?.value?.downvoteUrls)
  }

  return {
    subject: subjectInfo || {dbUrl: subject.url},
    upvoterIds: await Promise.all(upvoteUrls.map(fetchUserId)),
    downvoterIds: await Promise.all(downvoteUrls.map(fetchUserId))
  }
}

export async function fetchReplies (subject, userIdxId = undefined) {
  if (subject?.value?.community?.userId) {
    // fetch replies in post's community index
    let threadCommunityIdxEntry
    if (publicUserDbs.has(subject.value.community.userId)) {
      threadCommunityIdxEntry = await publicUserDbs.get(subject.value.community.userId).threadIdx.get(subject.url)
    }
    return threadCommunityIdxEntry?.value.items || []
  } else {
    // fetch replies in author and authed-user indexes
    let threadAuthorIdxEntry
    let threadUserIdxEntry
    if (privateUserDbs.has(subject.author.userId)) {
      threadAuthorIdxEntry = await privateUserDbs.get(subject.author.userId).threadIdx.get(subject.url)
    }
    if (userIdxId && userIdxId !== subject.author.userId && privateUserDbs.has(userIdxId)) {
      threadUserIdxEntry = await privateUserDbs.get(userIdxId).threadIdx.get(subject.url)
    }

    // dedup
    let thread = concat(threadAuthorIdxEntry?.value.items, threadUserIdxEntry?.value.items)
    if (threadAuthorIdxEntry && threadUserIdxEntry) {
      thread = thread.filter((post, index) => {
        return thread.findIndex(post2 => post2.dbUrl === post.dbUrl) === index
      })
    }
    return thread
  }
}

export async function fetchReplyCount (subject, userIdxId = undefined) {
  const comments = await fetchReplies(subject, userIdxId)
  return comments.length
}

async function fetchNotificationsInner (userInfo, {after, before, limit} = {}) {
  let notificationEntries = []
  limit = Math.max(Math.min(limit || 20, 20), 1)

  const ltKey = before ? lexintEncoder.encode(Number(new Date(before))) : undefined
  const gtKey = after ? lexintEncoder.encode(Number(new Date(after))) : undefined
  const dbKey = hyperUrlToKeyStr(userInfo.dbUrl)

  if (privateUserDbs.has(userInfo.userId)) {
    notificationEntries = notificationEntries.concat(
      await privateUserDbs.get(userInfo.userId).notificationsIdx.list({
        lt: ltKey ? ltKey : undefined,
        gt: gtKey ? gtKey : undefined,
        limit,
        reverse: true
      })
    )
  }

  if (publicUserDbs.has(userInfo.userId)) {
    const memberships = await publicUserDbs.get(userInfo.userId).memberships.list()
    for (let membership of memberships) {
      if (!publicUserDbs.has(membership.value.community.userId)) {
        continue
      }
      notificationEntries = notificationEntries.concat(
        await publicUserDbs.get(membership.value.community.userId).notificationsIdx.list({
          lt: ltKey ? `${dbKey}:${ltKey}` : `${dbKey}:\xff`,
          gt: gtKey ? `${dbKey}:${gtKey}` : `${dbKey}:\x00`,
          limit,
          reverse: true
        })
      )
    }
  }

  notificationEntries = notificationEntries.filter((entry, index) => {
    return notificationEntries.findIndex(entry2 => entry2.value.itemUrl === entry.value.itemUrl) === index
  })
  notificationEntries.sort((a, b) => {
    let akey = a.key.includes(':') ? a.key.split(':')[1] : a.key
    let bkey = b.key.includes(':') ? b.key.split(':')[1] : b.key
    return bkey.localeCompare(akey)
  })
  if (notificationEntries.length > limit) {
    notificationEntries = notificationEntries.slice(0, limit)
  }
  return notificationEntries
}

export async function fetchNotications (userInfo, opts) {
  const notificationEntries = await fetchNotificationsInner(userInfo, opts)
  return await Promise.all(notificationEntries.map(fetchNotification))
}

export async function countNotications (userInfo, opts) {
  const notificationEntries = await fetchNotificationsInner(userInfo, opts)
  return notificationEntries.length
}

async function fetchNotification (notificationEntry) {
  const itemUrlp = parseEntryUrl(notificationEntry.value.itemUrl)
  const userId = await fetchUserId(itemUrlp.origin)
  const db = publicUserDbs.get(userId)
  let item
  if (db) {
    item = await db.getTable(itemUrlp.schemaId).get(itemUrlp.key)
  }
  return {
    itemUrl: notificationEntry.value.itemUrl,
    createdAt: notificationEntry.value.createdAt,
    blendedCreatedAt: item?.value?.createdAt
      ? (item.value.createdAt < notificationEntry.value.createdAt ? item.value.createdAt : notificationEntry.value.createdAt)
      : notificationEntry.value.createdAt,
    author: {
      userId,
      url: constructUserUrl(userId)
    },
    item: item?.value
  }
}


function concatUniq (...args){
  return Array.from(new Set(concat(...args)))
}

function concat (...args) {
  let arr = []
  for (let item of args) {
    if (item) arr = arr.concat(item)
  }
  return arr
}