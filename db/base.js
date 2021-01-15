import { client } from './hyperspace.js'
import Hyperbee from 'hyperbee'

export class BaseHyperbeeDB {
  constructor (key) {
    if (typeof key === 'string') {
      key = Buffer.from(key, 'hex')
    }
    this.key = key || null
    this.bee = null
  }

  async setup () {
    this.bee = new Hyperbee(client.corestore().get(this.key), {
      keyEncoding: 'utf8',
      valueEncoding: 'json'
    })
    await this.bee.ready()

    if (!this.key) {
      this.key = this.bee.feed.key
      this.onDatabaseCreated()
    }
  }

  async onDatabaseCreated () {
    // override me
    console.log('New Hyperbee Database Created:', this.key)
    console.log('(Warning: this function should have been overridden.)')
  }
}