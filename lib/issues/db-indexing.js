import { BaseIssue } from './base.js'
import { getDbByUrl, catchupIndexes } from '../../db/index.js'

export class DbIndexingIssue extends BaseIssue {
  constructor ({error, changedDb, change, indexingDb, indexer}) {
    super()
    this._error = error
    this.changedDbUrl = changedDb.url
    this.changedDbIdent = changedDb._ident
    this.change = change
    this.indexingDbUrl = indexingDb.url
    this.indexingDbIdent = indexingDb._ident
    this.indexerSchemaId = indexer.schemaId
  }

  getIndexingDb () {
    return getDbByUrl(this.indexingDbUrl)
  }

  getChangedDb () {
    return getDbByUrl(this.changedDbUrl)
  }

  get id () {
    return `db-indexing-issue::${this.indexerSchemaId}::${this.indexingDbIdent}::${this.changedDbIdent}`
  }

  get description () {
    return `Failed to process a database record in ${this.changedDbIdent} into the index of ${this.indexingDbIdent}.`
  }

  get cause () {
    return `The ${this.indexerSchemaId} indexer was attempting to process:\n${JSON.stringify(this.change)}`
  }

  get error () {
    return this._error.toString()
  }

  get canRecover () {
    return true
  }

  async recover () {
    await catchupIndexes(this.getIndexingDb(), [this.getChangedDb()])
  }
}