import { BaseIssue } from './base.js'

export class NoTermsOfServiceIssue extends BaseIssue {
  get id () {
    return `no-terms-of-service-issue`
  }

  get description () {
    return `No terms of service has been set for this server.`
  }

  get cause () {
    return 'A user attempted to access your terms of service but no document was found.'
  }

  get error () {
    return 'Please create a "terms-of-service.txt" file in your config directory.'
  }

  get canRecover () {
    return true
  }

  async recover () {
  }
}