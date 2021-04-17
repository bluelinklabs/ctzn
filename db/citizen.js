import { BaseHyperbeeDB } from './base.js'
import * as perf from '../lib/perf.js'

export class PublicCitizenDB extends BaseHyperbeeDB {
  constructor (userId, key, extensions) {
    super(`public:${userId}`, key)
    this.userId = userId
    this.extensions = extensions
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
    this.follows = this.getTable('ctzn.network/follow')
    this.memberships = this.getTable('ctzn.network/community-membership')

    this.memberships.onPut(() => this.emit('subscriptions-changed'))
    this.memberships.onDel(() => this.emit('subscriptions-changed'))
    this.follows.onPut(() => this.emit('subscriptions-changed'))
    this.follows.onDel(() => this.emit('subscriptions-changed'))

    if (this.extensions) {
      const publicCitizenDbExtensions = Array.from(this.extensions).map((extension) => extension.default.publicCitizenDbExtensions).flat().filter(Boolean)
      for (let extension of publicCitizenDbExtensions) {
        extension.setup(this)
      }
    }
  }
}

export class PrivateCitizenDB extends BaseHyperbeeDB {
  constructor (userId, key, publicServerDb, publicDb, extensions) {
    super(`private:${userId}`, key, {isPrivate: true})
    this.userId = userId
    this.publicServerDb = publicServerDb
    this.publicDb = publicDb
    this.extensions = extensions
  }

  get dbType () {
    return 'ctzn.network/private-citizen-db'
  }

  async setup () {
    await super.setup()

    if (this.extensions) {
      const privateCitizenDbExtensions = Array.from(this.extensions).map((extension) => extension.default.privateCitizenDbExtensions).flat().filter(Boolean)
      for (let extension of privateCitizenDbExtensions) {
        extension.setup(this, { perf })
      }
    }
  }
}
