import path from 'path'
import { promises as fsp } from 'fs'
import { fileURLToPath } from 'url'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'

const ajv = new Ajv.default()
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

    if (this.schemaObject.type === 'json') {
      try {
        this.validate = ajv.compile(this.schemaObject.definition)
      } catch (e) {
        console.error('Failed to compile schema definition', this.url)
        console.error(e)
        process.exit(1)
      }
    } else {
      console.error('Unknown table type:', this.schemaObject.type)
    }
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
