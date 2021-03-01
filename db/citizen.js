import createMlts from 'monotonic-lexicographic-timestamp'
import { BaseHyperbeeDB } from './base.js'
import { constructEntryUrl } from '../lib/strings.js'
import { fetchUserId } from '../lib/network.js'
import * as perf from '../lib/perf.js'

const mlts = createMlts()

export class PublicCitizenDB extends BaseHyperbeeDB {
  constructor (userId, key) {
    super(`public:${userId}`, key)
    this.userId = userId
  }

  get dbType () {
    return 'ctzn.network/public-citizen-db'
  }

  async setup () {
    await super.setup()
    await this.blobs.setup()
    this.profile = this.getTable('ctzn.network/profile')
    this.posts = this.getTable('ctzn.network/post')
    this.comments = this.getTable('ctzn.network/comment')
    this.votes = this.getTable('ctzn.network/vote')
    this.follows = this.getTable('ctzn.network/follow')
    this.memberships = this.getTable('ctzn.network/community-membership')

    this.memberships.onPut(() => {
      this.emit('subscriptions-changed')
    })
    this.memberships.onDel(() => {
      this.emit('subscriptions-changed')
    })
  }
}

export class PrivateCitizenDB extends BaseHyperbeeDB {
  constructor (userId, key, publicServerDb, publicUserDb) {
    super(`private:${userId}`, key, {isPrivate: true})
    this.userId = userId
    this.publicServerDb = publicServerDb
    this.publicUserDb = publicUserDb
  }

  get dbType () {
    return 'ctzn.network/private-citizen-db'
  }

  async setup () {
    await super.setup()
    this.indexState = this.getTable('ctzn.network/index-state')
    this.threadIdx = this.getTable('ctzn.network/thread-idx')
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
        let itemCreatedAt
        switch (change.keyParsed.schemaId) {
          case 'ctzn.network/follow':
            // following me?
            if (change.value.subject.dbUrl !== myUrl) {
              return false
            }
            itemCreatedAt = new Date(change.value.createdAt)
            break
          case 'ctzn.network/comment': {
            // self-post reply on my content?
            if (change.value.community) return false
            if (!change.value.reply) return false
            const onMyPost = (
              change.value.reply.root.dbUrl.startsWith(myUrl)
              || change.value.reply.parent?.dbUrl.startsWith(myUrl)
            )
            if (!onMyPost) return
            itemCreatedAt = new Date(change.value.createdAt)
            break
          }
          case 'ctzn.network/vote':
            // vote on my content?
            if (!change.value.subject.dbUrl.startsWith(myUrl)) {
              return false
            }
            itemCreatedAt = new Date(change.value.createdAt)
            break
        }
        
        const createdAt = new Date()
        await this.notificationsIdx.put(mlts(Math.min(createdAt, itemCreatedAt || createdAt)), {
          itemUrl: constructEntryUrl(db.url, change.keyParsed.schemaId, change.keyParsed.key),
          createdAt: createdAt.toISOString()
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
        const oldEntry = await db.bee.checkout(change.seq).get(change.key, {timeout: 10e3})
        subject = oldEntry.value.subject
      }

      const release = await this.lock(`follows-idx:${subject.userId}`)
      try {
        let followsIdxEntry = await this.followsIdx.get(subject.userId)
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
      if (db.url === this.publicUserDb.url) {
        this.emit('subscriptions-changed', {userId: subject.userId})
      }
    })

    this.createIndexer('ctzn.network/thread-idx', ['ctzn.network/comment'], async (db, change) => {
      const pend = perf.measure(`privateUserDb:thread-indexer`)
      const commentUrl = constructEntryUrl(db.url, 'ctzn.network/comment', change.keyParsed.key)
      let replyRoot = change.value?.reply?.root
      let replyParent = change.value?.reply?.parent
      let community = change.value?.community
      if (!change.value) {
        const oldEntry = await db.bee.checkout(change.seq).get(change.key, {timeout: 10e3})
        replyRoot = oldEntry.value.reply?.root
        replyParent = oldEntry.value.reply?.parent
        community = oldEntry.value?.community
      }
      if (!replyRoot) {
        return // not a reply, ignore
      }
      if (!!community && db.url !== this.publicUserDb.url) {
        return // not a self post or by me, ignore
      }

      if (replyParent && replyParent.dbUrl === replyRoot.dbUrl) {
        replyParent = undefined
      }
      let targets = [replyRoot, replyParent].filter(Boolean)

      for (let target of targets) {
        const release = await this.lock(`thread-idx:${target.dbUrl}`)
        try {
          let threadIdxEntry = await this.threadIdx.get(target.dbUrl)
          if (!threadIdxEntry) {
            threadIdxEntry = {
              key: target.dbUrl,
              value: {
                subject: target,
                items: []
              }
            }
          }
          let itemUrlIndex = threadIdxEntry.value.items.findIndex(c => c.dbUrl === commentUrl)
          if (change.value) {
            if (itemUrlIndex === -1) {
              const authorId = db.userId
              threadIdxEntry.value.items.push({dbUrl: commentUrl, authorId})
              await this.threadIdx.put(threadIdxEntry.key, threadIdxEntry.value)
            }
          } else {
            if (itemUrlIndex !== -1) {
              threadIdxEntry.value.items.splice(itemUrlIndex, 1)
              await this.threadIdx.put(threadIdxEntry.key, threadIdxEntry.value)
            }
          }
        } finally {
          release()
          pend()
        }
      }
    })

    this.createIndexer('ctzn.network/vote-idx', ['ctzn.network/vote'], async (db, change) => {
      const pend = perf.measure(`privateUserDb:votes-indexer`)
      const release = await this.lock(`votes-idx:${change.keyParsed.key}`)
      try {
        const voteUrl = constructEntryUrl(db.url, 'ctzn.network/vote', change.keyParsed.key)
        let subject = change.value?.subject
        if (!subject) {
          const oldEntry = await db.bee.checkout(change.seq).get(change.key, {timeout: 10e3})
          subject = oldEntry.value.subject
        }

        let votesIdxEntry = await this.votesIdx.get(subject.dbUrl)
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