import { createValidator } from '../lib/schemas.js'
import { userDbs } from '../db/index.js'
import { constructUrl } from '../lib/strings.js'

const listParam = createValidator({
  type: 'object',
  additionalProperties: false,
  properties: {
    lt: {type: 'string'},
    lte: {type: 'string'},
    gt: {type: 'string'},
    gte: {type: 'string'},
    reverse: {type: 'boolean'},
    limit: {type: 'number'}
  }
})

export function setup (wsServer) {
  wsServer.register('posts.listFeaturedFeed', async params => {
    return 'todo'
  })

  wsServer.register('posts.listUserFeed', async ([username, opts]) => {
    if (opts) {
      listParam.assert(opts)
    }
    opts = opts || {}
    opts.limit = opts.limit && typeof opts.limit === 'number' ? opts.limit : 100
    opts.limit = Math.max(Math.min(opts.limit, 100), 1)

    const userDb = userDbs.get(username)
    if (!userDb) throw new Error('User database not found')

    const entries = await userDb.posts.list(opts)
    for (let entry of entries) {
      entry.url = constructUrl(userDb.posts.schema.url, username, entry.key)
    }
    return entries
  })

  wsServer.register('posts.listMyFeed', async params => {
    return 'todo'
  })

  wsServer.register('posts.get', async ([username, key]) => {
    const userDb = userDbs.get(username)
    if (!userDb) throw new Error('User database not found')

    const postEntry = await userDb.posts.get(key)
    if (!postEntry) {
      throw new Error('Post not found')
    }
    postEntry.url = constructUrl(userDb.posts.schema.url, username, postEntry.key)

    return postEntry
  })

  wsServer.register('posts.create', async ([post], client) => {
    if (!client?.auth) throw new Error('Must be logged in')
    const userDb = userDbs.get(client.auth.username)
    if (!userDb) throw new Error('User database not found')

    const key = ''+Date.now()
    post.createdAt = (new Date()).toISOString()
    await userDb.posts.put(key, post)
    
    const url = constructUrl(userDb.posts.schema.url, client.auth.username, key)
    return {key, url}
  })

  wsServer.register('posts.edit', async ([key, post], client) => {
    if (!client?.auth) throw new Error('Must be logged in')
    const userDb = userDbs.get(client.auth.username)
    if (!userDb) throw new Error('User database not found')

    const postEntry = await userDb.posts.get(key)
    if (!postEntry) {
      throw new Error('Post not found')
    }

    postEntry.value.text = post?.text
    await userDb.posts.put(key, postEntry.value)

    const url = constructUrl(userDb.posts.schema.url, client.auth.username, postEntry.key)
    return {key, url}
  })

  wsServer.register('posts.del', async ([key], client) => {
    if (!client?.auth) throw new Error('Must be logged in')
    const userDb = userDbs.get(client.auth.username)
    if (!userDb) throw new Error('User database not found')

    await userDb.posts.del(key)
  })
}
