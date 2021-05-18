let isEnabled = false
let events = []
let failsafeTimeout = undefined

const WS_SAFE_TO_LOG_PARAMS = ['view.get', 'table.list', 'table.get', 'blob.get']

// exported api
// =

export async function reset () {
  events = []
}

export const debugLog = {
  enable,
  disable,
  isEnabled: () => isEnabled,
  updateIndexes: noop2,
  wsCall: noop3,
  httpCall: noop4,
  dbCall: noop4,
  rateLimitError: noop2,
  cacheHit: noop2
}

function enable () {
  if (isEnabled) return
  debugLog.updateIndexes = updateIndexes
  debugLog.wsCall = wsCall
  debugLog.httpCall = httpCall
  debugLog.dbCall = dbCall
  debugLog.rateLimitError = rateLimitError
  debugLog.cacheHit = cacheHit
  isEnabled = true
}

function disable () {
  events = []
  if (!isEnabled) return
  debugLog.updateIndexes = noop2
  debugLog.wsCall = noop3
  debugLog.httpCall = noop4
  debugLog.dbCall = noop4
  debugLog.rateLimitError = noop2
  debugLog.cacheHit = noop2
  isEnabled = false
}

function noop () {}
function noop1 (_1) {}
function noop2 (_1, _2) {}
function noop3 (_1, _2, _3) {}
function noop4 (_1, _2, _3, _4) {}

function updateIndexes (indexingDb, targetDb) {
  return events.push({event: 'update-index', indexingDb, targetDb, ts: Date.now()})
}
function wsCall (method, authedUserId, params) {
  if (WS_SAFE_TO_LOG_PARAMS.includes(method)) {
    return events.push({event: `ws:${method}`, authedUserId, params, ts: Date.now()})
  } else {
    return events.push({event: `ws:${method}`, authedUserId, ts: Date.now()})
  }
}
function httpCall (method, ip, params, query) {
  return events.push({event: `http:${method}`, ip, params, query, ts: Date.now()})
}
function dbCall (method, db, ns, args) {
  return events.push({event: `db:${method}`, method, db, ns, args, ts: Date.now()})
}
function rateLimitError (caller, method) {
  return events.push({event: 'rate-limit-error', caller, method, ts: Date.now()})
}
function cacheHit (cache, caller) {
  return events.push({event: 'cache-hit', caller, cache, ts: Date.now()})
}

export function fetchAndClear () {
  clearTimeout(failsafeTimeout)
  const res = events
  events = []
  failsafeTimeout = setTimeout(disable, 30e3)
  failsafeTimeout.unref()
  return res
}
