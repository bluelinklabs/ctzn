export async function timeoutRace (time, fallback, promise) {
  let to
  const toPromise = new Promise((resolve, reject) => {
    to = setTimeout(() => {
      resolve(fallback)
    }, time)
    to.unref()
  })
  const cleanup = () => clearTimeout(to)
  const p = Promise.race([promise, toPromise])
  p.then(cleanup, cleanup)
  return p
}