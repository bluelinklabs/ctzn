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
  await sim.users.alice.login()
  await sim.createCommunity(inst, 'folks')
  await sim.createCommunity(inst, 'ppl')

  const {alice, bob, carla, folks, ppl} = sim.users
  await alice.login()
  await api.method('ctzn.network/methods/community-join', {communityDbId: folks.username})
  await api.method('ctzn.network/methods/community-join', {communityDbId: ppl.username})
  await bob.login()
  await api.method('ctzn.network/methods/community-join', {communityDbId: folks.username})
  await api.method('ctzn.network/methods/community-join', {communityDbId: ppl.username})
  await carla.login()
  await api.method('ctzn.network/methods/community-join', {communityDbId: folks.username})
  await api.method('ctzn.network/methods/community-join', {communityDbId: ppl.username})
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

test('multiple users posting to community', async t => {
  const {alice, bob, carla, folks, ppl} = sim.users
  await alice.createPost({text: '1', community: {dbKey: folks.dbKey}})
  await bob.createPost({text: '2', community: {dbKey: folks.dbKey}})
  await carla.createPost({text: '3', community: {dbKey: folks.dbKey}})
  await alice.createPost({text: '4', community: {dbKey: ppl.dbKey}})
  await bob.createPost({text: '5', community: {dbKey: ppl.dbKey}})
  await carla.createPost({text: '6', community: {dbKey: ppl.dbKey}})

  let postEntries = (await api.view.get('ctzn.network/views/posts', {dbId: folks.username})).posts
  sim.testFeed(t, postEntries, [
    [alice, '1'],
    [bob, '2'],
    [carla, '3']
  ])

  postEntries = (await api.view.get('ctzn.network/views/posts', {dbId: folks.username, reverse: true})).posts
  sim.testFeed(t, postEntries, [
    [carla, '3'],
    [bob, '2'],
    [alice, '1']
  ])

  postEntries = (await api.view.get('ctzn.network/views/posts', {dbId: folks.username, limit: 2})).posts
  sim.testFeed(t, postEntries, [
    [alice, '1'],
    [bob, '2']
  ])

  postEntries = (await api.view.get('ctzn.network/views/posts', {dbId: ppl.username})).posts
  sim.testFeed(t, postEntries, [
    [alice, '4'],
    [bob, '5'],
    [carla, '6']
  ])

  postEntries = (await api.view.get('ctzn.network/views/posts', {dbId: ppl.username, reverse: true})).posts
  sim.testFeed(t, postEntries, [
    [carla, '6'],
    [bob, '5'],
    [alice, '4']
  ])

  postEntries = (await api.view.get('ctzn.network/views/posts', {dbId: ppl.username, limit: 2})).posts
  sim.testFeed(t, postEntries, [
    [alice, '4'],
    [bob, '5']
  ])

  await bob.login()
  postEntries = (await api.view.get('ctzn.network/views/feed')).feed
  sim.testFeed(t, postEntries, [
    [carla, '6'],
    [bob, '5'],
    [alice, '4'],
    [carla, '3'],
    [bob, '2'],
    [alice, '1'],
    [bob, '3'],
    [bob, '2']
  ])
  postEntries = (await api.view.get('ctzn.network/views/feed', {limit: 2})).feed
  sim.testFeed(t, postEntries, [
    [carla, '6'],
    [bob, '5']
  ])
  postEntries = (await api.view.get('ctzn.network/views/feed', {lt: bob.posts[2].key})).feed
  sim.testFeed(t, postEntries, [
    [bob, '2']
  ])

  await alice.login()
  await api.table.update(
    alice.dbKey,
    'ctzn.network/post',
    alice.posts[0].key,
    Object.assign({}, alice.posts[0].value, {text: '1234'})
  )
  postEntries = (await api.view.get('ctzn.network/views/posts', {dbId: folks.dbKey})).posts
  sim.testFeed(t, postEntries, [
    [alice, '1234'],
    [bob, '2'],
    [carla, '3']
  ])

  await alice.login()
  await api.table.delete(alice.dbKey, 'ctzn.network/post', alice.posts[0].key)
  await t.throwsAsync(() => api.view.get('ctzn.network/views/post', {dbId: alice.username, postKey: alice.posts[0].key}))

  postEntries = (await api.view.get('ctzn.network/views/posts', {dbId: folks.username})).posts
  sim.testFeed(t, postEntries, [
    [bob, '2'],
    [carla, '3']
  ])
})

test('extended text', async t => {
  const bob = sim.users.bob
  let post = await bob.createPost({text: 'the limited text', extendedText: 'the unlimited text'})
  let postRecord = await api.view.get('ctzn.network/views/post', {dbId: bob.username, postKey: post.key})
  t.is(postRecord.value.text, 'the limited text')
  t.is(postRecord.value.extendedText, 'the unlimited text')
})