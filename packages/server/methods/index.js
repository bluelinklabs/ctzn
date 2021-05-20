import * as schemas from '../lib/schemas.js'
import * as account from './account.js'
import * as community from './community.js'
import * as notifications from './notifications.js'

// globals
// =

const _methods = new Map()

// exported api
// =

export function setup () {
  account.setup(define)
  community.setup(define)
  notifications.setup(define)
}

export async function exec (schemaId, auth, params, req, res) {
  const method = _methods.get(schemaId)
  if (!method) {
    throw new Error(`Method "${schemaId}" not found`)
  }
  method.validateParameters.assert(params)
  const response = await method.fn(auth, params, req, res)
  if (response) method.validateResponse.assert(response)
  return response
}

// internal methods
// =

function define (schemaId, fn) {
  const schema = schemas.get(schemaId)
  if (!schema) throw new Error(`View schema "${schemaId}" not found`)
  const s = schema.schemaObject
  let validateParameters
  let validateResponse
  try {
    validateParameters = s.parameters ? schemas.createValidator(s.parameters) : {assert: noop}
    validateResponse = s.definition ? schemas.createValidator(s.definition) : {assert: noop}
  } catch (e) {
    console.error('Error while compiling view schema:', schemaId)
    console.error(e)
    process.exit(1)
  }
  _methods.set(schemaId, {
    validateParameters,
    validateResponse,
    schema,
    fn
  })
}

function noop () {}