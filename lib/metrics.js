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

export async function listEvents ({event, timespan}) {
  const log = event === 'http-request' ? trafficLog : metricEventsLog
  let startTs = timespanToTS(timespan)
  return log.query(entry => {
    if (entry.ts < startTs) return false
    if (event && entry.event !== event) return false
    return true
  })
}

export async function countEvents (opts) {
  return (await listEvents(opts))?.length || 0
}

export async function countMultipleEvents ({events, timespan}) {
  if (!events || !Array.isArray(events)) {
    throw new Error('Events must be an array of strings')
  }
  let startTs = timespanToTS(timespan)
  const counts = {}
  events.forEach(evt => counts[evt] = 0)
  await metricEventsLog.query(entry => {
    if (entry.ts < startTs) return false
    if (!events.includes(entry.event)) return false
    counts[entry.event]++
    return false
  })
  return counts
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