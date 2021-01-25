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
  async setup () {
    await super.setup()
  }
}