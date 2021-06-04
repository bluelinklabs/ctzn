import { BaseIssue } from './base.js'

export class HyperbeeStallIssue extends BaseIssue {
  constructor ({db, method}) {
    super()
    this.dbIdent = db._ident || db.url
    this.method = method
  }

  get id () {
    return `hyperbee-stall-issue::${this.dbIdent}::${this.method}`
  }

  get description () {
    return `Hyperbee method failed to respond (KNOWN BUG).`
  }

  get cause () {
    return `A call to ${this.method} for ${this.dbIdent} failed to respond in a timely fashion.`
  }

  get error () {
    return ''
  }

  get canRecover () {
    return false
  }
}