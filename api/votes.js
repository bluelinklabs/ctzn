
export function setup (wsServer) {
  wsServer.register('votes.listUserFeed', async params => {
    return 'todo'
  })
  wsServer.register('votes.getVotesForSubject', async params => {
    return 'todo'
  })
  wsServer.register('votes.put', async params => {
    return 'todo'
  })
  wsServer.register('votes.del', async params => {
    return 'todo'
  })
}
