import lexint from 'lexicographic-integer-encoding'
import { publicServerDb, publicUserDbs, privateUserDbs } from '../db/index.js'
import { constructUserUrl, parseEntryUrl, hyperUrlToKeyStr } from '../lib/strings.js'
import { fetchUserId } from '../lib/network.js'

const lexintEncoder = lexint('hex')

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

export async function fetchFollowerIds (subjectUserId, userIdxId = undefined) {
  let followsServerIdxEntry
  let followsUserIdxEntry
  try {
    followsServerIdxEntry = await publicServerDb.followsIdx.get(subjectUserId)
    if (userIdxId && privateUserDbs.has(userIdxId)) {
      followsUserIdxEntry = await privateUserDbs.get(userIdxId).followsIdx.get(subjectUserId)
    }
  } catch (e) {}
  return concatUniq(followsServerIdxEntry?.value?.followerIds, followsUserIdxEntry?.value?.followerIds)
}

export async function fetchVotes (subject, userIdxId = undefined) {
  let votesServerIdxEntry
  let votesUserIdxEntry
  votesServerIdxEntry = await publicServerDb.votesIdx.get(subject.url)
  if (userIdxId && privateUserDbs.has(userIdxId)) {
    votesUserIdxEntry = await privateUserDbs.get(userIdxId).votesIdx.get(subject.url)
  }

  const upvoteUrls = concatUniq(votesServerIdxEntry?.value?.upvoteUrls, votesUserIdxEntry?.value?.upvoteUrls)
  const downvoteUrls = concatUniq(votesServerIdxEntry?.value?.downvoteUrls, votesUserIdxEntry?.value?.downvoteUrls)
  return {
    upvoterIds: await Promise.all(upvoteUrls.map(fetchUserId)),
    downvoterIds: await Promise.all(downvoteUrls.map(fetchUserId))
  }
}

export async function fetchComments (subject, userIdxId = undefined) {
  let commentsServerIdxEntry
  let commentsUserIdxEntry
  
  commentsServerIdxEntry = await publicServerDb.commentsIdx.get(subject.url)
  if (userIdxId && privateUserDbs.has(userIdxId)) {
    commentsUserIdxEntry = await privateUserDbs.get(userIdxId).commentsIdx.get(subject.url)
  }

  const commentUrls = concatUniq(commentsServerIdxEntry?.value.commentUrls, commentsUserIdxEntry?.value.commentUrls)
  return commentUrls
}

export async function fetchCommentCount (subject, userIdxId = undefined) {
  const commentUrls = await fetchComments(subject, userIdxId)
  return commentUrls.length
}

export async function fetchNotications (userInfo, {after} = {}) {
  let notificationServerIdxEntries
  let notificationUserIdxEntries

  const ltKey = after ? lexintEncoder.encode(Number(new Date(after))) : undefined
  const dbKey = hyperUrlToKeyStr(userInfo.dbUrl)
  notificationServerIdxEntries = await publicServerDb.notificationIdx.list({
    lt: after ? `${dbKey}:${ltKey}` : `${dbKey}:\xff`,
    gte: `${dbKey}:\x00`,
    limit: 20,
    reverse: true
  })
  if (privateUserDbs.has(userInfo.userId)) {
    notificationUserIdxEntries = await privateUserDbs.get(userInfo.userId).notificationsIdx.list({
      lt: after ? ltKey : undefined,
      limit: 20,
      reverse: true
    })
  }

  let notificationEntries = concat(notificationServerIdxEntries, notificationUserIdxEntries)
  notificationEntries = notificationEntries.filter((entry, index) => {
    return notificationEntries.findIndex(entry2 => entry2.value.itemUrl === entry.value.itemUrl) === index
  })
  return await Promise.all(notificationEntries.map(fetchNotification))
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
    author: {
      userId
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