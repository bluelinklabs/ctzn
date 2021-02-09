import {
  Client as HyperspaceClient,
  Server as HyperspaceServer
} from 'hyperspace'
import dht from '@hyperswarm/dht'
import ram from 'random-access-memory'

export let server = undefined
export let client = undefined
let _cleanup = undefined

export async function setup ({hyperspaceHost, hyperspaceStorage, simulateHyperspace}) {
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