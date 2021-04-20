import {
  Client as HyperspaceClient,
  Server as HyperspaceServer
} from 'hyperspace'
import { QueryableLog } from 'queryable-log'
import path from 'path'
import dht from '@hyperswarm/dht'
import ram from 'random-access-memory'

export let server = undefined
export let client = undefined
export let log = undefined
let _cleanup = undefined

export async function setup ({configDir, hyperspaceHost, hyperspaceStorage, simulateHyperspace}) {
  log = new QueryableLog(path.join(configDir, 'hyperspace.log'), {overwrite: true, sizeLimit: 5e6})
  addLoggerFunctions(log)

  if (simulateHyperspace) {
    const bootstrapper = dht({
      bootstrap: false
    })
    bootstrapper.listen()
    await new Promise(resolve => {
      return bootstrapper.once('listening', resolve)
    })
    const bootstrapPort = bootstrapper.address().port
    const bootstrapOpt = [`localhost:${bootstrapPort}}`]

    const simulatorId = `hyperspace-simulator-${process.pid}`

    server = new HyperspaceServer({
      host: simulatorId,
      storage: ram,
      network: {
        bootstrap: bootstrapOpt,
        preferredPort: 0
      },
      noMigrate: true
    })
    await server.open()
    client = new HyperspaceClient({host: simulatorId})

    _cleanup = async () => {
      if (client) await client.close()
      if (server) await server.close()
      if (bootstrapper) await bootstrapper.destroy()
    }
    return
  }

  try {
    client = new HyperspaceClient({host: hyperspaceHost})
    await client.ready()
  } catch (e) {
    // no daemon, start it in-process
    server = new HyperspaceServer({host: hyperspaceHost, storage: hyperspaceStorage})
    await server.ready()
    client = new HyperspaceClient({host: hyperspaceHost})
    await client.ready()
  }

  console.log('Hyperspace daemon connected, status:')
  console.log(await client.status())
}

export async function cleanup () {
  if (_cleanup) {
    _cleanup()
    return
  }
  await client.close()
  if (server) {
    console.log('Shutting down Hyperspace, this may take a few seconds...')
    await server.stop()
  }
}

function addLoggerFunctions (log) {
  log.create = (structure, dkey) => log.append({event: 'create', structure, dkey})
  log.createBee = (dkey) => log.create('hyperbee', dkey)
  log.createCore = (dkey) => log.create('hypercore', dkey)
  log.load = (structure, dkey) => log.append({event: 'load', structure, dkey})
  log.loadBee = (dkey) => log.load('hyperbee', dkey)
  log.loadCore = (dkey) => log.load('hypercore', dkey)
  log.track = (structure, core) => {
    const dkey = core.discoveryKey.toString('hex')
    core.on('append', ({length, byteLength}) => log.append({event: 'append', structure, dkey, length, byteLength}))
    core.on('close', () => log.append({event: 'close', structure, dkey}))
    core.on('peer-open', (peer) => log.append({event: 'peer-open', structure, dkey, peer: {type: peer.type, remoteAddress: peer.remoteAddress}}))
    core.on('peer-remove', (peer) => log.append({event: 'peer-remove', structure, dkey, peer: {type: peer.type, remoteAddress: peer.remoteAddress}}))
    core.on('wait', (waitId, seq) => log.append({event: 'wait', structure, dkey, seq}))
    core.on('download', (seq, {byteLength}) => log.append({event: 'download', structure, dkey, seq, byteLength}))
    core.on('upload', (seq, {byteLength}) => log.append({event: 'upload', structure, dkey, seq, byteLength}))
  }
  log.trackBee = (core) => log.track('hyperbee', core)
  log.trackCore = (core) => log.track('hypercore', core)
}