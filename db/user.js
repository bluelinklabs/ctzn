import { BaseHyperbeeDB } from './base.js'
import { constructEntryUrl } from '../lib/strings.js'
import lock from '../lib/lock.js'

export class PublicUserDB extends BaseHyperbeeDB {
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
  constructor (key, publicServerDb, publicUserDb) {
    super(key)
    this.publicServerDb = publicServerDb
    this.publicUserDb = publicUserDb
  }

  async setup () {
    await super.setup()
    this.indexState = this.getTable('ctzn.network/index-state')
    this.commentIdx = this.getTable('ctzn.network/comment-idx')
    this.followIdx = this.getTable('ctzn.network/follow-idx')
    this.notificationIdx = this.getTable('ctzn.network/notification-idx')
    this.voteIdx = this.getTable('ctzn.network/vote-idx')

    const NOTIFICATIONS_SCHEMAS = [
      'ctzn.network/follow',
      'ctzn.network/comment',
      'ctzn.network/vote'
    ]
    this.createIndexer('ctzn.network/notification-idx', NOTIFICATIONS_SCHEMAS, async (db, change) => {
      const myUrl = this.publicUserDb.url
      if (!change.value) return // ignore deletes
      if (db.url === myUrl) return // ignore self

      const release = await this.lock(`notifications-idx`)
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
            let {subjectUrl, parentCommentUrl} = change.value
            if (!subjectUrl.startsWith(myUrl) && !parentCommentUrl?.startsWith(myUrl)) {
              return false
            }
            break
          }
          case 'ctzn.network/vote':
            // vote on my content?
            if (!change.value.subjectUrl.startsWith(myUrl)) {
              return false
            }
            break
        }
        
        const d = new Date()
        const idxValue = {
          itemUrl: constructEntryUrl(db.url, change.keyParsed.schemaId, change.keyParsed.key),
          createdAt: d.toISOString()
        }
        await this.notificationIdx.put(+d, idxValue)
      } finally {
        release()
      }
    })
  }

  async getSubscribedDbUrls () {
    return (
      (await this.publicUserDb.follows.list()).map(entry => entry.value.subject.dbUrl)
      .concat((await this.publicServerDb.users.list()).map(entry => entry.value.dbUrl))
    )
  }
}