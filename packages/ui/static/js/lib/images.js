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