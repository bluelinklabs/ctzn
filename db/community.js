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
    this.cachedSubscriptions = []
  }

  get dbType () {
    return 'ctzn.network/public-community-db'
  }

  get supportedMethods () {
    return [
      'community-delete-ban',
      'community-delete-role',
      'community-remove-content',
      'community-remove-member',
      'community-set-member-roles',
      'community-put-ban',
      'community-put-role',
      'create-item',
      'delete-item-class',
      'destroy-item',
      'ping',
      'put-avatar',
      'put-item-class',
      'put-profile',
      'transfer-item'
    ]
  }

  async setup () {
    await super.setup()
    await this.blobs.setup()
    this.profile = this.getTable('ctzn.network/profile')
    this.members = this.getTable('ctzn.network/community-member')
    this.roles = this.getTable('ctzn.network/community-role')
    this.bans = this.getTable('ctzn.network/community-ban')
    this.itemClasses = this.getTable('ctzn.network/item-class')
    this.items = this.getTable('ctzn.network/item')
    this.ownedItemsIndex = this.getTable('ctzn.network/owned-items-idx')
    this.indexState = this.getTable('ctzn.network/index-state')
    this.feedIdx = this.getTable('ctzn.network/feed-idx')
    this.threadIdx = this.getTable('ctzn.network/thread-idx')
    this.followsIdx = this.getTable('ctzn.network/follow-idx')
    this.notificationsIdx = this.getTable('ctzn.network/notification-idx')
    this.reactionsIdx = this.getTable('ctzn.network/reaction-idx')

    this.cachedSubscriptions = (await this.members.list()).map(entry => entry.value.user.dbUrl)
    this.members.onPut(async () => {
      this.cachedSubscriptions = (await this.members.list()).map(entry => entry.value.user.dbUrl)
      this.emit('subscriptions-changed')
    })
    this.members.onDel(async () => {
      this.cachedSubscriptions = (await this.members.list()).map(entry => entry.value.user.dbUrl)
      this.emit('subscriptions-changed')
    })

    const NOTIFICATIONS_SCHEMAS = [
      'ctzn.network/follow',
      'ctzn.network/comment',
      'ctzn.network/reaction'
    ]
    this.createIndexer('ctzn.network/notification-idx', NOTIFICATIONS_SCHEMAS, async (batch, db, diff) => {
      if (!diff.right) return // ignore deletes
      const pend = perf.measure(`publicCommunityDb:notifications-indexer`)

      const release = await this.lock(`notifications-idx:${diff.right.url}`)
      const createdAt = new Date()
      const notification = {
        itemUrl: diff.right.url,
        createdAt: createdAt.toISOString()
      }
      const createKey = (url, itemCreatedAt) => {
        return this.notificationsIdx.constructBeeKey(`${hyperUrlToKeyStr(url)}:${mlts(Math.min(+createdAt, itemCreatedAt || createdAt))}`)
      }
      try {
        const value = diff.right.value
        switch (diff.right.schemaId) {
          case 'ctzn.network/follow':
            if (value.subject.dbUrl !== db.url) {
              let itemCreatedAt = new Date(value.createdAt)
              await batch.put(
                createKey(value.subject.dbUrl, itemCreatedAt),
                notification
              )
            }
            break
          case 'ctzn.network/comment': {
            // reply to content in my community?
            if (!value.reply) return // not a reply
            if (value.community?.userId !== this.userId) return // not in our community
            let itemCreatedAt = new Date(value.createdAt)
            if (!value.reply.root.dbUrl.startsWith(db.url)) {
              await batch.put(
                createKey(value.reply.root.dbUrl, itemCreatedAt),
                notification
              )
            }
            if (value.reply.parent && !value.reply.parent.dbUrl.startsWith(db.url)) {
              await batch.put(
                createKey(value.reply.parent.dbUrl, itemCreatedAt),
                notification
              )
            }
            break
          }
          case 'ctzn.network/reaction':
            if (value.subject.dbUrl.startsWith(db.url)) {
              return // reaction on their own content
            }
            if (parseEntryUrl(value.subject.dbUrl).schemaId !== 'ctzn.network/post') {
              return // not a reaction on a post
            }
            let subject = await dbGet(value.subject.dbUrl).catch(e => undefined)
            if (!subject) {
              return // subject not accessible, ignore
            }
            if (subject.entry?.value?.community?.userId !== this.userId) {
              return // subject is not in our community
            }
            let itemCreatedAt = new Date(value.createdAt)
            await batch.put(
              createKey(value.subject.dbUrl, itemCreatedAt),
              notification
            )
            break
        }
      } finally {
        release()
        pend()
      }
    })
    
    this.createIndexer('ctzn.network/feed-idx', ['ctzn.network/post'], async (batch, db, diff) => {
      if (diff.left || !diff.right) return // ignore edits and deletes
      const community = diff.right.value.community
      if (community?.userId !== this.userId && community?.dbUrl !== this.url) {
        return // ignore posts not in our community
      }

      const pend = perf.measure(`publicCommunityDb:feed-indexer`)
      const release = await this.lock(`feed-idx:${diff.right.url}`)
      try {
        const value = {
          item: {
            dbUrl: diff.right.url,
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

    this.createIndexer('ctzn.network/follow-idx', ['ctzn.network/follow'], async (batch, db, diff) => {
      const pend = perf.measure(`publicCommunityDb:follows-indexer`)
      const subject = diff.right?.value?.subject || diff.left?.value?.subject
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
        if (diff.right) {
          if (followerIdIndex === -1) {
            followsIdxEntry.value.followerIds.push(followerId)
          }
        } else if (diff.left) {
          if (followerIdIndex !== -1) {
            followsIdxEntry.value.followerIds.splice(followerIdIndex, 1)
          }
        }
        await batch.put(this.followsIdx.constructBeeKey(followsIdxEntry.key), followsIdxEntry.value)
      } finally {
        release()
        pend()
      }
    })

    this.createIndexer('ctzn.network/thread-idx', ['ctzn.network/comment'], async (batch, db, diff) => {
      const pend = perf.measure(`publicCommunityDb:thread-indexer`)
      const commentUrl = diff.right?.url || diff.left?.url
      const replyRoot = (diff.right || diff.left)?.value?.reply?.root
      let replyParent = (diff.right || diff.left)?.value?.reply?.parent
      const community = (diff.right || diff.left)?.value?.community
      
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
          if (diff.right) {
            if (itemUrlIndex === -1) {
              const authorId = db.userId
              threadIdxEntry.value.items.push({dbUrl: commentUrl, authorId})
              await batch.put(this.threadIdx.constructBeeKey(threadIdxEntry.key), threadIdxEntry.value)
            }
          } else if (diff.left) {
            if (itemUrlIndex !== -1) {
              threadIdxEntry.value.items.splice(itemUrlIndex, 1)
              await batch.put(this.threadIdx.constructBeeKey(threadIdxEntry.key), threadIdxEntry.value)
            }
          }
        } finally {
          release()
          pend()
        }
      }
    })

    this.createIndexer('ctzn.network/reaction-idx', ['ctzn.network/reaction'], async (batch, db, diff) => {
      const idxKey = (diff.right || diff.left).key.split(':').slice(1).join(':')
      const pend = perf.measure(`publicCommunityDb:reactions-indexer`)
      const release = await this.lock(`reactions-idx:${idxKey}`)
      try {
        const reactionUrl = (diff.right || diff.left).url
        const subject = (diff.right || diff.left).value.subject

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
  
        if (diff.right) {
          let i = -1
          if (reactionsIdxEntry.value.reactions[diff.right.value.reaction]) {
            i = reactionsIdxEntry.value.reactions[diff.right.value.reaction].indexOf(reactionUrl)
          }
          if (i === -1) {
            if (!reactionsIdxEntry.value.reactions[diff.right.value.reaction]) {
              reactionsIdxEntry.value.reactions[diff.right.value.reaction] = []
            }
            reactionsIdxEntry.value.reactions[diff.right.value.reaction].push(reactionUrl)
          }
        } else if (diff.left) {
          let i = reactionsIdxEntry.value.reactions[diff.left.value.reaction]?.indexOf(reactionUrl)
          if (i !== -1) {
            reactionsIdxEntry.value.reactions[diff.left.value.reaction].splice(i, 1)
            if (!reactionsIdxEntry.value.reactions[diff.left.value.reaction].length) {
              delete reactionsIdxEntry.value.reactions[diff.left.value.reaction]
            }
          }
        }
  
        await batch.put(this.reactionsIdx.constructBeeKey(reactionsIdxEntry.key), reactionsIdxEntry.value)
      } finally {
        release()
        pend()
      }
    })
  }

  async getSubscribedDbUrls () {
    return this.cachedSubscriptions
  }
}