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
  }
  console.table(
    [['Name', 'Calls', 'TPS', 'Duration']].concat(
      Object.entries(measurements).map(([key, data]) => {
        return [key, data.calls, data.tps.toFixed(2), data.duration.toFixed(2)]
      }).sort((a, b) => a[0].localeCompare(b[0]))
    )
  )
}

export function measure (id) {
  if (!isMeasuringPerf) return noop
  measurements[id] = measurements[id] || {calls: 0, duration: 0, lastStart: undefined}
  measurements[id].calls++
  const start = performance.now()
  return () => {
    measurements[id].duration += performance.now() - start
  }
}

function noop () {}