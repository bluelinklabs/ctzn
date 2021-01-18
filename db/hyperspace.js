import {
  Client as HyperspaceClient,
  Server as HyperspaceServer
} from 'hyperspace'
import simulator from 'hyperspace/simulator.js'

export let server = undefined
export let client = undefined
let _cleanup = undefined

export async function setup ({simulateHyperspace}) {
  if (simulateHyperspace) {
    const sim = await simulator()
    server = sim.server
    client = sim.client
    _cleanup = sim.cleanup
    return
  }

  try {
    client = new HyperspaceClient()
    await client.ready()
  } catch (e) {
    // no daemon, start it in-process
    server = new HyperspaceServer()
    await server.ready()
    client = new HyperspaceClient()
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