import { BaseIssue } from './base.js'

export class UnknownUserTypeIssue extends BaseIssue {
  constructor (userRecord) {
    super()
    this.userRecord = userRecord
  }

  get id () {
    return `unknown-user-type::${this.userRecord.key}`
  }

  get description () {
    return `A user record with an unsupported type was found in the server database.`
  }

  get cause () {
    return `This may be caused by a bad record, a failed software update, or some other program than the CTZN server sharing the database.\n\nThe record:\n${JSON.stringify(this.userRecord, null, 2)}`
  }

  get error () {
    return `Unsupported user type: ${this.userRecord.value.type}`
  }
}