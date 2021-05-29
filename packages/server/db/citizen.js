import { BaseHyperbeeDB } from './base.js'

export class PublicCitizenDB extends BaseHyperbeeDB {
  constructor (key, username) {
    super(`public:${username || key.toString('hex').slice(0, 8)}`, key)
    this.username = username
  }

  get dbType () {
    return 'ctzn.network/public-citizen-db'
  }

  async setup () {
    await super.setup()
    await this.blobs.setup()
    this.profile = this.getTable('ctzn.network/profile')
    this.currentStatus = this.getTable('ctzn.network/current-status')
    this.posts = this.getTable('ctzn.network/post')
    this.comments = this.getTable('ctzn.network/comment')
    this.reactions = this.getTable('ctzn.network/reaction')
    this.follows = this.getTable('ctzn.network/follow')

    this.follows.onPut(() => this.emit('subscriptions-changed'))
    this.follows.onDel(() => this.emit('subscriptions-changed'))
  }
}

export class PrivateCitizenDB extends BaseHyperbeeDB {
  constructor (key, username, publicServerDb, publicDb) {
    super(`private:${username || key.toString('hex').slice(0, 8)}`, key, {isPrivate: true})
    this.username = username
    this.publicServerDb = publicServerDb
    this.publicDb = publicDb
  }

  get dbType () {
    return 'ctzn.network/private-citizen-db'
  }

  async setup () {
    await super.setup()
  }
}