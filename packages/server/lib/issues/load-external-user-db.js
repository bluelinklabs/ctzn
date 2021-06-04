import { BaseIssue } from './base.js'
import { loadExternalDb } from '../../db/index.js'

export class LoadExternalUserDbIssue extends BaseIssue {
  constructor ({dbKey, cause, error}) {
    super()
    this.dbKey = dbKey
    this._cause = cause
    this._error = error
  }

  get id () {
    return `load-external-user-db-issue::${this.dbKey}`
  }

  get description () {
    return `Failed to load the external user database for ${this.dbKey}.`
  }

  get cause () {
    return this._cause
  }

  get error () {
    return this._error.toString()
  }

  get canRecover () {
    return true
  }

  async recover () {
    await loadExternalDb(this.dbKey)
  }
}