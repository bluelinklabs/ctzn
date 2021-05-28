import createMlts from 'monotonic-lexicographic-timestamp'
import { BaseHyperbeeDB } from './base.js'
import { publicDbs, getDb } from './index.js'
import { dbGet } from './util.js'
import { parseEntryUrl } from '../lib/strings.js'
import _intersectionBy from 'lodash.intersectionby'

const mlts = createMlts()

export class PublicServerDB extends BaseHyperbeeDB {
  constructor (key, username) {
    super('public:server', key)
    this.username = username
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
    this.threadIdx = this.getTable('ctzn.network/thread-idx')
    this.followsIdx = this.getTable('ctzn.network/follow-idx')
    this.notificationsIdx = this.getTable('ctzn.network/notification-idx')
    this.reactionsIdx = this.getTable('ctzn.network/reaction-idx')

    this.memberDbKeys = new Set()
    this.memberFollowedDbKeys = new Set()

    if (!this.writable) {
      return
    }

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
      const genKey = dbKey => {
        const idxkey = mlts(Math.min(+createdAt, (+itemCreatedAt) || (+createdAt)))
        return {idxkey, key: this.notificationsIdx.constructBeeKey(`${dbKey}:${idxkey}`)}
      }
      switch (diff.right.schemaId) {
        case 'ctzn.network/follow': {
          const subjectDbKey = value.subject.dbKey || value.subject.authorDbKey
          const subjectDb = getDb(subjectDbKey)
          if (!subjectDb || !subjectDb.writable) return // not one of our users
          const {key, idxkey} = genKey(subjectDbKey)
          await batch.put(key, {
            subjectDbKey,
            idxkey,
            itemUrl: diff.right.url,
            createdAt: createdAt.toISOString()
          })
          break
        }
        case 'ctzn.network/reaction': {
          const {dbKey: subjectDbKey} = parseEntryUrl(value.subject.dbUrl)
          const subjectDb = getDb(subjectDbKey)
          if (!subjectDb) return // not one of our users

          if (subjectDbKey === db.dbKey) {
            return // acting on own content, ignore
          }

          const {key, idxkey} = genKey(subjectDbKey)
          await batch.put(key, {
            subjectDbKey,
            idxkey,
            itemUrl: diff.right.url,
            createdAt: createdAt.toISOString()
          })
          break
        }
        case 'ctzn.network/comment': {
          const rootSubjectDb = value.reply.root ? getDb(parseEntryUrl(value.reply.root.dbUrl).dbKey) : undefined
          const parentSubjectDb = value.reply.parent ? getDb(parseEntryUrl(value.reply.parent.dbUrl).dbKey) : undefined
          if (!rootSubjectDb?.writable && !parentSubjectDb?.writable) return // not one of our users
          if (rootSubjectDb && rootSubjectDb.url !== db.url) {
            // notification for root post author
            const {key, idxkey} = genKey(rootSubjectDb.dbKey)
            await batch.put(key, {
              subjectDbKey: rootSubjectDb.dbKey,
              idxkey,
              itemUrl: diff.right.url,
              createdAt: createdAt.toISOString()
            })
          }
          if (parentSubjectDb && parentSubjectDb.url !== db.url && rootSubjectDb?.url !== parentSubjectDb.url) {
            // notification for parent post author
            const {key, idxkey} = genKey(parentSubjectDb.dbKey)
            await batch.put(key, {
              subjectDbKey: parentSubjectDb.dbKey,
              idxkey,
              itemUrl: diff.right.url,
              createdAt: createdAt.toISOString()
            })
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

      for (let target of targets) {
        const release = await this.lock(`thread-idx:${target.dbUrl}`)
        try {
          let threadIdxEntry = batch.threadIdxEntries?.[target.dbUrl] || await this.threadIdx.get(target.dbUrl)
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
              const authorDbKey = db.dbKey
              threadIdxEntry.value.items.push({dbUrl: commentUrl, authorDbKey})
              await batch.put(this.threadIdx.constructBeeKey(threadIdxEntry.key), threadIdxEntry.value)
            }
          } else if (diff.left) {
            if (itemUrlIndex !== -1) {
              threadIdxEntry.value.items.splice(itemUrlIndex, 1)
              await batch.put(this.threadIdx.constructBeeKey(threadIdxEntry.key), threadIdxEntry.value)
            }
          }

          // cache in the batch to avoid possibly clobbering writes that occur in the batch
          batch.threadIdxEntries = batch.threadIdxEntries || {}
          batch.threadIdxEntries[target.dbUrl] = threadIdxEntry
        } finally {
          release()
        }
      }
    })

    this.createIndexer('ctzn.network/follow-idx', ['ctzn.network/follow'], async (batch, db, diff) => {
      const subject = diff.right?.value?.subject || diff.left?.value?.subject
      const release = await this.followsIdx.lock(subject.dbKey)
      try {
        let followsIdxEntry = await this.followsIdx.get(subject.dbKey)
        if (!followsIdxEntry) {
          followsIdxEntry = {
            key: subject.dbKey,
            value: {
              subjectDbKey: subject.dbKey,
              followerDbKeys: []
            }
          }
        }
        const followerDbKey = db.dbKey
        const followerDbKeyIndex = followsIdxEntry.value.followerDbKeys.indexOf(followerDbKey)
        if (diff.right) {
          if (followerDbKeyIndex === -1) {
            followsIdxEntry.value.followerDbKeys.push(followerDbKey)
          }
        } else if (diff.left) {
          if (followerDbKeyIndex !== -1) {
            followsIdxEntry.value.followerDbKeys.splice(followerDbKeyIndex, 1)
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
  }

  async onDatabaseCreated () {
    console.log('New public server database created, key:', this.key.toString('hex'))
  }

  shouldIndexDb (db) {
    return (this.memberDbKeys.has(db.dbKey) || this.memberFollowedDbKeys.has(db.dbKey))
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
  }

  shouldIndexDb (db) {
    return db === this.publicServerDb
  }
  
  async onDatabaseCreated () {
    console.log('New private server database created, key:', this.key.toString('hex'))
  }
}
