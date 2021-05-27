import bytes from '../../vendor/bytes/index.js'
const MAX_WIDTH = 600
const MAX_HEIGHT = 600
const { createFFmpeg, fetchFile } = FFmpeg
let ffmpeg

export async function compressAndGetThumb (file, maxVideoSize, progressCb) {
  const objectUrl = URL.createObjectURL(file)
  const videoEl = document.createElement('video')
  videoEl.addEventListener('error', console.log)
  videoEl.setAttribute('playsinline', 'playsinline')
  videoEl.setAttribute('controls', 'controls')
  videoEl.setAttribute('muted', 'muted')
  videoEl.setAttribute('src', objectUrl)
  await new Promise(r => videoEl.addEventListener('loadedmetadata', r, {once: true}))

  let {videoWidth, videoHeight} = videoEl
  let outputWidth = videoWidth
  let outputHeight = videoHeight
  if (outputWidth > outputHeight) {
    if (outputWidth > MAX_WIDTH) {
      const scale = MAX_WIDTH / outputWidth
      outputWidth = Math.round(outputWidth * scale)
      outputHeight = Math.round(outputHeight * scale)
    }
  } else {
    if (outputHeight > MAX_HEIGHT) {
      const scale = MAX_HEIGHT / outputHeight
      outputWidth = Math.round(outputWidth * scale)
      outputHeight = Math.round(outputHeight * scale)
    }
  }
  if (outputWidth % 2 === 1) outputWidth--
  if (outputHeight % 2 === 1) outputHeight--
  console.log({outputWidth, outputHeight})

  const canvas = document.createElement('canvas')
  canvas.width = outputWidth
  canvas.height = outputHeight
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'

  if (!MediaRecorder.isTypeSupported('video/mp4')) {
    let [{blob, wasTruncated}, thumbDataUrl] = await Promise.all([
      compressUsingFFMpeg(file, {maxVideoSize, duration: videoEl.duration, outputWidth, outputHeight}, progressCb),
      (async () => {
        videoEl.currentTime = 0.1
        await new Promise(r => videoEl.addEventListener('seeked', r, {once: true}))
        ctx.fillRect(0, 0, outputWidth, outputHeight)
        ctx.drawImage(videoEl, 0, 0, videoWidth, videoHeight, 0, 0, outputWidth, outputHeight)
        return canvas.toDataURL('image/jpeg', 80)
      })()
    ])
    return {
      wasTruncated,
      thumbDataUrl,
      videoBlob: blob,
      videoBlobUrl: URL.createObjectURL(blob)
    }
  }

  let thumbDataUrl
  let wasTruncated = false
  let videoBlob = await new Promise(async (resolve, reject) => {
    const chunks = []
    let options = {mimeType: 'video/mp4', videoBitsPerSecond: 200000}
    const recorder = new MediaRecorder(canvas.captureStream(25), options)
    
    recorder.onerror = console.log
    recorder.ondataavailable = e => {
      let size = chunks.reduce((acc, chunk) => acc + chunk.size, 0)
      if (size + e.data.size > maxVideoSize) {
        wasTruncated = true
        recorder.stop()
      } else {
        chunks.push(e.data)
      }
    }
    recorder.onstop = e => {
      resolve(new Blob(chunks, {type: recorder.mimeType}))
    }
    
    videoEl.play()
    recorder.start()

    let startTime = Date.now()
    let lastCapture = Date.now()
    while (recorder.state === 'recording' && videoEl.currentTime < videoEl.duration) {
      await new Promise(r => setTimeout(r, 1)) // NOTE: don't use requestAnimationFrame because it pauses with the tab isnt focused
      progressCb?.(videoEl.currentTime / videoEl.duration)
      ctx.fillRect(0, 0, outputWidth, outputHeight)
      ctx.drawImage(videoEl, 0, 0, videoWidth, videoHeight, 0, 0, outputWidth, outputHeight)

      if ((Date.now() - startTime > 500) && !thumbDataUrl) {
        thumbDataUrl = canvas.toDataURL('image/jpeg', 80)
      }
      if ((Date.now() - lastCapture) > 500) {
        recorder.requestData()
        lastCapture = Date.now()
      }
    }
    if (recorder.state === 'recording') {
      recorder.stop()
    }
  })

  return {
    wasTruncated,
    thumbDataUrl,
    videoBlob,
    videoBlobUrl: URL.createObjectURL(videoBlob)
  }
}

async function compressUsingFFMpeg (file, {maxVideoSize, duration, outputWidth, outputHeight}, progressCb) {
  if (!ffmpeg) {
    ffmpeg = createFFmpeg({log: true})
    await ffmpeg.load()
  }

  let lastProg
  let wasTruncated = false
  ffmpeg.setProgress(({ratio}) => {
    if (ratio === 1 && lastProg < 0.9) {
      wasTruncated = true // assume it was truncated
    }
    progressCb(ratio)
    lastProg = ratio
  })
  ffmpeg.FS('writeFile', file.name, await fetchFile(file))
  const maxKilobits = maxVideoSize * 0.008
  const bitrate = Math.round(maxKilobits / duration * 0.5) // estimate a target bitrate that will fit our desired size 
  const params = [
    '-i', file.name,
    '-an', // strip audio
    '-profile:v', 'baseline', '-level', '3.0', // encoding profile (should maximize device compat)
    '-crf', '30', // compression (0 is lossless, 23 is default, 51 is worst possible)
    '-movflags', '+faststart', // include early data to play as quickly as possible
    '-c:v', 'libx264', // h.264
    '-b:v', `${bitrate}k`, // bitrate
    // '-pix_fmt', 'yuv420p', // quicktime compat (needed?)
    '-s', `${outputWidth}x${outputHeight}`, // scale
    '-fs', String(maxVideoSize - bytes('250kb') /* subtract 250kb to include space for added info */), // file size limit
    'output.mp4'
  ]
  console.log(params)
  await ffmpeg.run(...params)
  const data = ffmpeg.FS('readFile', 'output.mp4')
  return {wasTruncated, blob: new Blob([data.buffer], {type: 'video/mp4'})}
}