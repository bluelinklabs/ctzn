import createMlts from 'monotonic-lexicographic-timestamp'
import { BaseHyperbeeDB } from './base.js'
import { publicDbs } from './index.js'
import { dbGet } from './util.js'
import { constructUserId, constructEntryUrl } from '../lib/strings.js'
import * as perf from '../lib/perf.js'
import _intersectionBy from 'lodash.intersectionby'

const INDEXED_DB_TYPES = [
  'ctzn.network/public-citizen-db',
  'ctzn.network/public-community-db'
]
const mlts = createMlts()

export class PublicServerDB extends BaseHyperbeeDB {
  constructor (userId, key) {
    super('public:server', key)
    this.userId = userId
  }

  get dbType () {
    return 'ctzn.network/public-server-db'
  }

  isEjectableFromMemory (ts) {
    return false // never eject the public server db from memory
  }

  async setup () {
    await super.setup()
    this.indexState = this.getTable('ctzn.network/index-state')
    this.users = this.getTable('ctzn.network/user')
    this.ownedItemsIndex = this.getTable('ctzn.network/owned-items-idx')
    this.threadIdx = this.getTable('ctzn.network/thread-idx')
    this.followsIdx = this.getTable('ctzn.network/follow-idx')
    this.notificationsIdx = this.getTable('ctzn.network/notification-idx')
    this.reactionsIdx = this.getTable('ctzn.network/reaction-idx')
    this.feedIdx = this.getTable('ctzn.network/feed-idx')
    this.itemTfxRelationIdx = this.getTable('ctzn.network/item-tfx-relation-idx')

    if (!this.writable) {
      return
    }

    this.createIndexer('ctzn.network/dbmethod-result', ['ctzn.network/dbmethod-call'], async (batch, db, diff) => {
      if (!diff.right) return // ignore deletes

      const {database, method, args} = diff.right.value
      const handlerDb = publicDbs.get(database.userId)
      if (!handlerDb) return // not one of our databases

      const writeDbMethodResult = async (code, details) => {
        const value = {
          call: {
            dbUrl: diff.right.url,
            authorId: db.userId
          },
          code,
          details,
          createdAt: (new Date()).toISOString()
        }
        const key = handlerDb.dbmethodResults.schema.generateKey(value)
        return handlerDb.dbmethodResults.put(key, value)
      }

      const methodDefinition = handlerDb.dbmethods[method]
      if (!methodDefinition) {
        return writeDbMethodResult('method-not-found')
      }
      try {
        methodDefinition.validateCallArgs(args)
        const res = await methodDefinition.handler(handlerDb, db, args, diff.right)
        methodDefinition.validateResponse(res)
        return await writeDbMethodResult('success', res)
      } catch (e) {
        return await writeDbMethodResult(e.code || 'error', {message: e.toString()})
      }
    })

    this.createIndexer('ctzn.network/dbmethod-result-chron-idx', ['ctzn.network/dbmethod-result'], async (batch, db, diff) => {
      if (!diff.right) return // ignore deletes
      if (diff.left && diff.right) return // ignore updates

      const value = {
        database: {
          userId: db.userId,
          dbUrl: db.url
        },
        idxkey: mlts(),
        resultKey: diff.right.key
      }
      const key = this.dbmethodResultsChronIdx.schema.generateKey(value)
      return this.dbmethodResultsChronIdx.put(key, value)
    })

    const NOTIFICATIONS_SCHEMAS = [
      'ctzn.network/follow',
      'ctzn.network/comment',
      'ctzn.network/reaction'
    ]
    this.createIndexer('ctzn.network/notification-idx', NOTIFICATIONS_SCHEMAS, async (batch, db, diff) => {
      if (!diff.right) return // ignore deletes
      if (diff.left && diff.right) return // ignore edits

      const createdAt = new Date()
      const value = diff.right.value
      const itemCreatedAt = new Date(value.createdAt)
      const genKey = userId => {
        const idxkey = mlts(Math.min(+createdAt, (+itemCreatedAt) || (+createdAt)))
        return {idxkey, key: this.notificationsIdx.constructBeeKey(`${userId}:${idxkey}`)}
      }
      switch (diff.right.schemaId) {
        case 'ctzn.network/reaction':
        case 'ctzn.network/follow': {
          const subjectUserId = value.subject.userId || value.subject.authorId
          const subjectDb = publicDbs.get(subjectUserId)
          if (!subjectDb) return // not one of our users

          if (subjectUserId === db.userId) {
            return // acting on own content, ignore
          }

          const followEntry = await subjectDb.getTable('ctzn.network/follow').get(db.userId)
          if (!followEntry) {
            const [subjectMemberships, authorMemberships] = await Promise.all([
              subjectDb.getTable('ctzn.network/community-membership').list(),
              db.getTable('ctzn.network/community-membership').list(),
            ])
            const sharedMemberships = _intersectionBy(subjectMemberships, authorMemberships, m => m.value.community.userId)
            // TODO verify membership so that banned users can't take advantage of this -prf
            if (sharedMemberships.length === 0) {
              return // author is not followed by subject or in the same community
            }
          }

          const {key, idxkey} = genKey(subjectUserId)
          await batch.put(key, {
            subjectUserId,
            idxkey,
            itemUrl: diff.right.url,
            createdAt: createdAt.toISOString()
          })
          break
        }
        case 'ctzn.network/comment': {
          const rootSubjectDb = value.reply.root ? publicDbs.get(value.reply.root.authorId) : undefined
          const parentSubjectDb = value.reply.parent ? publicDbs.get(value.reply.parent.authorId) : undefined
          if (!rootSubjectDb && !parentSubjectDb) return // not one of our users
          if (value.community) {
            // comment on a community
            const [rootSubjectMemberEntry, parentSubjectMemberEntry, authorMemberEntry] = await Promise.all([
              rootSubjectDb ? dbGet(constructEntryUrl(value.community.dbUrl, 'ctzn.network/community-member', rootSubjectDb.userId)) : undefined,
              parentSubjectDb ? dbGet(constructEntryUrl(value.community.dbUrl, 'ctzn.network/community-member', rootSubjectDb.userId)) : undefined,
              dbGet(constructEntryUrl(value.community.dbUrl, 'ctzn.network/community-member', db.userId))
            ])
            if (!authorMemberEntry) {
              return // author is not a member of the community
            }
            if (rootSubjectMemberEntry && rootSubjectDb.url !== db.url) {
              // notification for root post author
              const {key, idxkey} = genKey(rootSubjectDb.userId)
              await batch.put(key, {
                subjectUserId: rootSubjectDb.userId,
                idxkey,
                itemUrl: diff.right.url,
                createdAt: createdAt.toISOString()
              })
            }
            if (parentSubjectMemberEntry && parentSubjectDb.url !== db.url && rootSubjectDb?.url !== parentSubjectDb.url) {
              // notification for parent post author
              const {key, idxkey} = genKey(parentSubjectDb.userId)
              await batch.put(key, {
                subjectUserId: parentSubjectDb.userId,
                idxkey,
                itemUrl: diff.right.url,
                createdAt: createdAt.toISOString()
              })
            }
          } else {
            // comment on a self-post
            const [rootSubjectFollowEntry, parentSubjectFollowEntry] = await Promise.all([
              rootSubjectDb ? rootSubjectDb.getTable('ctzn.network/follow').get(db.userId) : undefined,
              parentSubjectDb ? parentSubjectDb.getTable('ctzn.network/follow').get(db.userId) : undefined
            ])
            if (rootSubjectFollowEntry && rootSubjectDb.url !== db.url) {
              // notification for root post author
              const {key, idxkey} = genKey(rootSubjectDb.userId)
              await batch.put(key, {
                subjectUserId: rootSubjectDb.userId,
                idxkey,
                itemUrl: diff.right.url,
                createdAt: createdAt.toISOString()
              })
            }
            if (parentSubjectFollowEntry && parentSubjectDb.url !== db.url && rootSubjectDb?.url !== parentSubjectDb.url) {
              // notification for parent post author
              const {key, idxkey} = genKey(parentSubjectDb.userId)
              await batch.put(key, {
                subjectUserId: parentSubjectDb.userId,
                idxkey,
                itemUrl: diff.right.url,
                createdAt: createdAt.toISOString()
              })
            }
          }
          break
        }
      }
    })

    this.createIndexer('ctzn.network/thread-idx', ['ctzn.network/comment'], async (batch, db, diff) => {
      const commentUrl = diff.right?.url || diff.left?.url
      const replyRoot = (diff.right || diff.left)?.value?.reply?.root
      if (!replyRoot) {
        throw new Error(`Comment has no reply root (${commentUrl})`)
      }
      let replyParent = (diff.right || diff.left)?.value?.reply?.parent
      if (replyParent && replyParent.dbUrl === replyRoot.dbUrl) {
        replyParent = undefined
      }
      let targets = [replyRoot, replyParent].filter(Boolean)

      const replyRootValue = (await dbGet(replyRoot.dbUrl))?.entry?.value
      if (!replyRootValue) {
        throw new Error(`Failed to fetch thread root of comment ${commentUrl}`)
      }
      if (!(await isCommunityMember(replyRootValue.community, db.userId))) {
        throw new Error(`Author of ${commentUrl} is not a member of the "${replyRootValue.community.userId}" community`)
      }

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
        }
      }
    })
    
    this.createIndexer('ctzn.network/feed-idx', ['ctzn.network/post'], async (batch, db, diff) => {
      if (diff.left || !diff.right) return // ignore edits and deletes
      if (!diff.right.value.community) {
        return // only index community posts
      }
      const communityDb = publicDbs.get(diff.right.value.community.userId)
      if (!communityDb || !communityDb.writable) {
        return // only index communities we run
      }

      if (!(await isCommunityMember(diff.right.value.community, db.userId))) {
        throw new Error(`Author of ${diff.right.url} is not a member of the "${diff.right.value.community.userId}" community`)
      }

      const itemCreatedAt = new Date(diff.right.value.createdAt)
      const indexCreatedAt = new Date()
      const idxkey = mlts(Math.min(+indexCreatedAt, (+itemCreatedAt) || (+indexCreatedAt)))
      const value = {
        feedUserId: diff.right.value.community.userId,
        idxkey,
        item: {
          dbUrl: diff.right.url,
          authorId: db.userId
        },
        createdAt: indexCreatedAt
      }
      await batch.put(this.feedIdx.constructBeeKey(`${value.feedUserId}:${value.idxkey}`), value)
    })

    this.createIndexer('ctzn.network/follow-idx', ['ctzn.network/follow'], async (batch, db, diff) => {
      const subject = diff.right?.value?.subject || diff.left?.value?.subject
      const release = await this.followsIdx.lock(subject.userId)
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
      }
    })

    this.createIndexer('ctzn.network/reaction-idx', ['ctzn.network/reaction'], async (batch, db, diff) => {
      const subjectUrl = (diff.right || diff.left).value.subject.dbUrl
      const release = await this.reactionsIdx.lock(subjectUrl)
      try {
        const reactionUrl = (diff.right || diff.left).url
        const subject = (diff.right || diff.left).value.subject

        const subjectValue = (await dbGet(subject.dbUrl))?.entry?.value
        if (!subjectValue) {
          throw new Error(`Failed to fetch thread root of comment ${reactionUrl}`)
        }
        if (!(await isCommunityMember(subjectValue.community, db.userId))) {
          throw new Error(`Author of ${diff.right.url} is not a member of the "${subjectValue.community.userId}" community`)
        }

        let reactionsIdxEntry = await this.reactionsIdx.get(subject.dbUrl)
        if (!reactionsIdxEntry) {
          reactionsIdxEntry = {
            key: subjectUrl,
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
      }
    })

    this.createIndexer('ctzn.network/owned-items-idx', ['ctzn.network/item'], async (batch, db, diff) => {
      const pend = perf.measure(`publicDb:owned-items-indexer`)
      
      const newOwner = diff.right?.value?.owner
      const oldOwner = diff.left?.value?.owner
      if (newOwner?.dbUrl === oldOwner?.dbUrl) {
        return // no change in ownership, dont need to process it
      }
      const itemUrl = (diff.right || diff.left).url

      const release = await this.lock(`owned-items-idx:${itemUrl}`)
      try {
        if (oldOwner?.dbUrl) {
          // we're the old owner, item is now gone
          const key = `${oldOwner.userId}:${(diff.right || diff.left).key}`
          await batch.del(this.ownedItemsIndex.constructBeeKey(key))
        } else if (newOwner?.dbUrl) {
          // we're the new owner, item is added
          const key = `${newOwner.userId}:${(diff.right || diff.left).key}`
          await batch.put(this.ownedItemsIndex.constructBeeKey(key), {
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

  async onDatabaseCreated () {
    console.log('New public server database created, key:', this.key.toString('hex'))
  }

  async getSubscribedDbUrls () {
    return Array.from(publicDbs.values())
      .filter(db => INDEXED_DB_TYPES.includes(db.dbType))
      .map(db => db.url)
      .concat([this.url]) // index self
  }
} 

export class PrivateServerDB extends BaseHyperbeeDB {
  constructor (key, publicServerDb) {
    super('private:server', key, {isPrivate: true})
    this.publicServerDb = publicServerDb
  }

  get dbType () {
    return 'ctzn.network/private-server-db'
  }

  isEjectableFromMemory (ts) {
    return false // never eject the private server db from memory
  }

  async setup () {
    await super.setup()
    this.indexState = this.getTable('ctzn.network/index-state')
    this.accounts = this.getTable('ctzn.network/account')
    this.accountSessions = this.getTable('ctzn.network/account-session')
    this.userDbIdx = this.getTable('ctzn.network/user-db-idx')

    this.createIndexer('ctzn.network/user-db-idx', ['ctzn.network/user'], async (batch, db, diff) => {
      const pend = perf.measure(`privateServerDb:user-db-indexer`)
      const release = await this.lock('user-db-idx')
      try {
        if (diff.left?.value?.dbUrl) {
          await batch.del(this.userDbIdx.constructBeeKey(diff.left?.value?.dbUrl))
        }
        if (diff.right?.value) {
          await batch.put(this.userDbIdx.constructBeeKey(diff.right.value.dbUrl), {
            dbUrl: diff.right.value.dbUrl,
            userId: constructUserId(diff.right.value.username)
          })
        }
      } finally {
        release()
        pend()
      }
    })

    
  }

  async getSubscribedDbUrls () {
    return [this.publicServerDb.url]
  }
  
  async onDatabaseCreated () {
    console.log('New private server database created, key:', this.key.toString('hex'))
  }
}

async function isCommunityMember (community, authorId) {
  if (community) {
    const authorMemberUrl = constructEntryUrl(community.dbUrl, 'ctzn.network/community-member', authorId)
    const authorMemberEntry = (await dbGet(authorMemberUrl))?.entry
    return !!authorMemberEntry
  }
  return true
}