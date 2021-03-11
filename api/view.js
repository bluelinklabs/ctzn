import * as views from '../db/views.js'

export function setup (wsServer) {
  wsServer.register('view.get', async ([schemaId, ...args], client) => {
    return views.exec(schemaId, client?.auth, ...args)
  })
}
