import createMlts from 'monotonic-lexicographic-timestamp'
import path from 'path'
import { promises as fsp } from 'fs'
import { fileURLToPath } from 'url'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import { JsonPointer } from 'json-ptr'
import { ValidationError } from './errors.js'

const VALID_PTR_RESULT_TYPES = ['number', 'string', 'boolean']

const mlts = createMlts()
const ajv = new Ajv.default({strictTuples: false})
addFormats(ajv)

const schemas = new Map()
export const get = schemas.get.bind(schemas)

export async function setup () {
  const schemasPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'schemas')
  const schemaFilenames = await fsp.readdir(schemasPath)
  for (let filename of schemaFilenames) {
    try {
      const str = await fsp.readFile(path.join(schemasPath, filename), 'utf8')
      const obj = JSON.parse(str)
      if (!obj.id) throw new Error('No .id')
      schemas.set(obj.id, new Schema(obj))
    } catch (e) {
      console.error('Failed to load schema', filename)
      console.error(e)
      process.exit(1)
    }
  }
}

export function createValidator (schema) {
  const validate = ajv.compile(schema)
  validate.assert = (value) => {
    const valid = validate(value)
    if (!valid) {
      throw new ValidationError(validate.errors[0])
    }
  }
  return validate
}

class Schema {
  constructor (obj) {
    this.id = obj.id
    this.schemaObject = obj
    this.validate = undefined
    this.validateParams = undefined
    this.keyTemplate = undefined

    const failure = (msg, e) => {
      console.error(msg, this.id)
      console.error(e)
      process.exit(1)
    }

    try {
      if (this.schemaObject.definition) {
        this.validate = ajv.compile(this.schemaObject.definition)
      }
    } catch (e) { failure('Failed to compile schema definition', e) }
    try {
      if (this.schemaObject.keyTemplate) {
        this.keyTemplate = generateKeyTemplate(this.schemaObject.keyTemplate)
      }
    } catch (e) { failure('Failed to compile schema keyTemplate', e) }
    try {
      if (this.schemaObject.parameters) {
        this.validateParams = ajv.compile(this.schemaObject.parameters)
      }
    } catch (e) { failure('Failed to compile schema parameters', e) }

    if (this.schemaObject.type === 'json-table' || this.schemaObject.type === 'json' /* legacy */) {
      // no further setup needed
    } else if (this.schemaObject.type === 'json-view' || this.schemaObject.type === 'blob-view') {
      // no further setup needed
    } else if (this.schemaObject.type === 'dbmethod') {
      // no further setup needed
    } else {
      console.error('Unknown table type:', this.schemaObject.type)
    }
  }

  generateKey (value) {
    if (!this.keyTemplate) {
      throw new Error(`Unable to generate key for ${this.id} record, no keyTemplate specified`)
    }
    return this.keyTemplate.map(fn => fn(value)).join('')
  }

  assertValid (value) {
    const valid = this.validate(value)
    if (!valid) {
      throw new ValidationError(this.validate.errors[0])
    }
  }
}

function generateKeyTemplate (keyTemplate) {
  return keyTemplate.map(segment => {
    if (segment.type === 'json-pointer') {
      if (typeof segment.value !== 'string') {
        throw new Error('"json-pointer" must have a value')
      }
      const ptr = JsonPointer.create(segment.value)
      return (record) => {
        let value = ptr.get(record)
        if (!VALID_PTR_RESULT_TYPES.includes(typeof value)) {
          throw new Error(`Unable to generate key, ${segment.value} found type ${typeof value}`)
        }
        return value
      }
    } else if (segment.type === 'auto') {
      return (record) => mlts()
    } else if (segment.type === 'string') {
      if (typeof segment.value !== 'string') {
        throw new Error('"string" must have a value')
      }
      return (record) => segment.value
    } else {
      throw new Error(`Unknown keyTemplate segment type: "${segment.type}"`)
    }
  })
}