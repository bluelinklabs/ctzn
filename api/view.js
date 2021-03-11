import * as views from '../db/views.js'
import pump from 'pump'
import concat from 'concat-stream'

export function setup (wsServer) {
  wsServer.register('view.get', async ([schemaId, ...args], client) => {
    if (dbViews.getType(schemaId) === 'blob-view') {
      const {createStream} = await dbViews.exec(schemaId, undefined, ...args)
      const stream = await createStream()
      return new Promise((resolve, reject) => {
        pump(
          stream,
          concat({encoding: 'buffer'}, buf => {
            resolve(buf.toString('base64'))
          }),
          reject
        )
      })
    } else {
      return views.exec(schemaId, client?.auth, ...args)
    }
  })
}
