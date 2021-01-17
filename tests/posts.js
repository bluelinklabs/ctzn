import test from 'ava'
import { createServer } from './_util.js'

let close
let api
let posts = []

test.before(async () => {
  let inst = await createServer()
  close = inst.close
  api = inst.api

  await inst.db.createUser({
    username: 'bobo',
    email: 'bobo@roberts.com',
    profile: {
      displayName: 'Bobo Roberts'
    }
  })
  await api.accounts.login({username: 'bobo', password: 'password'})
})

test.after.always(async t => {
	await close()
})

test('create post', async t => {
  posts.push(await api.posts.create({text: '1'}))
  posts.push(await api.posts.create({text: '2'}))
  posts.push(await api.posts.create({text: '3'}))
  t.is(posts.length, 3)
  t.truthy(typeof posts[0].postId === 'string')
  t.truthy(typeof posts[1].postId === 'string')
  t.truthy(typeof posts[2].postId === 'string')
})