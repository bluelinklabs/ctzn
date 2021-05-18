import path from 'path'
import { QueryableLog } from 'queryable-log'

// exported api
// =

export let metricEventsLog = undefined
export let trafficLog = undefined

export function setup ({configDir}) {
  metricEventsLog = new QueryableLog(path.join(configDir, 'metric-events.log'), {overwrite: false, sizeLimit: 5e6})
  trafficLog = new QueryableLog(path.join(configDir, 'http-requests.log'), {overwrite: false, sizeLimit: 5e6})
}

export function httpRequest ({path}) {
  return trafficLog.append({event: 'http-request', path})
}
export function activeWebsocketCount ({count}) {
  return metricEventsLog.append({event: 'active-websocket-count', count})
}
export function signedUp ({user}) {
  return metricEventsLog.append({event: 'signed-up', user})
}
export function loggedIn ({user}) {
  return metricEventsLog.append({event: 'logged-in', user})
}
export function communityCreated ({user, community}) {
  return metricEventsLog.append({event: 'community-created', user, community})
}
export function postCreated ({user}) {
  return metricEventsLog.append({event: 'post-created', user})
}
export function commentCreated ({user}) {
  return metricEventsLog.append({event: 'comment-created', user})
}

export async function listEvents ({event, timespan, uniqueBy}) {
  const log = event === 'http-request' ? trafficLog : metricEventsLog
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
  if (!events || !Array.isArray(events)) {
    throw new Error('Events must be an array of strings')
  }
  let startTs = timespanToTS(timespan)
  const counts = {}
  events.forEach(evt => counts[evt] = 0)
  let hasSeens = undefined
  if (uniqueBys) {
    hasSeens = {}
    for (let k in uniqueBys) {
      hasSeens[k] = new Set()
    }
  }
  await metricEventsLog.query(entry => {
    if (entry.ts < startTs) return false
    if (!events.includes(entry.event)) return false
    if (uniqueBys?.[entry.event]) {
      if (hasSeens[entry.event].has(entry[uniqueBys[entry.event]])) return false
      hasSeens[entry.event].add(entry[uniqueBys[entry.event]])
    }
    counts[entry.event]++
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
  await metricEventsLog.query(entry => {
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

export async function aggregateHttpHits ({timespan}) {
  const entries = await listEvents({event: 'http-request', timespan})
  const byPath = {}
  for (let entry of entries) {
    byPath[entry.path] = (byPath[entry.path] || 0) + 1
  }
  return byPath
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