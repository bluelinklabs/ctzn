import { createValidator } from '../lib/schemas.js'

const registerParam = createValidator({
  type: 'object',
  required: ['username', 'password'],
  properties: {
    username: {type: 'string'},
    password: {type: 'string'}
  }
})

export function setup (wsServer) {
  wsServer.register('accounts.login', async (params, client) => {
    registerParam.assert(params[0])
    let {username, password} = params[0]

    // TODO validate credentials
    client.auth = {
      username
    }

    return true
  })

  wsServer.register('accounts.logout', async (params, socket_id) => {
    client.auth = undefined
    return true
  })

  wsServer.register('accounts.register', async (params, socket_id) => {
    return 'todo'
  })

  wsServer.register('accounts.unregister', async (params, socket_id) => {
    return 'todo'
  })
}
