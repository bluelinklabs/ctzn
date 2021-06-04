import { createApi } from './index.js'
import { Readable } from 'stream'
import nodeFetch from 'node-fetch'
import nodeBlob from 'fetch-blob'
import { FormData } from 'formdata-node'
import arrayBufferToBuffer from 'arraybuffer-to-buffer'

export function create (origin) {
  origin = origin || window.location.origin
  FormData.toStream = form => Readable.from(form)
  return createApi({
    origin,
    fetch: nodeFetch,
    arrayBufferToBuffer,
    Blob: nodeBlob,
    FormData
  })
}
