import * as session from './session.js'
import { base64ByteSize } from './strings.js'

// https://dev.to/taylorbeeston/resizing-images-client-side-with-vanilla-js-4ng2

async function renderCanvas (dataUrl) {
  const canvas = document.createElement('canvas')
  const img = document.createElement('img')

  // create img element from File object
  img.src = dataUrl
  await new Promise((resolve) => {
    img.onload = resolve
  })

  // draw image in canvas element
  canvas.width = img.width
  canvas.height = img.height
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)

  return canvas
}

function scaleCanvas (canvas, scale) {
  const scaledCanvas = document.createElement('canvas')
  scaledCanvas.width = canvas.width * scale
  scaledCanvas.height = canvas.height * scale

  scaledCanvas
    .getContext('2d')
    .drawImage(canvas, 0, 0, scaledCanvas.width, scaledCanvas.height)

  return scaledCanvas
}

export async function resizeImage (dataUrl, maxWidth, quality = 0.9) {
  let canvas = await renderCanvas(dataUrl)

  while (canvas.width >= 2 * maxWidth) {
    canvas = scaleCanvas(canvas, .5)
  }

  if (canvas.width > maxWidth) {
    canvas = scaleCanvas(canvas, maxWidth / canvas.width)
  }

  return canvas.toDataURL('image/jpeg', quality)
}

export function parseDataUrl (url) {
  const [prelude, base64buf] = url.split(',')
  const mimeType = /data:([^\/]+\/[^;]+)/.exec(prelude)[1]
  return {mimeType, base64buf}
}

export async function shrinkImage (dataUrl, factor = 0.9, mimeType = 'image/jpeg') {
  let canvas = await renderCanvas(dataUrl)
  canvas = scaleCanvas(canvas, factor)
  return canvas.toDataURL(mimeType)
}

export async function ensureImageByteSize (dataUrl, maxSize, mimeType = 'image/jpeg') {
  let resDataUrl = dataUrl
  let factor = 0.9
  while (base64ByteSize(parseDataUrl(resDataUrl).base64buf) > maxSize && factor > 0) {
    resDataUrl = await shrinkImage(dataUrl, factor, mimeType)
    if (factor === 0.1) {
      factor = 0.05
    } else {
      factor -= 0.1
    }
  }
  return resDataUrl
}

export async function uploadBlob (table, key, blobName, dataUrl) {
  let {base64buf, mimeType} = parseDataUrl(dataUrl)
  let res, lastError
  for (let i = 1; i < 6; i++) {
    try {
      res = await session.api.user.table(table).putBlob(key, blobName, base64buf, mimeType)
      break
    } catch (e) {
      lastError = e
      let shrunkDataUrl = await shrinkImage(dataUrl, (10 - i) / 10, mimeType)
      let parsed = parseDataUrl(shrunkDataUrl)
      base64buf = parsed.base64buf
      mimeType = parsed.mimeType
    }
  }
  if (!res) {
    console.error(lastError)
    throw new Error(`Failed to upload ${blobName}: ${lastError.toString()}`)
  }
  return res
}