import { BaseIssue } from './base.js'

export class NoPrivacyPolicyIssue extends BaseIssue {
  get id () {
    return `no-privacy-policy-issue`
  }

  get description () {
    return `No privacy policy has been set for this server.`
  }

  get cause () {
    return 'A user attempted to access your terms of service but no document was found.'
  }

  get error () {
    return 'Please create a "privacy-policy.txt" file in your config directory.'
  }

  get canRecover () {
    return true
  }

  async recover () {
  }
}