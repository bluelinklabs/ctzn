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

  const {alice, bob, carla, folks} = sim.users
  await alice.login()
  await api.communities.join(folks.userId)
  await bob.login()
  await api.communities.join(folks.userId)
  await bob.follow(alice)
  await bob.follow(carla)

  await bob.createPost({text: '1'})
  await bob.createPost({text: '2'})
  await bob.createPost({text: '3', community: {userId: folks.userId, dbUrl: folks.profile.dbUrl}})
  await alice.createPost({text: '4'})
})

test.after.always(async t => {
	await close()
})

test('single user viewing self content', async t => {
  const bob = sim.users.bob
  await bob.createComment({
    reply: {root: bob.posts[0]},
    text: 'Comment 1'
  })
  await bob.createComment({
    reply: {root: bob.posts[0], parent: bob.comments[0]},
    text: 'Reply 1'
  })
  await bob.createComment({
    reply: {root: bob.posts[0], parent: bob.comments[0]},
    text: 'Reply 2'
  })
  await bob.createComment({
    reply: {root: bob.posts[0]},
    text: 'Comment 2'
  })

  let reply1 = await api.comments.get(bob.userId, bob.comments[0].key)
  sim.testComment(t, reply1, [bob, 'Comment 1'], {root: bob.posts[0]})

  let reply2 = await api.comments.get(bob.userId, bob.comments[1].key)
  sim.testComment(t, reply2, [bob, 'Reply 1'], {root: bob.posts[0], parent: bob.comments[0]})

  await api.comments.edit(bob.comments[0].key, {text: 'The First Comment'})
  let reply1Edited = await api.comments.get(bob.userId, bob.comments[0].key)
  sim.testComment(t, reply1Edited, [bob, 'The First Comment'], {root: bob.posts[0]})

  let thread1 = await api.comments.getThread(bob.posts[0].url)
  sim.testThread(t, thread1, [
    [bob, 'The First Comment', [
      [bob, 'Reply 1'],
      [bob, 'Reply 2']
    ]],
    [bob, 'Comment 2']
  ])
})

test('multiple users w/follows', async t => {
  const {alice, bob, carla} = sim.users
  await alice.createComment({
    reply: {root: bob.posts[0]},
    text: 'Alice Comment 1'
  })
  await alice.createComment({
    reply: {root: bob.posts[0], parent: bob.comments[0]},
    text: 'Alice Reply 1'
  })
  await carla.createComment({
    reply: {root: bob.posts[0], parent: bob.comments[0]},
    text: 'Carla Reply 2'
  })
  await carla.createComment({
    reply: {root: bob.posts[0]},
    text: 'Carla Comment 2'
  })
  await alice.createComment({
    reply: {root: alice.posts[0]},
    text: 'Test 1'
  })
  await bob.createComment({
    reply: {root: alice.posts[0]},
    text: 'Test 2'
  })
  await carla.createComment({
    reply: {root: alice.posts[0]},
    text: 'Test 3'
  })

  await new Promise(r => setTimeout(r, 5e3))
  await api.debug.whenAllSynced()

  // bob sees everyone's replies because he follows everybody
  await bob.login()
  let thread1 = await api.comments.getThread(bob.posts[0].url)
  sim.testThread(t, thread1, [
    [bob, 'The First Comment', [
      [bob, 'Reply 1'],
      [bob, 'Reply 2'],
      [alice, 'Alice Reply 1'],
      [carla, 'Carla Reply 2'],
    ]],
    [bob, 'Comment 2'],
    [alice, 'Alice Comment 1'],
    [carla, 'Carla Comment 2']
  ])

  // alice sees everyone's replies because the author (bob) follows everybody
  await alice.login()
  let thread2 = await api.comments.getThread(bob.posts[0].url)
  sim.testThread(t, thread2, [
    [bob, 'The First Comment', [
      [bob, 'Reply 1'],
      [bob, 'Reply 2'],
      [alice, 'Alice Reply 1'],
      [carla, 'Carla Reply 2'],
    ]],
    [bob, 'Comment 2'],
    [alice, 'Alice Comment 1'],
    [carla, 'Carla Comment 2']
  ])

  // bob sees everyone's replies because he follows everybody
  await bob.login()
  let thread3 = await api.comments.getThread(alice.posts[0].url)
  sim.testThread(t, thread3, [
    [alice, 'Test 1'],
    [bob, 'Test 2'],
    [carla, 'Test 3']
  ])

  // alice only sees her own replies because she follows nobody
  await alice.login()
  let thread4 = await api.comments.getThread(alice.posts[0].url)
  sim.testThread(t, thread4, [
    [alice, 'Test 1']
  ])
})

test('community', async t => {
  const {alice, bob, carla, folks} = sim.users
  await alice.createComment({
    community: {userId: folks.userId, dbUrl: folks.profile.dbUrl},
    reply: {root: bob.posts[2]},
    text: 'Alice Comment 1'
  })
  await alice.createComment({
    community: {userId: folks.userId, dbUrl: folks.profile.dbUrl},
    reply: {root: bob.posts[2], parent: alice.comments[alice.comments.length - 1]},
    text: 'Alice Reply 1'
  })
  await alice.createComment({
    reply: {root: bob.posts[2]},
    text: 'Alice Comment 2'
  })
  await bob.createComment({
    community: {userId: folks.userId, dbUrl: folks.profile.dbUrl},
    reply: {root: bob.posts[2]},
    text: 'Bob Comment 1'
  })
  await carla.createComment({
    community: {userId: folks.userId, dbUrl: folks.profile.dbUrl},
    reply: {root: bob.posts[2]},
    text: 'Carla Comment 1'
  })

  // shows the community member comments no matter who is logged in
  await bob.login()
  let thread1 = await api.comments.getThread(bob.posts[2].url)
  sim.testThread(t, thread1, [
    [alice, 'Alice Comment 1', [
      [alice, 'Alice Reply 1'],
    ]],
    [bob, 'Bob Comment 1']
  ])

  // shows the community member comments no matter who is logged in
  await carla.login()
  let thread2 = await api.comments.getThread(bob.posts[2].url)
  sim.testThread(t, thread2, [
    [alice, 'Alice Comment 1', [
      [alice, 'Alice Reply 1'],
    ]],
    [bob, 'Bob Comment 1']
  ])
})

test('missing parent comments', async t => {
  const {alice, bob, carla} = sim.users
  await bob.login()
  await api.comments.del(bob.comments[0].key)
  await t.throwsAsync(() => api.comments.get(bob.userId, bob.comments[0].key))
  let thread2 = await api.comments.getThread(bob.posts[0].url)
  sim.testThread(t, thread2, [
    [bob, 'Reply 1'],
    [bob, 'Reply 2'],
    [bob, 'Comment 2'],
    [alice, 'Alice Comment 1'],
    [alice, 'Alice Reply 1'],
    [carla, 'Carla Reply 2'],
    [carla, 'Carla Comment 2']
  ])
})