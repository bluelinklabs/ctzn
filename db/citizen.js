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
    this.cachedSubscriptions = []
  }

  get dbType () {
    return 'ctzn.network/public-citizen-db'
  }

  async setup () {
    await super.setup()
    await this.blobs.setup()
    this.indexState = this.getTable('ctzn.network/index-state')
    this.dbmethodCalls = this.getTable('ctzn.network/dbmethod-call')
    this.profile = this.getTable('ctzn.network/profile')
    this.posts = this.getTable('ctzn.network/post')
    this.comments = this.getTable('ctzn.network/comment')
    this.reactions = this.getTable('ctzn.network/reaction')
    this.follows = this.getTable('ctzn.network/follow')
    this.memberships = this.getTable('ctzn.network/community-membership')
    this.ownedItemsIndex = this.getTable('ctzn.network/owned-items-idx')

    this.cachedSubscriptions = (await this.memberships.list()).map(entry => entry.value.community.dbUrl)
    this.memberships.onPut(async () => {
      this.cachedSubscriptions = (await this.memberships.list()).map(entry => entry.value.community.dbUrl)
      this.emit('subscriptions-changed')
    })
    this.memberships.onDel(async () => {
      this.cachedSubscriptions = (await this.memberships.list()).map(entry => entry.value.community.dbUrl)
      this.emit('subscriptions-changed')
    })

    this.createIndexer('ctzn.network/owned-items-idx', ['ctzn.network/item'], async (batch, db, diff) => {
      const pend = perf.measure(`publicUserDb:owned-items-indexer`)
      
      const newOwner = diff.right?.value?.owner
      const oldOwner = diff.left?.value?.owner
      if (newOwner?.dbUrl !== this.url && oldOwner?.dbUrl !== this.url) {
        return // not our item
      }
      if (newOwner?.dbUrl === oldOwner?.dbUrl) {
        return // no change in ownership, dont need to process it
      }
      const itemUrl = (diff.right || diff.left).url

      const release = await this.lock(`owned-items-idx:${itemUrl}`)
      try {
        const key = `${db.userId}:${(diff.right || diff.left).key}`
        if (oldOwner?.dbUrl === this.url) {
          // we're the old owner, item is now gone
          await this.ownedItemsIndex.del(key)
        } else if (newOwner?.dbUrl === this.url) {
          // we're the new owner, item is added
          await this.ownedItemsIndex.put(key, {
            item: {
              key: diff.right.key,
              userId: db.userId,
              dbUrl: itemUrl
            },
            createdAt: (new Date()).toISOString()
          })
        }
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

export class PrivateCitizenDB extends BaseHyperbeeDB {
  constructor (userId, key, publicServerDb, publicUserDb) {
    super(`private:${userId}`, key, {isPrivate: true})
    this.userId = userId
    this.publicServerDb = publicServerDb
    this.publicUserDb = publicUserDb
    this.cachedSubscriptions = []
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
    this.reactionsIdx = this.getTable('ctzn.network/reaction-idx')

    this.cachedSubscriptions = [this.publicUserDb.url].concat((await this.publicUserDb.follows.list()).map(entry => entry.value.subject.dbUrl))
    this.publicUserDb.getTable('ctzn.network/follow').onPut(async () => {
      this.cachedSubscriptions = [this.publicUserDb.url].concat((await this.publicUserDb.follows.list()).map(entry => entry.value.subject.dbUrl))
      this.emit('subscriptions-changed')
    })
    this.publicUserDb.getTable('ctzn.network/follow').onDel(async () => {
      this.cachedSubscriptions = [this.publicUserDb.url].concat((await this.publicUserDb.follows.list()).map(entry => entry.value.subject.dbUrl))
      this.emit('subscriptions-changed')
    })

    const NOTIFICATIONS_SCHEMAS = [
      'ctzn.network/follow',
      'ctzn.network/comment',
      'ctzn.network/reaction'
    ]
    this.createIndexer('ctzn.network/notification-idx', NOTIFICATIONS_SCHEMAS, async (batch, db, diff) => {
      if (!diff.right) return // ignore deletes
      const myUrl = this.publicUserDb.url
      if (db.url === myUrl) return // ignore self
      const pend = perf.measure(`privateUserDb:notifications-indexer`)

      const release = await this.lock(`notifications-idx:${diff.right.url}`)
      try {
        let itemCreatedAt
        const value = diff.right.value
        switch (diff.right.schemaId) {
          case 'ctzn.network/follow':
            // following me?
            if (value.subject.dbUrl !== myUrl) {
              return false
            }
            itemCreatedAt = new Date(value.createdAt)
            break
          case 'ctzn.network/comment': {
            // self-post reply on my content?
            if (value.community) return false
            if (!value.reply) return false
            const onMyPost = (
              value.reply.root.dbUrl.startsWith(myUrl)
              || value.reply.parent?.dbUrl.startsWith(myUrl)
            )
            if (!onMyPost) return
            itemCreatedAt = new Date(value.createdAt)
            break
          }
          case 'ctzn.network/reaction':
            // reaction on my content?
            if (!value.subject.dbUrl.startsWith(myUrl)) {
              return false
            }
            itemCreatedAt = new Date(value.createdAt)
            break
        }
        
        const createdAt = new Date()
        const key = this.notificationsIdx.constructBeeKey(mlts(Math.min(+createdAt, (+itemCreatedAt) || (+createdAt))))
        await batch.put(key, {
          itemUrl: diff.right.url,
          createdAt: createdAt.toISOString()
        })
      } finally {
        release()
        pend()
      }
    })

    this.createIndexer('ctzn.network/follow-idx', ['ctzn.network/follow'], async (batch, db, diff) => {
      const pend = perf.measure(`privateUserDb:follows-indexer`)
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
        const followerId = await fetchUserId(db.url)
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
      const pend = perf.measure(`privateUserDb:thread-indexer`)
      const commentUrl = diff.right?.url || diff.left?.url
      const replyRoot = (diff.right || diff.left)?.value?.reply?.root
      let replyParent = (diff.right || diff.left)?.value?.reply?.parent
      const community = (diff.right || diff.left)?.value?.community

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
      
      const pend = perf.measure(`privateUserDb:reactions-indexer`)
      const release = await this.lock(`reactions-idx:${idxKey}`)
      try {
        const reactionUrl = (diff.right || diff.left).url
        const subject = (diff.right || diff.left).value.subject

        let reactionsIdxEntry = await this.reactionsIdx.get(subject.dbUrl)
        if (!reactionsIdxEntry) {
          reactionsIdxEntry = {
            key: idxKey,
            value: {
              subject,
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