
export function setup (wsServer) {
  wsServer.register('users.get', async (params) => {
    return 'todo'
  })
}
