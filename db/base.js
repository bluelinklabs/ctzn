import { client } from './hyperspace.js'
import * as schemas from './schemas.js'
import Hyperbee from 'hyperbee'
import pump from 'pump'
import concat from 'concat-stream'
import through2 from 'through2'

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
    console.log('New Hyperbee Database Created:', this.key.toString('hex'))
    console.log('(Warning: this function should have been overridden.)')
  }

  async getTable (schemaUrl) {
    let schema = await schemas.fetch(schemaUrl)
    
    let tableDef = await this.bee.sub('tables').get(schemaUrl)
    if (tableDef && (typeof tableDef.value !== 'object' || typeof tableDef.value.id !== 'number')) {
      console.error('Incorrect table definition for', schemaUrl)
      console.error('Definition:', tableDef)
      console.error('Must be an object containing a .id number value')
      process.exit(1)
    }
    if (!tableDef) {
      // find the next unused ID
      let tableDefs = await new Promise((resolve, reject) => {
        pump(
          this.bee.sub('tables').createReadStream(),
          concat(resolve),
          reject
        )
      })
      tableDefs.sort((a, b) => b.value.id - a.value.id)
      let highestId = tableDefs[0] ? tableDefs[0].value.id : 0
      tableDef = {key: schemaUrl, seq: undefined, id: highestId + 1}

      // save new table definition
      await this.bee.sub('tables').put(schemaUrl, tableDef)
    }

    return new Table(this, schema, tableDef.value.id)
  }
}

class Table {
  constructor (db, schema, id) {
    this.db = db
    this.bee = this.db.bee.sub('tables').sub(String(id))
    this.schema = schema
    this.id = id
  }

  _validate (value) {
    const valid = this.schema.validate(value)
    if (!valid) {
      throw new ValidationError(this.schema.validate.errors[0])
    }
  }

  async get (key) {
    let entry = await this.bee.get(String(key))
    if (entry) {
      this._validate(entry.value)
    }
    return entry
  }

  async put (key, value) {
    this._validate(value)
    return this.bee.put(String(key), value)
  }

  async del (key) {
    return this.bee.del(String(key))
  }

  createReadStream (opts) {
    let _this = this
    return this.bee.createReadStream(opts).pipe(through2.obj(function (entry, enc, cb) {
      const valid = _this.schema.validate(entry.value)
      if (valid) this.push(entry)
      cb()
    }))
  }
}

class ValidationError extends Error {
  constructor (info) {
    super()
    for (let k in info) {
      this[k] = info[k]
    }
  }
}