import { BaseHyperbeeDB } from './base.js'

export class PublicServerDB extends BaseHyperbeeDB {
  async setup () {
    await super.setup()
    this.users = await this.getTable('https://ctzn.network/user.json')
    this.featuredPostsIdx = await this.getTable('https://ctzn.network/featured-post-idx.json')
    this.commentsIdx = await this.getTable('https://ctzn.network/comment-idx.json')
    this.votesIdx = await this.getTable('https://ctzn.network/vote-idx.json')
  }

  async onDatabaseCreated () {
    console.log('New public server database created, key:', this.key.toString('hex'))
  }
}

export class PrivateServerDB extends BaseHyperbeeDB {
  async setup () {
    await super.setup()
    this.accounts = await this.getTable('https://ctzn.network/account.json')
  }
  
  async onDatabaseCreated () {
    console.log('New private server database created, key:', this.key.toString('hex'))
  }
}