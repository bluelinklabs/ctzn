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
  await sim.createCommunity(inst, 'folks')
  await sim.createCommunity(inst, 'ppl')

  const {alice, bob, carla, folks, ppl} = sim.users
  await alice.login()
  await api.communities.join(folks.userId)
  await api.communities.join(ppl.userId)
  await bob.login()
  await api.communities.join(folks.userId)
  await api.communities.join(ppl.userId)
  await carla.login()
  await api.communities.join(folks.userId)
  await api.communities.join(ppl.userId)
})

test.after.always(async t => {
	await close()
})

test('single user posting to self', async t => {
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

test('multiple users posting to community', async t => {
  const {alice, bob, carla, folks, ppl} = sim.users
  await alice.createPost({text: '1', community: {userId: folks.userId, dbUrl: folks.profile.dbUrl}})
  await bob.createPost({text: '2', community: {userId: folks.userId, dbUrl: folks.profile.dbUrl}})
  await carla.createPost({text: '3', community: {userId: folks.userId, dbUrl: folks.profile.dbUrl}})
  await alice.createPost({text: '4', community: {userId: ppl.userId, dbUrl: ppl.profile.dbUrl}})
  await bob.createPost({text: '5', community: {userId: ppl.userId, dbUrl: ppl.profile.dbUrl}})
  await carla.createPost({text: '6', community: {userId: ppl.userId, dbUrl: ppl.profile.dbUrl}})

  let postEntries = await api.posts.listUserFeed(folks.userId)
  sim.testFeed(t, postEntries, [
    [alice, '1'],
    [bob, '2'],
    [carla, '3']
  ])

  postEntries = await api.posts.listUserFeed(folks.userId, {reverse: true})
  sim.testFeed(t, postEntries, [
    [carla, '3'],
    [bob, '2'],
    [alice, '1']
  ])

  postEntries = await api.posts.listUserFeed(folks.userId, {limit: 2})
  sim.testFeed(t, postEntries, [
    [alice, '1'],
    [bob, '2']
  ])

  postEntries = await api.posts.listUserFeed(ppl.userId)
  sim.testFeed(t, postEntries, [
    [alice, '4'],
    [bob, '5'],
    [carla, '6']
  ])

  postEntries = await api.posts.listUserFeed(ppl.userId, {reverse: true})
  sim.testFeed(t, postEntries, [
    [carla, '6'],
    [bob, '5'],
    [alice, '4']
  ])

  postEntries = await api.posts.listUserFeed(ppl.userId, {limit: 2})
  sim.testFeed(t, postEntries, [
    [alice, '4'],
    [bob, '5']
  ])

  await alice.login()
  await api.posts.edit(alice.posts[0].key, {text: '1234'})
  postEntries = await api.posts.listUserFeed(folks.userId)
  sim.testFeed(t, postEntries, [
    [alice, '1234'],
    [bob, '2'],
    [carla, '3']
  ])

  await alice.login()
  await api.posts.del(alice.posts[0].key)
  await t.throwsAsync(() => api.posts.get(alice.userId, alice.posts[0].key))

  postEntries = await api.posts.listUserFeed(folks.userId)
  sim.testFeed(t, postEntries, [
    [bob, '2'],
    [carla, '3']
  ])
})