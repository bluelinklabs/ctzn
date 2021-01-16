export function setup (wsServer) {
  wsServer.register('accounts.register', async (...params) => {
    return 'todo'
  })
  wsServer.register('accounts.unregister', async (...params) => {
    return 'todo'
  })
}
