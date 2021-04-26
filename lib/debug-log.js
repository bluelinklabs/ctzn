import path from 'path'
import { QueryableLog } from 'queryable-log'

let isEnabled = false
let _configDir

// exported api
// =

export let debugEventsLog = undefined

export function setup ({configDir}) {
  _configDir = configDir
  debugEventsLog = new QueryableLog(path.join(configDir, 'debug-events.log'), {overwrite: false, sizeLimit: 5e6})
}

export async function reset () {
  let wasEnabled = isEnabled
  disable()
  if (debugEventsLog) {
    await debugEventsLog.close()
  }
  debugEventsLog = new QueryableLog(path.join(_configDir, 'debug-events.log'), {overwrite: true, sizeLimit: 5e6})
  debugEventsLog.append({event: 'reset-log'})
  if (wasEnabled) {
    enable()
  }
}

export const debugLog = {
  enable,
  disable,
  isEnabled: () => isEnabled,
  updateIndexes: noop2,
  wsCall: noop2,
  dbCall: noop4
}

function enable () {
  if (isEnabled) return
  debugLog.updateIndexes = updateIndexes
  debugLog.wsCall = wsCall
  debugLog.dbCall = dbCall
  isEnabled = true
}

function disable () {
  if (!isEnabled) return
  debugLog.updateIndexes = noop2
  debugLog.wsCall = noop2
  debugLog.dbCall = noop4
  isEnabled = false
}

function noop () {}
function noop1 (_1) {}
function noop2 (_1, _2) {}
function noop3 (_1, _2, _3) {}
function noop4 (_1, _2, _3, _4) {}

function updateIndexes (indexingDb, targetDb) {
  return debugEventsLog.append({event: 'update-index', indexingDb, targetDb})
}
function wsCall (method, authedUserId) {
  return debugEventsLog.append({event: `ws-call:${method}`, authedUserId})
}
function dbCall (method, db, ns, args) {
  return debugEventsLog.append({event: `db-call:${method}`, method, db, ns, args})
}

export async function listEvents ({event, timespan, uniqueBy}) {
  const log = debugEventsLog
  let startTs = timespanToTS(timespan)
  let hasSeen = uniqueBy ? new Set() : undefined
  return log.query(entry => {
    if (entry.ts < startTs) return false
    if (event && entry.event !== event) return false
    if (uniqueBy) {
      if (hasSeen.has(entry[uniqueBy])) return false
      hasSeen.add(entry[uniqueBy])
    }
    return true
  })
}

export async function countEvents (opts) {
  return (await listEvents(opts))?.length || 0
}

export async function countMultipleEvents ({events, timespan, uniqueBys}) {
  if (events && !Array.isArray(events)) {
    throw new Error('Events must be an array of strings')
  }
  let startTs = timespanToTS(timespan)
  const counts = {}
  if (events) events.forEach(evt => counts[evt] = 0)
  let hasSeens = undefined
  if (uniqueBys) {
    hasSeens = {}
    for (let k in uniqueBys) {
      hasSeens[k] = new Set()
    }
  }
  await debugEventsLog.query(entry => {
    if (entry.ts < startTs) return false
    if (events && !events.includes(entry.event)) return false
    if (uniqueBys?.[entry.event]) {
      if (hasSeens[entry.event].has(entry[uniqueBys[entry.event]])) return false
      hasSeens[entry.event].add(entry[uniqueBys[entry.event]])
    }
    counts[entry.event] = (counts[entry.event] || 0) + 1
    return false
  })
  return counts
}

export async function countMultipleEventsOverTime ({events, window, timespan, uniqueBys}) {
  if (!events || !Array.isArray(events)) {
    throw new Error('Events must be an array of strings')
  }
  let startTs = timespanToTS(timespan)
  let windowMs = windowToMs(window)
  const segments = {}
  let hasSeens

  function getOrCreateSegment (entry) {
    let ts = entry.ts - (entry.ts % windowMs)
    if (!segments[ts]) {
      if (uniqueBys) {
        hasSeens = {}
        for (let k in uniqueBys) {
          hasSeens[k] = new Set()
        }
      }
      segments[ts] = {
        counts: {}
      }
      events.forEach(evt => segments[ts].counts[evt] = 0)
    }
    return segments[ts]
  }
  await debugEventsLog.query(entry => {
    const segment = getOrCreateSegment(entry)
    if (entry.ts < startTs) return false
    if (!events.includes(entry.event)) return false
    if (uniqueBys?.[entry.event]) {
      if (hasSeens[entry.event].has(entry[uniqueBys[entry.event]])) return false
      hasSeens[entry.event].add(entry[uniqueBys[entry.event]])
    }
    segment.counts[entry.event]++
    return false
  })
  return segments
}


// internal methods
// =

function timespanToTS (timespan) {
  if (timespan === 'day') {
    return Date.now() - (60e3 * 60 * 24)
  } else if (timespan === 'week') {
    return Date.now() - (60e3 * 60 * 24) * 7
  } else if (timespan === 'month') {
    return Date.now() - (60e3 * 60 * 24) * 7 * 30
  } else if (timespan !== 'all') {
    throw new Error('Invalid timespan, must be "day", "week", "month", or "all"')
  }
  return 0
}

function windowToMs (window) {
  if (window === 'hour') {
    return (60e3 * 60)
  } else if (window === 'day') {
    return (60e3 * 60 * 24)
  } else if (window === 'week') {
    return (60e3 * 60 * 24) * 7
  } else if (window === 'month') {
    return (60e3 * 60 * 24) * 7 * 30
  }
  throw new Error('Invalid window, must be "hour", "day", "week", or "month"')
}