import { BaseHyperbeeDB } from './base.js'
import { constructUserId, getDomain } from '../lib/strings.js'
import * as perf from '../lib/perf.js'

export class PublicServerDB extends BaseHyperbeeDB {
  constructor (key) {
    super('public:server', key)
  }

  get dbType () {
    return 'ctzn.network/public-server-db'
  }

  async setup () {
    await super.setup()
    this.users = this.getTable('ctzn.network/user')
  }

  async onDatabaseCreated () {
    console.log('New public server database created, key:', this.key.toString('hex'))
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

  async setup () {
    await super.setup()
    this.indexState = this.getTable('ctzn.network/index-state')
    this.accounts = this.getTable('ctzn.network/account')
    this.accountSessions = this.getTable('ctzn.network/account-session')
    this.userDbIdx = this.getTable('ctzn.network/user-db-idx')

    this.createIndexer('ctzn.network/user-db-idx', ['ctzn.network/user'], async (db, change) => {
      const pend = perf.measure(`privateServerDb:user-db-indexer`)
      const release = await this.lock('user-db-idx')
      try {
        let oldEntry = await db.bee.checkout(change.seq).get(change.key)
        if (oldEntry?.value?.dbUrl) {
          await this.userDbIdx.del(oldEntry.value.dbUrl)
        }
        if (change.value) {
          await this.userDbIdx.put(change.value.dbUrl, {
            dbUrl: change.value.dbUrl,
            userId: constructUserId(change.value.username)
          })
        }
      } finally {
        release()
        pend()
      }
    })
  }

  async getSubscribedDbUrls () {
    return [this.publicServerDb.url]
  }
  
  async onDatabaseCreated () {
    console.log('New private server database created, key:', this.key.toString('hex'))
  }
}
