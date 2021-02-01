import createMlts from 'monotonic-lexicographic-timestamp'
import { BaseHyperbeeDB } from './base.js'
import { hyperUrlToKeyStr, constructUserId, constructEntryUrl, getDomain } from '../lib/strings.js'
import { fetchUserId } from '../lib/network.js'
import * as perf from '../lib/perf.js'

const mlts = createMlts()

export class PublicServerDB extends BaseHyperbeeDB {
  constructor (key) {
    super('public:server', key)
  }

  async setup () {
    await super.setup()
    this.indexState = this.getTable('ctzn.network/index-state')
    this.users = this.getTable('ctzn.network/user')
    this.featuredPostsIdx = this.getTable('ctzn.network/featured-post-idx')
    this.followsIdx = this.getTable('ctzn.network/follow-idx')
    this.commentsIdx = this.getTable('ctzn.network/comment-idx')
    this.notificationIdx = this.getTable('ctzn.network/notification-idx')
    this.votesIdx = this.getTable('ctzn.network/vote-idx')
    
    const NOTIFICATIONS_SCHEMAS = [
      'ctzn.network/follow',
      'ctzn.network/comment',
      'ctzn.network/vote'
    ]
    this.createIndexer('ctzn.network/notification-idx', NOTIFICATIONS_SCHEMAS, async (db, change) => {
      if (!change.value) return // ignore deletes
      const pend = perf.measure(`publicServerDb:notifications-indexer`)

      const release = await this.lock(`notifications-idx:${change.url}`)
      const createKey = url => `${hyperUrlToKeyStr(url)}:${mlts()}`
      const notification = {
        itemUrl: constructEntryUrl(db.url, change.keyParsed.schemaId, change.keyParsed.key),
        createdAt: (new Date()).toISOString()
      }
      try {
        switch (change.keyParsed.schemaId) {
          case 'ctzn.network/follow':
            if (change.value.subject.dbUrl !== db.url) {
              await this.notificationIdx.put(createKey(change.value.subject.dbUrl), notification)
            }
            break
          case 'ctzn.network/comment': {
            if (!change.value.subjectUrl.startsWith(db.url)) {
              await this.notificationIdx.put(createKey(change.value.subjectUrl), notification)
            }
            if (change.value.parentCommentUrl && !change.value.parentCommentUrl.startsWith(db.url)) {
              await this.notificationIdx.put(createKey(change.value.parentCommentUrl), notification)
            }
            break
          }
          case 'ctzn.network/vote':
            if (!change.value.subjectUrl.startsWith(db.url)) {
              await this.notificationIdx.put(createKey(change.value.subjectUrl), notification)
            }
            break
        }
      } finally {
        release()
        pend()
      }
    })

    this.createIndexer('ctzn.network/follow-idx', ['ctzn.network/follow'], async (db, change) => {
      const pend = perf.measure(`publicServerDb:follows-indexer`)
      let subject = change.value?.subject
      if (!subject) {
        const oldEntry = await db.bee.checkout(change.seq).get(change.key)
        subject = oldEntry.value.subject
      }
      const release = await this.lock(`follows-idx:${subject.userId}`)
      try {
        let followsIdxEntry = await this.followsIdx.get(subject.userId).catch(e => undefined)
        if (!followsIdxEntry) {
          followsIdxEntry = {
            key: subject.userId,
            value: {
              subjectId: subject.userId,
              followerIds: []
            }
          }
        }
        const followerId = await fetchUserId(db.url)
        const followerIdIndex = followsIdxEntry.value.followerIds.indexOf(followerId)
        if (change.value) {
          if (followerIdIndex === -1) {
            followsIdxEntry.value.followerIds.push(followerId)
          }
        } else {
          if (followerIdIndex !== -1) {
            followsIdxEntry.value.followerIds.splice(followerIdIndex, 1)
          }
        }
        await this.followsIdx.put(followsIdxEntry.key, followsIdxEntry.value)
      } finally {
        release()
        pend()
      }
      this.emit('followed-users-changed', {userId: subject.userId})
    })

    this.createIndexer('ctzn.network/comment-idx', ['ctzn.network/comment'], async (db, change) => {
      const pend = perf.measure(`publicServerDb:comments-indexer`)
      const commentUrl = constructEntryUrl(db.url, 'ctzn.network/comment', change.keyParsed.key)
      let subjectUrl = change.value?.subjectUrl
      if (!subjectUrl) {
        const oldEntry = await db.bee.checkout(change.seq).get(change.key)
        subjectUrl = oldEntry.value.subjectUrl
      }

      const release = await this.lock(`comments-idx:${subjectUrl}`)
      try {
        let commentsIdxEntry = await this.commentsIdx.get(subjectUrl).catch(e => undefined)
        if (!commentsIdxEntry) {
          commentsIdxEntry = {
            key: subjectUrl,
            value: {
              subjectUrl,
              commentUrls: []
            }
          }
        }
        let commentUrlIndex = commentsIdxEntry.value.commentUrls.indexOf(commentUrl)
        if (change.value) {
          if (commentUrlIndex === -1) {
            commentsIdxEntry.value.commentUrls.push(commentUrl)
          }
        } else {
          if (commentUrlIndex !== -1) {
            commentsIdxEntry.value.commentUrls.splice(commentUrlIndex, 1)
          }
        }
        await this.commentsIdx.put(commentsIdxEntry.key, commentsIdxEntry.value)
      } finally {
        release()
        pend()
      }
    })

    this.createIndexer('ctzn.network/vote-idx', ['ctzn.network/vote'], async (db, change) => {
      const pend = perf.measure(`publicServerDb:votes-indexer`)
      const release = await this.lock(`votes-idx:${change.keyParsed.key}`)
      try {
        const voteUrl = constructEntryUrl(db.url, 'ctzn.network/vote', change.keyParsed.key)
        let subjectUrl = change.value?.subjectUrl
        if (!subjectUrl) {
          const oldEntry = await db.bee.checkout(change.seq).get(change.key)
          subjectUrl = oldEntry.value.subjectUrl
        }

        let votesIdxEntry = await this.votesIdx.get(subjectUrl).catch(e => undefined)
        if (!votesIdxEntry) {
          votesIdxEntry = {
            key: change.keyParsed.key,
            value: {
              subjectUrl: subjectUrl,
              upvoteUrls: [],
              downvoteUrls: []
            }
          }
        }
        let upvoteUrlIndex = votesIdxEntry.value.upvoteUrls.indexOf(voteUrl)
        if (upvoteUrlIndex !== -1) votesIdxEntry.value.upvoteUrls.splice(upvoteUrlIndex, 1)
        let downvoteUrlIndex = votesIdxEntry.value.downvoteUrls.indexOf(voteUrl)
        if (downvoteUrlIndex !== -1) votesIdxEntry.value.downvoteUrls.splice(downvoteUrlIndex, 1)
  
        if (change.value) {
          if (change.value.vote === 1) {
            votesIdxEntry.value.upvoteUrls.push(voteUrl)
          } else if (change.value.vote === -1) {
            votesIdxEntry.value.downvoteUrls.push(voteUrl)
          }
        }
  
        await this.votesIdx.put(votesIdxEntry.key, votesIdxEntry.value)
      } finally {
        release()
        pend()
      }
    })
  }

  async getAllExternalFollowedIds () {
    const followRecords = (await this.followsIdx.list())
    const ourFollowRecords = followRecords.filter(entry => {
      return entry.value?.followerIds?.filter(id => id.endsWith(getDomain()))?.length
    })
    return ourFollowRecords.map(entry => entry.key).filter(id => !id.endsWith(getDomain()))
  }

  async getSubscribedDbUrls () {
    if (!_subscribedDbUrlsCached) {
      await _loadSubscribedDbUrls(this)
    }
    return _subscribedDbUrlsCached
  }

  async onDatabaseCreated () {
    console.log('New public server database created, key:', this.key.toString('hex'))
  }
}

export class PrivateServerDB extends BaseHyperbeeDB {
  constructor (key, publicServerDb) {
    super('private:server', key)
    this.publicServerDb = publicServerDb
  }

  async setup () {
    await super.setup()
    this.indexState = this.getTable('ctzn.network/index-state')
    this.accounts = this.getTable('ctzn.network/account')
    this.accountSessions = this.getTable('ctzn.network/account-session')
    this.userDbIdx = this.getTable('ctzn.network/user-db-idx')

    this.createIndexer('ctzn.network/user-db-idx', ['ctzn.network/user'], async (db, change) => {
      const pend = perf.measure(`privateServerDb:user-db-indexer`)
      const release = await this.lock('user-db-idx')
      try {
        let oldEntry = await db.bee.checkout(change.seq).get(change.key)
        if (oldEntry?.value?.dbUrl) {
          await this.userDbIdx.del(oldEntry.value.dbUrl)
        }
        if (change.value) {
          await this.userDbIdx.put(change.value.dbUrl, {
            dbUrl: change.value.dbUrl,
            userId: constructUserId(change.value.username)
          })
        }
      } finally {
        release()
        pend()
      }
    })

    this.createIndexer('memory:subscribed-urls', ['ctzn.network/user'], async (db, change) => {
      await _loadSubscribedDbUrls(this.publicServerDb)
    })
  }

  async getSubscribedDbUrls () {
    return [this.publicServerDb.url]
  }
  
  async onDatabaseCreated () {
    console.log('New private server database created, key:', this.key.toString('hex'))
  }
}

let _subscribedDbUrlsCached
async function _loadSubscribedDbUrls (publicServerDb) {
  _subscribedDbUrlsCached = (await publicServerDb.users.list()).map(entry => entry.value.dbUrl)
}