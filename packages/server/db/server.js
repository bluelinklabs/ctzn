import createMlts from 'monotonic-lexicographic-timestamp'
import { BaseHyperbeeDB } from './base.js'
import { privateDbs, getDb } from './index.js'
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
    this.communitiesIdx = this.getTable('ctzn.network/community-idx')
    this.followsIdx = this.getTable('ctzn.network/follow-idx')
    this.reactionsIdx = this.getTable('ctzn.network/reaction-idx')
    this.repostsIdx = this.getTable('ctzn.network/repost-idx')
    this.votesIdx = this.getTable('ctzn.network/vote-idx')

    this.memberDbKeys = new Set()
    this.memberFollowedDbKeys = new Set()

    if (!this.writable) {
      return
    }

    const NOTIFICATIONS_SCHEMAS = [
      'ctzn.network/follow',
      'ctzn.network/comment',
      'ctzn.network/post',
      'ctzn.network/reaction',
      'ctzn.network/vote'
    ]
    this.createIndexer('ctzn.network/notification', NOTIFICATIONS_SCHEMAS, async (batch, db, diff) => {
      if (!diff.right) return // ignore deletes
      if (diff.left && diff.right) return // ignore edits

      const createdAt = new Date()
      const value = diff.right.value
      const itemCreatedAt = new Date(value.createdAt)
      const getPrivateDb = dbKey => {
        const subjectDb = getDb(dbKey)
        if (!subjectDb || !subjectDb.writable) return false // not one of our users
        return privateDbs.get(subjectDb.username)
      }
      const genKey = () => mlts(Math.min(+createdAt, (+itemCreatedAt) || (+createdAt)))
      switch (diff.right.schemaId) {
        case 'ctzn.network/follow': {
          const subjectDbKey = value.subject.dbKey || value.subject.authorDbKey
          if (subjectDbKey === db.dbKey) return // acting on self, ignore
          let privDb = getPrivateDb(subjectDbKey)
          if (!privDb) return
          const idxkey = genKey()
          await privDb.notifications.put(idxkey, {
            subjectDbKey,
            idxkey,
            itemUrl: diff.right.url,
            createdAt: createdAt.toISOString()
          })
          break
        }
        case 'ctzn.network/post': {
          if (!diff.right.value?.source?.dbUrl) return // only handle reposts
          let urlp = parseEntryUrl(diff.right.value.source.dbUrl)
          if (urlp.dbKey === db.dbKey) return // acting on self, ignore
          let privDb = getPrivateDb(urlp.dbKey)
          if (!privDb) return
          const idxkey = genKey()
          await privDb.notifications.put(idxkey, {
            subjectDbKey: urlp.dbKey,
            idxkey,
            itemUrl: diff.right.url,
            createdAt: createdAt.toISOString()
          })
          break
        }
        case 'ctzn.network/reaction':
        case 'ctzn.network/vote': {
          const {dbKey: subjectDbKey} = parseEntryUrl(value.subject.dbUrl)
          if (subjectDbKey === db.dbKey) return // acting on self, ignore
          let privDb = getPrivateDb(subjectDbKey)
          if (!privDb) return
          const idxkey = genKey()
          await privDb.notifications.put(idxkey, {
            subjectDbKey,
            idxkey,
            itemUrl: diff.right.url,
            createdAt: createdAt.toISOString()
          })
          break
        }
        case 'ctzn.network/comment': {
          let rootUrlp = value.reply.root ? parseEntryUrl(value.reply.root.dbUrl) : undefined
          let parentUrlp = value.reply.parent ? parseEntryUrl(value.reply.parent.dbUrl) : undefined
          const rootSubjectDb = value.reply.root ? getPrivateDb(rootUrlp.dbKey) : undefined
          const parentSubjectDb = value.reply.parent ? getPrivateDb(parentUrlp.dbKey) : undefined
          if (!rootSubjectDb?.writable && !parentSubjectDb?.writable) return // not one of our users
          if (rootSubjectDb && rootUrlp.dbKey !== db.dbKey) {
            // notification for root post author
            const idxkey = genKey()
            await rootSubjectDb.notifications.put(idxkey, {
              subjectDbKey: rootUrlp.dbKey,
              idxkey,
              itemUrl: diff.right.url,
              createdAt: createdAt.toISOString()
            })
          }
          if (parentSubjectDb && parentUrlp.dbKey !== db.dbKey && rootSubjectDb?.dbKey !== parentSubjectDb.dbKey) {
            // notification for parent post author
            const idxkey = genKey()
            await batch.put(idxkey, {
              subjectDbKey: parentUrlp.dbKey,
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

    this.createIndexer('ctzn.network/community-idx', ['ctzn.network/profile'], async (batch, db, diff) => {
      const oldCommunities = new Set(diff.left?.value?.communities || [])
      const newCommunities = new Set(diff.right?.value?.communities || [])
      const removedCommunities = new Set([...oldCommunities].filter(x => !newCommunities.has(x)))
      const addedCommunities = new Set([...newCommunities].filter(x => !oldCommunities.has(x)))
      const memberDbKey = db.dbKey

      for (let community of removedCommunities) {
        const release = await this.communitiesIdx.lock(community)
        try {
          let communityIdxEntry = await this.communitiesIdx.get(community)
          if (!communityIdxEntry) continue
          const memberDbKeyIndex = communityIdxEntry.value.memberDbKeys.indexOf(memberDbKey)
          if (memberDbKey !== -1) {
            communityIdxEntry.value.memberDbKeys.splice(memberDbKeyIndex, 1)
          }
          if (communityIdxEntry.value.memberDbKeys.length) {
            await batch.put(this.communitiesIdx.constructBeeKey(communityIdxEntry.key), communityIdxEntry.value)
          } else {
            await batch.del(this.communitiesIdx.constructBeeKey(communityIdxEntry.key))
          }
        } finally {
          release()
        }
      }
      for (let community of addedCommunities) {
        const release = await this.communitiesIdx.lock(community)
        try {
          let communityIdxEntry = await this.communitiesIdx.get(community)
          if (!communityIdxEntry) {
            communityIdxEntry = {
              key: community,
              value: {community, memberDbKeys: []}
            }
          }
          const memberDbKeyIndex = communityIdxEntry.value.memberDbKeys.indexOf(memberDbKey)
          if (memberDbKeyIndex === -1) {
            communityIdxEntry.value.memberDbKeys.push(memberDbKey)
          }
          await batch.put(this.communitiesIdx.constructBeeKey(communityIdxEntry.key), communityIdxEntry.value)
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

    this.createIndexer('ctzn.network/repost-idx', ['ctzn.network/post'], async (batch, db, diff) => {
      const leftDbUrl = diff.left?.value?.source?.dbUrl
      const rightDbUrl = diff.right?.value?.source?.dbUrl
      if (!leftDbUrl && !rightDbUrl) return
      if (leftDbUrl === rightDbUrl) return

      if (leftDbUrl) {
        const release = await this.repostsIdx.lock(leftDbUrl)
        try {
          let repostsIdxEntry = await this.repostsIdx.get(leftDbUrl)
          if (repostsIdxEntry) {
            let i = repostsIdxEntry.value.reposts.findIndex(r => r.dbKey === db.dbKey)
            if (i !== -1) {
              repostsIdxEntry.value.reposts.splice(i, 1)
              await batch.put(this.repostsIdx.constructBeeKey(repostsIdxEntry.key), repostsIdxEntry.value)
            }
          }
        } finally {
          release()
        }
      }
      if (rightDbUrl) {
        const release = await this.repostsIdx.lock(rightDbUrl)
        try {
          let repostsIdxEntry = await this.repostsIdx.get(rightDbUrl)
          if (!repostsIdxEntry) {
            repostsIdxEntry = {
              key: rightDbUrl,
              value: {
                subject: {dbUrl: rightDbUrl},
                reposts: []
              }
            }
          }
          let i = repostsIdxEntry.value.reposts.findIndex(r => r.dbKey === db.dbKey)
          if (i === -1) {
            repostsIdxEntry.value.reposts.push({dbKey: db.dbKey, postKey: diff.right.key})
            await batch.put(this.repostsIdx.constructBeeKey(repostsIdxEntry.key), repostsIdxEntry.value)
          }
        } finally {
          release()
        }
      }
    })

    this.createIndexer('ctzn.network/vote-idx', ['ctzn.network/vote'], async (batch, db, diff) => {
      const subjectUrl = (diff.right || diff.left).value.subject.dbUrl
      const oldVote = diff.left?.value?.vote || 0
      const newVote = diff.right?.value?.vote || 0
      if (oldVote === newVote) return

      const release = await this.votesIdx.lock(subjectUrl)
      try {
        let votesIdxEntry = await this.votesIdx.get(subjectUrl)
        if (!votesIdxEntry) {
          votesIdxEntry = {
            key: subjectUrl,
            value: {
              subject: {dbUrl: subjectUrl},
              upvoterDbKeys: [],
              downvoterDbKeys: []
            }
          }
        }
  
        if (oldVote === -1) {
          let i = votesIdxEntry.value.downvoterDbKeys.indexOf(db.dbKey)
          if (i !== -1) votesIdxEntry.value.downvoterDbKeys.splice(i, 1)
        } else if (oldVote === 1) {
          let i = votesIdxEntry.value.upvoterDbKeys.indexOf(db.dbKey)
          if (i !== -1) votesIdxEntry.value.upvoterDbKeys.splice(i, 1)
        }
  
        if (newVote === -1) {
          let i = votesIdxEntry.value.downvoterDbKeys.indexOf(db.dbKey)
          if (i === -1) votesIdxEntry.value.downvoterDbKeys.push(db.dbKey)
        } else if (newVote === 1) {
          let i = votesIdxEntry.value.upvoterDbKeys.indexOf(db.dbKey)
          if (i === -1) votesIdxEntry.value.upvoterDbKeys.push(db.dbKey)
        }
  
        await batch.put(this.votesIdx.constructBeeKey(votesIdxEntry.key), votesIdxEntry.value)
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
