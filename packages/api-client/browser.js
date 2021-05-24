import { createApi } from './index.js'

export function create (origin) {
  origin = origin || window.location.origin
  return createApi({origin, fetch: window.fetch, arrayBufferToBuffer: passthrough})
}

function passthrough (v) {
  return v
}