import createMlts from 'monotonic-lexicographic-timestamp'
import { BaseHyperbeeDB } from './base.js'
import { hyperUrlToKeyStr, constructEntryUrl, parseEntryUrl } from '../lib/strings.js'
import { dbGet } from './util.js'
import * as perf from '../lib/perf.js'

const mlts = createMlts()

export class PublicCommunityDB extends BaseHyperbeeDB {
  constructor (userId, key) {
    super(`public:${userId}`, key)
    this.userId = userId
  }

  get dbType () {
    return 'ctzn.network/public-community-db'
  }

  async setup () {
    await super.setup()
    await this.blobs.setup()
    this.profile = this.getTable('ctzn.network/profile')
    this.members = this.getTable('ctzn.network/community-member')
    this.roles = this.getTable('ctzn.network/community-role')
    this.bans = this.getTable('ctzn.network/community-ban')
    this.indexState = this.getTable('ctzn.network/index-state')
    this.feedIdx = this.getTable('ctzn.network/feed-idx')
    this.threadIdx = this.getTable('ctzn.network/thread-idx')
    this.followsIdx = this.getTable('ctzn.network/follow-idx')
    this.notificationsIdx = this.getTable('ctzn.network/notification-idx')
    this.reactionsIdx = this.getTable('ctzn.network/reaction-idx')

    this.members.onPut(() => {
      this.emit('subscriptions-changed')
    })
    this.members.onDel(() => {
      this.emit('subscriptions-changed')
    })

    const NOTIFICATIONS_SCHEMAS = [
      'ctzn.network/follow',
      'ctzn.network/comment',
      'ctzn.network/reaction'
    ]
    this.createIndexer('ctzn.network/notification-idx', NOTIFICATIONS_SCHEMAS, async (db, change) => {
      if (!change.value) return // ignore deletes
      const pend = perf.measure(`publicCommunityDb:notifications-indexer`)

      const release = await this.lock(`notifications-idx:${change.url}`)
      const createdAt = new Date()
      const notification = {
        itemUrl: constructEntryUrl(db.url, change.keyParsed.schemaId, change.keyParsed.key),
        createdAt: createdAt.toISOString()
      }
      const createKey = (url, itemCreatedAt) => {
        return `${hyperUrlToKeyStr(url)}:${mlts(Math.min(createdAt, itemCreatedAt || createdAt))}`
      }
      try {
        switch (change.keyParsed.schemaId) {
          case 'ctzn.network/follow':
            if (change.value.subject.dbUrl !== db.url) {
              let itemCreatedAt = new Date(change.value.createdAt)
              await this.notificationsIdx.put(createKey(change.value.subject.dbUrl, itemCreatedAt), notification)
            }
            break
          case 'ctzn.network/comment': {
            // reply to content in my community?
            if (!change.value.reply) return // not a reply
            if (change.value.community?.userId !== this.userId) return // not in our community
            let itemCreatedAt = new Date(change.value.createdAt)
            if (!change.value.reply.root.dbUrl.startsWith(db.url)) {
              await this.notificationsIdx.put(createKey(change.value.reply.root.dbUrl, itemCreatedAt), notification)
            }
            if (change.value.reply.parent && !change.value.reply.parent.dbUrl.startsWith(db.url)) {
              await this.notificationsIdx.put(createKey(change.value.reply.parent.dbUrl, itemCreatedAt), notification)
            }
            break
          }
          case 'ctzn.network/reaction':
            if (change.value.subject.dbUrl.startsWith(db.url)) {
              return // reaction on their own content
            }
            if (parseEntryUrl(change.value.subject.dbUrl).schemaId !== 'ctzn.network/post') {
              return // not a reaction on a post
            }
            let subject = await dbGet(change.value.subject.dbUrl).catch(e => undefined)
            if (!subject) {
              return // subject not accessible, ignore
            }
            if (subject.entry?.value?.community?.userId !== this.userId) {
              return // subject is not in our community
            }
            let itemCreatedAt = new Date(change.value.createdAt)
            await this.notificationsIdx.put(createKey(change.value.subject.dbUrl, itemCreatedAt), notification)
            break
        }
      } finally {
        release()
        pend()
      }
    })
    
    this.createIndexer('ctzn.network/feed-idx', ['ctzn.network/post'], async (db, change) => {
      if (!change.value) return // ignore deletes
      const community = change.value.community
      if (community?.userId !== this.userId && community?.dbUrl !== this.url) {
        return // ignore posts not in our community
      }
      const changeUrl = constructEntryUrl(db.url, change.keyParsed.schemaId, change.keyParsed.key)
      const pend = perf.measure(`publicCommunityDb:feed-indexer`)
      const release = await this.lock(`feed-idx:${changeUrl}`)
      try {
        const value = {
          item: {
            dbUrl: changeUrl,
            authorId: db.userId
          },
          createdAt: (new Date()).toISOString()
        }
        await this.feedIdx.put(mlts(), value)
      } finally {
        release()
        pend()
      }
    })

    this.createIndexer('ctzn.network/follow-idx', ['ctzn.network/follow'], async (db, change) => {
      const pend = perf.measure(`publicCommunityDb:follows-indexer`)
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
        const followerId = db.userId
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

    this.createIndexer('ctzn.network/thread-idx', ['ctzn.network/comment'], async (db, change) => {
      const pend = perf.measure(`publicCommunityDb:thread-indexer`)
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
      if (community?.userId !== this.userId) {
        return // not a comment in my community, ignore
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

    this.createIndexer('ctzn.network/reaction-idx', ['ctzn.network/reaction'], async (db, change) => {
      const idxKey = change.keyParsed.key.split(':').slice(1).join(':')
      const pend = perf.measure(`publicCommunityDb:reactions-indexer`)
      const release = await this.lock(`reactions-idx:${idxKey}`)
      try {
        const reactionUrl = constructEntryUrl(db.url, 'ctzn.network/reaction', change.keyParsed.key)
        let subject = change.value?.subject
        let oldReaction
        if (!subject) {
          const oldEntry = await db.bee.checkout(change.seq).get(change.key, {timeout: 10e3})
          subject = oldEntry.value.subject
          oldReaction = oldEntry.value.reaction
        }

        let reactionsIdxEntry = await this.reactionsIdx.get(subject.dbUrl)
        if (!reactionsIdxEntry) {
          reactionsIdxEntry = {
            key: idxKey,
            value: {
              subject: subject,
              reactions: {}
            }
          }
        }
  
        if (change.value?.reaction) {
          let i = -1
          if (reactionsIdxEntry.value.reactions[change.value.reaction]) {
            i = reactionsIdxEntry.value.reactions[change.value.reaction].indexOf(reactionUrl)
          }
          if (i === -1) {
            if (!reactionsIdxEntry.value.reactions[change.value.reaction]) {
              reactionsIdxEntry.value.reactions[change.value.reaction] = []
            }
            reactionsIdxEntry.value.reactions[change.value.reaction].push(reactionUrl)
          }
        } else if (oldReaction) {
          let i = reactionsIdxEntry.value.reactions[oldReaction]?.indexOf(reactionUrl)
          if (i !== -1) {
            reactionsIdxEntry.value.reactions[oldReaction].splice(i, 1)
            if (!reactionsIdxEntry.value.reactions[oldReaction].length) {
              delete reactionsIdxEntry.value.reactions[oldReaction]
            }
          }
        }
  
        await this.reactionsIdx.put(reactionsIdxEntry.key, reactionsIdxEntry.value)
      } finally {
        release()
        pend()
      }
    })
  }

  async getSubscribedDbUrls () {
    return (await this.members.list()).map(entry => entry.value.user.dbUrl)
  }
}