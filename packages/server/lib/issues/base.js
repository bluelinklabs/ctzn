export class BaseIssue {
  get id () {
    // override me
  }

  get description () {
    // override me
  }

  get cause () {
    // override me
  }

  get error () {
    // override me
  }

  get canRecover () {
    // override me
    return false
  }

  async recover () {
    // override me
  }

  async dismiss () {
    // override me
  }
}