import { BaseIssue } from './base.js'

export class DbmethodBadResponse extends BaseIssue {
  constructor ({error, handlingDb, method}) {
    super()
    this._error = error
    this.handlingDbUrl = handlingDb.url
    this.handlingDbIdent = handlingDb._ident
    this.method = method
  }

  get id () {
    return `dbmethod-bad-response::${this.method}::${this.handlingDbIdent}`
  }

  get description () {
    return `Database method ${this.method} returned an invalid response object.`
  }

  get cause () {
    return `The ${this.handlingDbIdent} database generated a response that does not match the ${this.method} schema.`
  }

  get error () {
    return this._error.toString()
  }

  get canRecover () {
    return false
  }
}