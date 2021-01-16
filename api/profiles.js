
export function setup (wsServer) {
  wsServer.register('profiles.get', async (params) => {
    return 'todo'
  })
  wsServer.register('profiles.put', async (params) => {
    return 'todo'
  })
}
