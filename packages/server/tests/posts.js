import test from 'ava'
import { createServer, TestFramework } from './_util.js'

let close
let api
let sim = new TestFramework()

test.before(async () => {
  let inst = await createServer()
  close = inst.close
  api = inst.api

  await sim.createCitizen(inst, 'alice')
  await sim.createCitizen(inst, 'bob')
  await sim.createCitizen(inst, 'carla')
})

test.after.always(async t => {
	await close()
})

test('single user posting to self', async t => {
  const bob = sim.users.bob
  await bob.createPost({text: '1'})
  await bob.createPost({text: '2'})
  await bob.createPost({text: '3'})

  let postEntries = (await api.view.get('ctzn.network/views/posts', {dbId: bob.username})).posts
  sim.testFeed(t, postEntries, [
    [bob, '1'],
    [bob, '2'],
    [bob, '3']
  ])

  postEntries = (await api.view.get('ctzn.network/views/posts', {dbId: bob.username, reverse: true})).posts
  sim.testFeed(t, postEntries, [
    [bob, '3'],
    [bob, '2'],
    [bob, '1']
  ])

  postEntries = (await api.view.get('ctzn.network/views/posts', {dbId: bob.username, limit: 2})).posts
  sim.testFeed(t, postEntries, [
    [bob, '1'],
    [bob, '2']
  ])

  await api.table.update(
    bob.username,
    'ctzn.network/post',
    bob.posts[0].key,
    Object.assign({}, bob.posts[0].value, {text: '1234'})
  )
  let editedPost = await api.view.get('ctzn.network/views/post', {dbId: bob.username, postKey: bob.posts[0].key})
  sim.testPost(t, editedPost, [bob, '1234'])

  await api.table.delete(bob.username, 'ctzn.network/post', bob.posts[0].key)
  await t.throwsAsync(() => api.view.get('ctzn.network/views/post', bob.username, bob.posts[0].key))
  postEntries = (await api.view.get('ctzn.network/views/posts', {dbId: bob.username})).posts
  sim.testFeed(t, postEntries, [
    [bob, '2'],
    [bob, '3']
  ])
})

test('feeds', async t => {
  const {alice, bob, carla} = sim.users
  await bob.follow(alice)
  await alice.createPost({text: '4'})
  await carla.createPost({text: '5'})
  await bob.createPost({text: '6'})
  await bob.follow(carla)

  await bob.login()
  let postEntries = (await api.view.get('ctzn.network/views/feed')).feed
  sim.testFeed(t, postEntries, [
    [bob, '6'],
    [carla, '5'],
    [alice, '4'],
    [bob, '3'],
    [bob, '2']
  ])
  postEntries = (await api.view.get('ctzn.network/views/feed', {limit: 2})).feed
  sim.testFeed(t, postEntries, [
    [bob, '6'],
    [carla, '5']
  ])
  postEntries = (await api.view.get('ctzn.network/views/feed', {lt: bob.posts[2].key})).feed
  sim.testFeed(t, postEntries, [
    [bob, '2']
  ])

  await alice.login()
  postEntries = (await api.view.get('ctzn.network/views/feed')).feed
  sim.testFeed(t, postEntries, [
    [alice, '4'],
  ])
})

test('extended text', async t => {
  const bob = sim.users.bob
  let post = await bob.createPost({text: 'the limited text', extendedText: 'the unlimited text'})
  let postRecord = await api.view.get('ctzn.network/views/post', {dbId: bob.username, postKey: post.key})
  t.is(postRecord.value.text, 'the limited text')
  t.is(postRecord.value.extendedText, 'the unlimited text')
})