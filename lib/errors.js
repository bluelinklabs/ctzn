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
    this.code = 'session-does-not-exist'
    this.rpcCode = -32001
  }
}

export class ValidationError extends ExtendableError {
  constructor(msg) {
    super(validationGenMsg(msg))
    this.code = 'validation-failed'
    this.rpcCode = -32002
  }
}
const validationGenMsg = msg => {
  if (msg && typeof msg === 'object') {
    return `${msg.dataPath} ${msg.message}`
  }
  return msg || ''
}

export class NotFoundError extends ExtendableError {
  constructor(msg) {
    super(msg || 'Not found')
    this.code = 'not-found'
    this.rpcCode = -32003
  }
}

export class PermissionsError extends ExtendableError {
  constructor(msg) {
    super(msg || 'Not authorized to complete this action')
    this.code = 'not-authorized'
    this.rpcCode = -32004
  }
}

export class InvalidCredentialsError extends ExtendableError {
  constructor(msg) {
    super(msg || 'Invalid username or password')
    this.code = 'invalid-credentials'
    this.rpcCode = -32005
  }
}

export class ConfigurationError extends ExtendableError {
  constructor(msg) {
    super(msg || 'Server or network configuration error')
    this.code = 'configuration-error'
    this.rpcCode = -32006
  }
}

export class RateLimitError extends ExtendableError {
  constructor(msg) {
    super(msg || 'Rate limit exceeded')
    this.code = 'rate-limit-exceeded'
    this.rpcCode = -32007
  }
}