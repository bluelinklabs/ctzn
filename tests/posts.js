import test from 'ava'
import { createServer, TestFramework } from './_util.js'

let close
let api
let sim = new TestFramework()

test.before(async () => {
  let inst = await createServer()
  close = inst.close
  api = inst.api

  await sim.createUser(inst, 'bob')
})

test.after.always(async t => {
	await close()
})

test('basic CRUD', async t => {
  const bob = sim.users.bob
  await bob.createPost({text: '1'})
  await bob.createPost({text: '2'})
  await bob.createPost({text: '3'})

  let postEntries = await api.posts.listUserFeed(bob.userId)
  sim.testFeed(t, postEntries, [
    [bob, '1'],
    [bob, '2'],
    [bob, '3']
  ])

  postEntries = await api.posts.listUserFeed(bob.userId, {reverse: true})
  sim.testFeed(t, postEntries, [
    [bob, '3'],
    [bob, '2'],
    [bob, '1']
  ])

  postEntries = await api.posts.listUserFeed(bob.userId, {limit: 2})
  sim.testFeed(t, postEntries, [
    [bob, '1'],
    [bob, '2']
  ])

  await api.posts.edit(bob.posts[0].key, {text: '1234'})
  let editedPost = await api.posts.get(bob.userId, bob.posts[0].key)
  sim.testPost(t, editedPost, [bob, '1234'])

  await api.posts.del(bob.posts[0].key)
  await t.throwsAsync(() => api.posts.get(bob.userId, bob.posts[0].key))
  postEntries = await api.posts.listUserFeed(bob.userId, {limit: 2})
  sim.testFeed(t, postEntries, [
    [bob, '2'],
    [bob, '3']
  ])
})