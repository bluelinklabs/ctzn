import { BaseHyperbeeDB } from './base.js'
import * as perf from '../lib/perf.js'


export class PublicCitizenDB extends BaseHyperbeeDB {
  constructor (userId, key) {
    super(`public:${userId}`, key)
    this.userId = userId
  }

  get dbType () {
    return 'ctzn.network/public-citizen-db'
  }

  async setup () {
    await super.setup()
    await this.blobs.setup()
    this.dbmethodCalls = this.getTable('ctzn.network/dbmethod-call')
    this.profile = this.getTable('ctzn.network/profile')
    this.posts = this.getTable('ctzn.network/post')
    this.comments = this.getTable('ctzn.network/comment')
    this.reactions = this.getTable('ctzn.network/reaction')
    this.pages = this.getTable('ctzn.network/page')
    this.follows = this.getTable('ctzn.network/follow')
    this.memberships = this.getTable('ctzn.network/community-membership')

    this.memberships.onPut(() => this.emit('subscriptions-changed'))
    this.memberships.onDel(() => this.emit('subscriptions-changed'))
    this.follows.onPut(() => this.emit('subscriptions-changed'))
    this.follows.onDel(() => this.emit('subscriptions-changed'))
  }
}

export class PrivateCitizenDB extends BaseHyperbeeDB {
  constructor (userId, key, publicServerDb, publicDb) {
    super(`private:${userId}`, key, {isPrivate: true})
    this.userId = userId
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