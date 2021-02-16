export function setup (wsServer) {
  wsServer.registerLoopback('server.listHypercores', async ([]) => {
    return ['todo!!!']
  })
}
