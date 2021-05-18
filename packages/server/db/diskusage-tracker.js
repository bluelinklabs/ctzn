import { Config } from '../lib/config.js'
import path from 'path'
import shell from 'shelljs'
import bytes from 'bytes'

const CHECK_INTERVAL = 1e3*60*30 // 30m

// globals
// =

const cachedDiskUsage = {}

// exported api
// =

export function setup () {
  readDiskUsage()
  let i = setInterval(readDiskUsage, CHECK_INTERVAL)
  i.unref()
}

export function get (key) {
  return cachedDiskUsage[key]
}

// internal methods
// =

async function readDiskUsage () {
  console.log('Reading hyperspace disk usage...')

  const dir = Config.getActiveConfig().hyperspaceStorage
  console.log('Exec:', `du ${dir}`)
  shell.exec(`du ${dir}`, {async: true, silent: true}, (code, stdout, stderr) => {
    if (code != 0) {
      console.error('Failed to run `du`:')
      console.error(stderr)
      return
    }
    
    let totalBytes = 0
    for (let line of stdout.split('\n')) {
      const parts = line.split('\t')
      if (parts.length !== 2) continue
      let [bytes, fullpath] = parts
      const relpath = path.relative(dir, fullpath)
      const [_1, _2, key] = relpath.split('/')
      if (!key) continue

      bytes = Number(bytes) * 512
      cachedDiskUsage[key] = bytes
      totalBytes += bytes
    }

    console.log('Finished reading hyperspace disk usage')
    console.log('Total:', bytes(totalBytes))
  })
}