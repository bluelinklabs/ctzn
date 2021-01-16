export const HYPER_KEY = /([0-9a-f]{64})/i

export function hyperUrlToKey (str) {
  let matches = HYPER_KEY.exec(str)
  return Buffer.from(matches[1], 'hex')
}