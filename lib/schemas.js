import createMlts from 'monotonic-lexicographic-timestamp'
import path from 'path'
import { promises as fsp } from 'fs'
import { fileURLToPath } from 'url'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import { JsonPointer } from 'json-ptr'

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
    this.keyTemplate = undefined

    if (this.schemaObject.type === 'json-table' || this.schemaObject.type === 'json' /* legacy */) {
      try {
        this.validate = ajv.compile(this.schemaObject.definition)
      } catch (e) {
        console.error('Failed to compile schema definition', this.id)
        console.error(e)
        process.exit(1)
      }
      try {
        if (this.schemaObject.keyTemplate) {
          this.keyTemplate = this.schemaObject.keyTemplate.map(segment => {
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
      } catch (e) {
        console.error('Failed to compile schema keyTemplate', this.id)
        console.error(e)
        process.exit(1)
      }
    } else if (this.schemaObject.type === 'json-view' || this.schemaObject.type === 'blob-view') {
      // no setup needed
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

class ValidationError extends Error {
  constructor (info) {
    super()
    for (let k in info) {
      this[k] = info[k]
    }
    this.message = `Validation Error: ${this.dataPath} ${this.message}`
  }
}
