import { BaseHyperbeeDB } from './base.js'

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
  constructor (key, publicUserDb) {
    super(key)
    this.publicUserDb = publicUserDb
  }

  async setup () {
    await super.setup()
    this.indexState = this.getTable('ctzn.network/index-state')
    this.commentIdx = this.getTable('ctzn.network/comment-idx')
    this.followIdx = this.getTable('ctzn.network/follow-idx')
    this.notificationIdx = this.getTable('ctzn.network/notification-idx')
    this.voteIdx = this.getTable('ctzn.network/vote-idx')
  }

  async getSubscribedDbUrls () {
    return (await this.publicUserDb.follows.list()).map(entry => entry.value.subject.dbUrl)
  }
}