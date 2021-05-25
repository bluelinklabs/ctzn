import { createApi } from './index.js'

export function create (origin) {
  origin = origin || window.location.origin
  return createApi({
    origin,
    fetch: window.fetch,
    arrayBufferToBuffer: passthrough,
    Blob: window.Blob,
    FormData: window.FormData
  })
}

function passthrough (v) {
  return v
}