
export function debouncer (ms, fallback) {
  let stack = []
  let running = false

  async function pop () {
    if (!stack.length) {
      running = false
      return
    }
    running = true
    const startTime = Date.now()
    const { run, cancel } = stack.pop()
    for (let i = 0; i < stack.length; i++) {
      stack.pop().cancel()
    }
    try {
      await run()
    } finally {
      const diff = ms - (Date.now() - startTime)
      if (diff < 0) return pop()
      else setTimeout(pop, diff)
    }
  }

  return async function push (task) {
    return new Promise((resolve, reject) => {
      stack.push({
        run: () => task().then(resolve, reject),
        // Resolve with empty search results if cancelled.
        cancel: () => resolve(fallback)
      })
      if (!running) pop()
    })
  }
}

export function intersect (a, b) {
  var arr = []
  for (let av of a) {
    if (b.includes(av)) {
      arr.push(av)
    }
  }
  return arr
}

export function deepClone (v) {
  return JSON.parse(JSON.stringify(v))
}

/**
 * Helper to run an async operation against an array in chunks
 * @example
 * var res = await chunkAsync(values, v => fetchAsync(v), 3) // chunks of 3s
 * @param {any[]} arr 
 * @param {Number} chunkSize 
 * @param {(value: any, index: number, array: any[]) => Promise<any>} cb 
 * @returns {Promise<any[]>}
 */
 export async function chunkMapAsync (arr, chunkSize, cb) {
  const resultChunks = []
  for (let chunk of chunkArray(arr, chunkSize)) {
    resultChunks.push(await Promise.all(chunk.map(cb)))
  }
  return resultChunks.flat()

}

/**
 * Helper to split an array into chunks
 * @param {any[]} arr 
 * @param {Number} chunkSize 
 * @returns {Array<any[]>}
 */
export function chunkArray (arr, chunkSize) {
  const result = []
  for (let i = 0; i < arr.length; i += chunkSize) {
    result.push(arr.slice(i, i + chunkSize))
  }
  return result
}
