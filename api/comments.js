
export function setup (wsServer) {
  wsServer.register('comments.listThread', async (params) => {
    return 'todo'    
  })
  wsServer.register('comments.get', async (params) => {
    return 'todo'    
  })
  wsServer.register('comments.create', async (params) => {
    return 'todo'    
  })
  wsServer.register('comments.edit', async (params) => {
    return 'todo'    
  })
  wsServer.register('comments.del', async (params) => {
    return 'todo'    
  })
}
