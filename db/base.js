import EventEmitter from 'events'
import _debounce from 'lodash.debounce'
import { client } from './hyperspace.js'
import * as schemas from '../lib/schemas.js'
import Hyperbee from 'hyperbee'
import pump from 'pump'
import concat from 'concat-stream'
import through2 from 'through2'
import bytes from 'bytes'
import lock from '../lib/lock.js'

const BACKGROUND_INDEXING_DELAY = 5e3 // how much time is allowed to pass before globally indexing an update
const BLOB_CHUNK_SIZE = bytes('64kb')

const dbDescription = schemas.createValidator({
  type: 'object',
  additionalProperties: false,
  properties: {
    blobsFeedKey: {
      type: 'string',
      pattern: "^[a-f0-9]{64}$"
    }
  }
})

const blobPointer = schemas.createValidator({
  type: 'object',
  additionalProperties: false,
  properties: {
    start: {type: 'number'},
    end: {type: 'number'}
  }
})

export class BaseHyperbeeDB extends EventEmitter {
  constructor (key) {
    super()
    if (typeof key === 'string') {
      key = Buffer.from(key, 'hex')
    }
    this.desc = undefined
    this.key = key || null
    this.bee = null
    this.blobs = new Blobs(this)
    this.indexers = []
    this.lock = (id) => lock(`${this.key.toString('hex')}:${id}`)
  }

  get url () {
    return `hyper://${this.key.toString('hex')}/`
  }

  async setup () {
    this.bee = new Hyperbee(client.corestore().get(this.key), {
      keyEncoding: 'utf8',
      valueEncoding: 'json'
    })
    await this.bee.ready()
    client.replicate(this.bee.feed)

    if (!this.bee.feed.writable) {
      this._eagerUpdate()
    }

    if (!this.key) {
      this.key = this.bee.feed.key
      this.onDatabaseCreated()
    }

    const desc = await this.bee.get('_db')
    if (desc) {
      dbDescription.assert(desc.value)
      this.desc = desc.value
    } else {
      this.desc = {
        blobsFeedKey: null
      }
    }
  }

  async teardown () {
    if (this.blobs) await this.blobs.teardown()
    this.blobs = undefined
    client.network.configure(this.bee.feed, {announce: false, lookup: false})
    await this.bee.feed.close()
    this.bee = undefined
  }

  async updateDesc (updates) {
    for (let k in updates) {
      this.desc[k] = updates[k]
    }
    dbDescription.assert(this.desc)
    await this.bee.put('_db', this.desc)
  }

  async onDatabaseCreated () {
  }

  async whenSynced () {
    if (!this.bee.feed.writable) {
      await this.bee.feed.update({ifAvailable: true}).catch(e => undefined)
    }
  }

  watch (_cb) {
    const cb = _debounce(() => _cb(this), BACKGROUND_INDEXING_DELAY, {trailing: true})
    this.bee.feed.on('append', () => cb())
    cb() // trigger immediately to update indexes from any previously synced changes that the indexer hasnt hit
  }

  async _eagerUpdate () {
    if (!this.bee) return
    await this.bee.feed.update({ifAvailable: false}).catch(e => undefined)
    this._eagerUpdate()
  }

  getTable (schemaId) {
    let schema = schemas.get(schemaId)
    return new Table(this, schema)
  }

  async getSubscribedDbUrls () {
    // override in subclasses to
    // give a list of URLs for databases currently watched by this database for changes
    return []
  }

  createIndexer (schemaId, targetSchemaIds, indexFn) {
    this.indexers.push(new Indexer(this, schemaId, targetSchemaIds, indexFn))
  }

  async updateIndexes ({changedDb, indexStates, changes, lowestStart}) {
    if (!this.key) return
    const release = await this.lock(`update-indexes`)
    try {
      for (let i = 0; i < this.indexers.length; i++) {
        const indexer = this.indexers[i]
        const indexState = indexStates[i]
        
        let start = indexState?.value?.subject?.lastIndexedSeq || 0
        if (start === changedDb.bee.version - 1) continue
        
        let lastChange
        for (let change of changes.slice(start - lowestStart)) {
          lastChange = change
          let keyParts = change.key.split('\x00')
          change.keyParsed = {
            schemaId: keyParts.slice(0, 2).join('/'),
            key: keyParts[2]
          }
          if (indexer.isInterestedIn(change.keyParsed.schemaId)) {
            try {
              await indexer.index(changedDb, change)
            } catch (e) {
              console.error('Failed to index change')
              console.error(e)
              console.error('Changed DB:', changedDb.url)
              console.error('Change:', change)
              console.error('Indexer:', indexer.schemaId)
              break
            }
          }
        }
        if (lastChange) {
          indexer.updateState(changedDb.url, lastChange.seq)
        }
      }
    } finally {
      release()
    }
  }
}

class Blobs {
  constructor (db) {
    this.db = db
    this.kv = undefined
    this.feed = undefined
  }

  async setup () {
    this.kv = this.db.bee.sub('_blobs')

    if (!this.db.desc.blobsFeedKey) {
      this.feed = client.corestore().get(null)
      await this.feed.ready()
      await this.db.updateDesc({
        blobsFeedKey: this.feed.key.toString('hex')
      })
    } else {
      this.feed = client.corestore().get(Buffer.from(this.db.desc.blobsFeedKey, 'hex'))
      await this.feed.ready()
    }
    client.replicate(this.feed)

    // TODO track which ranges in the feed are actively pointed to and cache/decache accordingly
  }

  async teardown () {
    client.network.configure(this.feed, {announce: false, lookup: false})
    await this.feed.close()
  }

  async createReadStream (key) {
    const pointer = await this.kv.get(key)
    if (!pointer) throw new Error('Blob not found')
    blobPointer.assert(pointer.value)
    return this.feed.createReadStream({
      start: pointer.value.start,
      end: pointer.value.end
    })
  }

  async put (key, buf) {
    const chunks = chunkify(buf, BLOB_CHUNK_SIZE)
    const start = await this.feed.append(chunks)
    const pointer = {start, end: start + chunks.length}
    blobPointer.assert(pointer)
    await this.kv.put(key, pointer)
  }
}

class Table {
  constructor (db, schema) {
    const [domain, name] = schema.id.split('/')
    this.db = db
    this.bee = this.db.bee.sub(domain).sub(name)
    this.schema = schema
  }

  async get (key) {
    let entry = await this.bee.get(String(key))
    if (entry) {
      this.schema.assertValid(entry.value)
    }
    return entry
  }

  async put (key, value) {
    this.schema.assertValid(value)
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

  async list (opts) {
    return new Promise((resolve, reject) => {
      pump(
        this.createReadStream(opts),
        concat(resolve),
        err => {
          if (err) reject(err)
        }
      )
    })
  }
}

class Indexer {
  constructor (db, schemaId, targetSchemaIds, indexFn) {
    this.db = db
    this.schemaId = schemaId
    this.targetSchemaIds = targetSchemaIds
    this.index = indexFn
    this.indexStatesCache = {}
  }

  async getState (url) {
    if (!this.indexStatesCache[url] && !this.schemaId.startsWith('memory:')) {
      this.indexStatesCache[url] = await this.db.indexState.get(`${this.schemaId}:${url}`)
    }
    return this.indexStatesCache[url]
  }

  updateState (url, seq) {
    this.indexStatesCache[url] = {
      value: {
        schemaId: this.schemaId,
        subject: {dbUrl: url, lastIndexedSeq: seq},
        updatedAt: (new Date()).toISOString()
      }
    }
    if (this.schemaId.startsWith('memory:')) return
    const put = getDebouncedFn(
      `${this.db.url}:${this.schemaId}:${url}`,
      (k, v) => this.db.indexState.put(k, v).catch(e => {
        console.error('Failed to update index state')
        console.error(this.schemaId, url)
        console.error(e)
      }),
      100
    )
    put(`${this.schemaId}:${url}`, this.indexStatesCache[url].value)
  }

  isInterestedIn (schemaId) {
    return this.targetSchemaIds.includes(schemaId)
  }
}

function chunkify (buf, chunkSize) {
  const chunks = []
  while (buf.length) {
    chunks.push(buf.slice(0, chunkSize))
    buf = buf.slice(chunkSize)
  }
  return chunks
}

const _debouncers = {}
function getDebouncedFn (key, fn, wait) {
  if (!_debouncers[key]) {
    _debouncers[key] = _debounce(fn, wait)
  }
  return _debouncers[key]
}