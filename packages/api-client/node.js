import { createApi } from './index.js'
import nodeFetch from 'node-fetch'
import arrayBufferToBuffer from 'arraybuffer-to-buffer'

export function create (origin) {
  origin = origin || window.location.origin
  return createApi({origin, fetch: nodeFetch, arrayBufferToBuffer})
}

function passthrough (v) {
  return v
}