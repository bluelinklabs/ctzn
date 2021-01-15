import {
  Client as HyperspaceClient,
  Server as HyperspaceServer
} from 'hyperspace'

export let server = undefined
export let client = undefined

export async function setup () {
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
  await client.close()
  if (server) {
    console.log('Shutting down Hyperspace, this may take a few seconds...')
    await server.stop()
  }
}