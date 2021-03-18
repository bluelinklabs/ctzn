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

    this.createIndexer('ctzn.network/user-db-idx', ['ctzn.network/user'], async (batch, db, diff) => {
      const pend = perf.measure(`privateServerDb:user-db-indexer`)
      const release = await this.lock('user-db-idx')
      try {
        if (diff.left?.value?.dbUrl) {
          await batch.del(this.userDbIdx.constructBeeKey(diff.left?.value?.dbUrl))
        }
        if (diff.right?.value) {
          await batch.put(this.userDbIdx.constructBeeKey(diff.right.value.dbUrl), {
            dbUrl: diff.right.value.dbUrl,
            userId: constructUserId(diff.right.value.username)
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
