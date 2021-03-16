import { BaseIssue } from './base.js'

export class HyperbeeStallIssue extends BaseIssue {
  constructor ({db, key}) {
    super()
    this.dbIdent = db._ident || db.url
    this.getKey = key
  }

  get id () {
    return `hyperbee-stall-issue::${this.dbIdent}::${this.getKey}`
  }

  get description () {
    return `Hyperbee method failed to respond (KNOWN BUG).`
  }

  get cause () {
    return `A call to get(${this.getKey}) for ${this.dbIdent} failed to respond in a timely fashion.`
  }

  get error () {
    return ''
  }

  get canRecover () {
    return false
  }
}