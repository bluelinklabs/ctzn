import createMlts from 'monotonic-lexicographic-timestamp'
import { BaseHyperbeeDB } from './base.js'
import { publicDbs } from './index.js'
import { dbGet } from './util.js'
import { constructEntryUrl } from '../lib/strings.js'
import { deepClone } from '../lib/functions.js'
import _intersectionBy from 'lodash.intersectionby'

const INDEXED_DB_TYPES = [
  'ctzn.network/public-citizen-db',
  'ctzn.network/public-community-db'
]
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
        case 'ctzn.network/reaction':
        case 'ctzn.network/follow': {
          const subjectDbKey = value.subject.dbKey || value.subject.authorDbKey
          const subjectDb = publicDbs.get(subjectDbKey)
          if (!subjectDb) return // not one of our users

          if (subjectDbKey === db.dbKey) {
            return // acting on own content, ignore
          }

          const followEntry = await subjectDb.getTable('ctzn.network/follow').get(db.dbKey)
          if (!followEntry) {
            const [subjectMemberships, authorMemberships] = await Promise.all([
              subjectDb.getTable('ctzn.network/community-membership').list(),
              db.getTable('ctzn.network/community-membership').list(),
            ])
            const sharedMemberships = _intersectionBy(subjectMemberships, authorMemberships, m => m.value.community.dbKey)
            // TODO verify membership so that banned users can't take advantage of this -prf
            if (sharedMemberships.length === 0) {
              return // author is not followed by subject or in the same community
            }
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
          const rootSubjectDb = value.reply.root ? publicDbs.get(value.reply.root.authorDbKey) : undefined
          const parentSubjectDb = value.reply.parent ? publicDbs.get(value.reply.parent.authorDbKey) : undefined
          if (!rootSubjectDb && !parentSubjectDb) return // not one of our users
          if (value.community) {
            // comment on a community
            const [rootSubjectMemberEntry, parentSubjectMemberEntry, authorMemberEntry] = await Promise.all([
              rootSubjectDb ? dbGet(constructEntryUrl(value.community.dbUrl, 'ctzn.network/community-member', rootSubjectDb.dbKey)) : undefined,
              parentSubjectDb ? dbGet(constructEntryUrl(value.community.dbUrl, 'ctzn.network/community-member', rootSubjectDb.dbKey)) : undefined,
              dbGet(constructEntryUrl(value.community.dbUrl, 'ctzn.network/community-member', db.dbKey))
            ])
            if (!authorMemberEntry) {
              return // author is not a member of the community
            }
            if (rootSubjectMemberEntry && rootSubjectDb.url !== db.url) {
              // notification for root post author
              const {key, idxkey} = genKey(rootSubjectDb.dbKey)
              await batch.put(key, {
                subjectDbKey: rootSubjectDb.dbKey,
                idxkey,
                itemUrl: diff.right.url,
                createdAt: createdAt.toISOString()
              })
            }
            if (parentSubjectMemberEntry && parentSubjectDb.url !== db.url && rootSubjectDb?.url !== parentSubjectDb.url) {
              // notification for parent post author
              const {key, idxkey} = genKey(parentSubjectDb.dbKey)
              await batch.put(key, {
                subjectDbKey: parentSubjectDb.dbKey,
                idxkey,
                itemUrl: diff.right.url,
                createdAt: createdAt.toISOString()
              })
            }
          } else {
            // comment on a self-post
            const [rootSubjectFollowEntry, parentSubjectFollowEntry] = await Promise.all([
              rootSubjectDb ? rootSubjectDb.getTable('ctzn.network/follow').get(db.dbKey) : undefined,
              parentSubjectDb ? parentSubjectDb.getTable('ctzn.network/follow').get(db.dbKey) : undefined
            ])
            if (rootSubjectFollowEntry && rootSubjectDb.url !== db.url) {
              // notification for root post author
              const {key, idxkey} = genKey(rootSubjectDb.dbKey)
              await batch.put(key, {
                subjectDbKey: rootSubjectDb.dbKey,
                idxkey,
                itemUrl: diff.right.url,
                createdAt: createdAt.toISOString()
              })
            }
            if (parentSubjectFollowEntry && parentSubjectDb.url !== db.url && rootSubjectDb?.url !== parentSubjectDb.url) {
              // notification for parent post author
              const {key, idxkey} = genKey(parentSubjectDb.dbKey)
              await batch.put(key, {
                subjectDbKey: parentSubjectDb.dbKey,
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
      if (!(await isCommunityMember(replyRootValue.community, db.dbKey))) {
        throw new Error(`Author of ${commentUrl} is not a member of the "${replyRootValue.community.dbKey}" community`)
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
        } finally {
          release()
        }
      }
    })
    
    this.createIndexer('ctzn.network/etc/community-posts', ['ctzn.network/post'], async (batch, db, diff) => {
      if (!diff.left?.value?.community && !diff.right?.value?.community) {
        return // only index community posts
      }
      const leftCommunityDb = diff.left?.value?.community?.dbKey ? publicDbs.get(diff.left.value.community.dbKey) : undefined
      const rightCommunityDb = diff.right?.value?.community?.dbKey ? publicDbs.get(diff.right.value.community.dbKey) : undefined
      if (db === leftCommunityDb || db === rightCommunityDb) {
        return // ignore updates to community posts table because that's probably the copy
      }

      const isCreate = !diff.left && diff.right
      const isEdit = diff.left && diff.right
      const isDelete = diff.left && !diff.right
      const didCommunityChange = isEdit && leftCommunityDb.dbKey !== rightCommunityDb.dbKey
      let newValue
      if (isCreate || isEdit) {
        newValue = deepClone(diff.right.value)
        // TODO include a proof of authorship
        newValue.source = {
          dbUrl: diff.right.url,
          author: {
            displayName: (await db.profile.get('self').catch(e => undefined))?.value.displayName
          }
        }
      }

      if ((isDelete || didCommunityChange) && leftCommunityDb?.writable) {
        if (await isCommunityMember(leftCommunityDb, db.dbKey)) {
          const postEntry = await leftCommunityDb.posts.scanFind({reverse: true}, entry => (
            entry.value.source?.dbUrl === diff.left.url
          )).catch(e => undefined)
          if (postEntry) {
            await leftCommunityDb.posts.del(postEntry.key)
          }
        }
      }
      if ((isCreate || didCommunityChange) && rightCommunityDb?.writable) {
        if (await isCommunityMember(leftCommunityDb, db.dbKey)) {
          await rightCommunityDb.posts.put(
            rightCommunityDb.posts.schema.generateKey(newValue),
            newValue
          )
        }
      }
      if (isEdit && !didCommunityChange) {
        const postEntry = await rightCommunityDb.posts.scanFind({reverse: true}, entry => (
          entry.value.source?.dbUrl === diff.left.url
        )).catch(e => undefined)
        if (postEntry) {
          await rightCommunityDb.posts.put(
            postEntry.key,
            newValue
          )
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
              subjectId: subject.dbKey,
              followerIds: []
            }
          }
        }
        const followerId = db.dbKey
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
        if (!(await isCommunityMember(subjectValue.community, db.dbKey))) {
          throw new Error(`Author of ${diff.right.url} is not a member of the "${subjectValue.community.dbKey}" community`)
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
  }

  async getSubscribedDbUrls () {
    return [this.publicServerDb.url]
  }
  
  async onDatabaseCreated () {
    console.log('New private server database created, key:', this.key.toString('hex'))
  }
}

async function isCommunityMember (community, authorDbKey) {
  if (community) {
    const authorMemberUrl = constructEntryUrl(`hyper://${community.dbKey}`, 'ctzn.network/community-member', authorDbKey)
    const authorMemberEntry = (await dbGet(authorMemberUrl))?.entry
    return !!authorMemberEntry
  }
  return true
}