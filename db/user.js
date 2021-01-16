import { BaseHyperbeeDB } from './base.js'

export class UserDB extends BaseHyperbeeDB {
  async setup () {
    await super.setup()
    this.profile = await this.getTable('https://ctzn.network/profile.json')
    this.posts = await this.getTable('https://ctzn.network/post.json')
    this.votes = await this.getTable('https://ctzn.network/vote.json')
    this.comments = await this.getTable('https://ctzn.network/comment.json')
    this.follows = await this.getTable('https://ctzn.network/follow.json')
  }
}
