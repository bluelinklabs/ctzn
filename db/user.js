import createMlts from 'monotonic-lexicographic-timestamp'
import { BaseHyperbeeDB } from './base.js'
import { constructEntryUrl } from '../lib/strings.js'
import { fetchUserId } from '../lib/network.js'
import * as perf from '../lib/perf.js'

const mlts = createMlts()

export class PublicUserDB extends BaseHyperbeeDB {
  constructor (userId, key) {
    super(`public:${userId}`, key)
  }

  async setup () {
    await super.setup()
    await this.blobs.setup()
    this.profile = this.getTable('ctzn.network/profile')
    this.posts = this.getTable('ctzn.network/post')
    this.votes = this.getTable('ctzn.network/vote')
    this.comments = this.getTable('ctzn.network/comment')
    this.follows = this.getTable('ctzn.network/follow')
  }
}

export class PrivateUserDB extends BaseHyperbeeDB {
  constructor (userId, key, publicServerDb, publicUserDb) {
    super(`private:${userId}`, key, {isPrivate: true})
    this.publicServerDb = publicServerDb
    this.publicUserDb = publicUserDb
  }

  async setup () {
    await super.setup()
    this.indexState = this.getTable('ctzn.network/index-state')
    this.commentsIdx = this.getTable('ctzn.network/comment-idx')
    this.followsIdx = this.getTable('ctzn.network/follow-idx')
    this.notificationsIdx = this.getTable('ctzn.network/notification-idx')
    this.votesIdx = this.getTable('ctzn.network/vote-idx')

    const NOTIFICATIONS_SCHEMAS = [
      'ctzn.network/follow',
      'ctzn.network/comment',
      'ctzn.network/vote'
    ]
    this.createIndexer('ctzn.network/notification-idx', NOTIFICATIONS_SCHEMAS, async (db, change) => {
      const myUrl = this.publicUserDb.url
      if (!change.value) return // ignore deletes
      if (db.url === myUrl) return // ignore self
      const pend = perf.measure(`privateUserDb:notifications-indexer`)

      const release = await this.lock(`notifications-idx:${change.url}`)
      try {
        switch (change.keyParsed.schemaId) {
          case 'ctzn.network/follow':
            // following me?
            if (change.value.subject.dbUrl !== myUrl) {
              return false
            }
            break
          case 'ctzn.network/comment': {
            // comment on my content?
            let {subject, parentComment} = change.value
            if (!subject.dbUrl.startsWith(myUrl) && !parentComment?.dbUrl.startsWith(myUrl)) {
              return false
            }
            break
          }
          case 'ctzn.network/vote':
            // vote on my content?
            if (!change.value.subject.dbUrl.startsWith(myUrl)) {
              return false
            }
            break
        }
        
        await this.notificationsIdx.put(mlts(), {
          itemUrl: constructEntryUrl(db.url, change.keyParsed.schemaId, change.keyParsed.key),
          createdAt: (new Date()).toISOString()
        })
      } finally {
        release()
        pend()
      }
    })

    this.createIndexer('ctzn.network/follow-idx', ['ctzn.network/follow'], async (db, change) => {
      const pend = perf.measure(`privateUserDb:follows-indexer`)
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
    })

    this.createIndexer('ctzn.network/comment-idx', ['ctzn.network/comment'], async (db, change) => {
      const pend = perf.measure(`privateUserDb:comments-indexer`)
      const commentUrl = constructEntryUrl(db.url, 'ctzn.network/comment', change.keyParsed.key)
      let subject = change.value?.subject
      if (!subject) {
        const oldEntry = await db.bee.checkout(change.seq).get(change.key)
        subject = oldEntry.value.subject
      }

      const release = await this.lock(`comments-idx:${subject.dbUrl}`)
      try {
        let commentsIdxEntry = await this.commentsIdx.get(subject.dbUrl).catch(e => undefined)
        if (!commentsIdxEntry) {
          commentsIdxEntry = {
            key: subject.dbUrl,
            value: {
              subject,
              comments: []
            }
          }
        }
        let commentUrlIndex = commentsIdxEntry.value.comments.findIndex(c => c.dbUrl === commentUrl)
        if (change.value) {
          if (commentUrlIndex === -1) {
            const authorId = await fetchUserId(db.url)
            commentsIdxEntry.value.comments.push({dbUrl: commentUrl, authorId})
            await this.commentsIdx.put(commentsIdxEntry.key, commentsIdxEntry.value)
          }
        } else {
          if (commentUrlIndex !== -1) {
            commentsIdxEntry.value.comments.splice(commentUrlIndex, 1)
            await this.commentsIdx.put(commentsIdxEntry.key, commentsIdxEntry.value)
          }
        }
      } finally {
        release()
        pend()
      }
    })

    this.createIndexer('ctzn.network/vote-idx', ['ctzn.network/vote'], async (db, change) => {
      const pend = perf.measure(`privateUserDb:votes-indexer`)
      const release = await this.lock(`votes-idx:${change.keyParsed.key}`)
      try {
        const voteUrl = constructEntryUrl(db.url, 'ctzn.network/vote', change.keyParsed.key)
        let subject = change.value?.subject
        if (!subject) {
          const oldEntry = await db.bee.checkout(change.seq).get(change.key)
          subject = oldEntry.value.subject
        }

        let votesIdxEntry = await this.votesIdx.get(subject.dbUrl).catch(e => undefined)
        if (!votesIdxEntry) {
          votesIdxEntry = {
            key: change.keyParsed.key,
            value: {
              subject,
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

  async getSubscribedDbUrls () {
    return [this.publicUserDb.url].concat((await this.publicUserDb.follows.list()).map(entry => entry.value.subject.dbUrl))
  }
}