import webfetch from 'node-fetch'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'

const ajv = new Ajv.default()
addFormats(ajv)
const schemaCache = new Map()

const DEBUG_SCHEMA_REPLACE = true
const DEBUG_SCHEMA_REPLACE_RE = /^https:\/\/ctzn.network\//i
const DEBUG_SCHEMA_ENDPOINT = 'http://localhost:3000/_schemas/'

export async function fetch (url) {
  if (schemaCache.has(url)) {
    return schemaCache.get(url)
  }

  let schema = new Schema(url)
  await schema.load()

  schemaCache.set(url, schema)
  return schema
}

class Schema {
  constructor (url) {
    this.url = url
    this.definition = undefined
    this.validate = undefined
  }

  async load () {
    let url = this.url
    if (DEBUG_SCHEMA_REPLACE) {
      url = this.url.replace(DEBUG_SCHEMA_REPLACE_RE, DEBUG_SCHEMA_ENDPOINT)
    }

    try {
      this.definition = await (await webfetch(url)).json()
    } catch (e) {
      console.error('Failed to load schema definition', this.url)
      console.error(e)
      process.exit(1)
    }

    try {
      this.validate = ajv.compile(this.definition)
    } catch (e) {
      console.error('Failed to compile schema definition', this.url)
      console.error(e)
      process.exit(1)
    }
  }
}