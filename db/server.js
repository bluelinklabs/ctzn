import { BaseHyperbeeDB } from './base.js'

export class PublicServerDB extends BaseHyperbeeDB {
  async onDatabaseCreated () {
    console.log('New public server database created, key:', this.key.toString('hex'))
  }
}

export class PrivateServerDB extends BaseHyperbeeDB {
  async onDatabaseCreated () {
    console.log('New private server database created, key:', this.key.toString('hex'))
  }
}