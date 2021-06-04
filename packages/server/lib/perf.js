import { PerformanceObserver, performance } from 'perf_hooks'

let isMeasuringPerf = false
let measurements = {}

export function enable () {
  isMeasuringPerf = true
  console.log('Benchmark mode enabled')

  process.on('SIGINT', () => {
    process.exit(0)
  })
  process.on('exit', logMeasurements)
}

export function logMeasurements () {
  console.log('Benchmark results:')
  for (let id in measurements) {
    const m = measurements[id]
    m.tps = m.calls/(m.duration/1e3)
    m.durations.sort((a, b) => a - b)
    m.avgDuration = m.durations.reduce((acc, v) => acc + v, 0) / m.calls
    m.medianDuration = m.durations[(m.durations.length / 2) | 0]
    m.upperDuration = m.durations[m.durations.length - 1]
  }
  console.table(
    [['Name', 'Calls', 'TPS', 'Total Duration', 'Avg Duration', 'Median Duration', 'Longest Duration']].concat(
      Object.entries(measurements).map(([key, data]) => {
        return [key, data.calls, data.tps.toFixed(2), data.duration.toFixed(2), data.avgDuration.toFixed(2), data.medianDuration.toFixed(2), data.upperDuration.toFixed(2)]
      }).sort((a, b) => a[0].localeCompare(b[0]))
    )
  )
}

export function measure (id) {
  if (!isMeasuringPerf) return noop
  measurements[id] = measurements[id] || {calls: 0, duration: 0, durations: []}
  measurements[id].calls++
  const start = performance.now()
  return () => {
    const duration = performance.now() - start
    measurements[id].duration += duration
    measurements[id].durations.push(duration)
  }
}

function noop () {}