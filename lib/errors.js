export class ExtendableError extends Error {
  constructor(msg) {
    super(msg)
    this.name = this.constructor.name
    this.message = msg
    this.rpcCode = -32000
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor)
    } else {
      this.stack = (new Error(msg)).stack
    }
  }
}

export class SessionError extends ExtendableError {
  constructor(msg) {
    super(msg || 'Must be logged in')
    this.rpcCode = -32001
  }
}

export class ValidationError extends ExtendableError {
  constructor(msg) {
    super(msg || '')
    this.rpcCode = -32002
  }
}

export class NotFoundError extends ExtendableError {
  constructor(msg) {
    super(msg || 'Not found')
    this.rpcCode = -32003
  }
}

export class PermissionsError extends ExtendableError {
  constructor(msg) {
    super(msg || 'Not authorized to complete this action')
    this.rpcCode = -32004
  }
}

export class InvalidCredentialsError extends ExtendableError {
  constructor(msg) {
    super(msg || 'Invalid username or password')
    this.rpcCode = -32005
  }
}