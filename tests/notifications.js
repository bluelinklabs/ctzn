import test from 'ava'
import { createServer, TestFramework } from './_util.js'

let close

test.after.always(async t => {
	if (close) await close()
})

test('user notifications index', async t => {
  // everybody follows everybody
  // =

  let sim = new TestFramework()
  let inst = await createServer()
  let api = inst.api
  close = inst.close

  await sim.createCitizen(inst, 'alice')
  await sim.createCitizen(inst, 'bob')
  await sim.createCitizen(inst, 'carla')
  const {alice, bob, carla} = sim.users

  await alice.follow(bob)
  await alice.follow(carla)
  await bob.follow(alice)
  await bob.follow(carla)
  await carla.follow(bob)
  await carla.follow(alice)

  await bob.createPost({text: '1'})
  await bob.createPost({text: '2'})
  await carla.createPost({text: '3'})

  await alice.createComment({
    reply: {root: bob.posts[0]},
    text: 'Comment 1'
  })
  await carla.createComment({
    reply: {root: bob.posts[0], parent: alice.replies[0]},
    text: 'Reply 1'
  })
  await bob.createComment({
    reply: {root: bob.posts[0], parent: alice.replies[0]},
    text: 'Reply 2'
  })
  await carla.createComment({
    reply: {root: bob.posts[0]},
    text: 'Comment 2'
  })

  await bob.react({subject: bob.posts[0], reaction: 'like'})
  await bob.react({subject: bob.posts[1], reaction: 'woah'})
  for (let post of bob.posts) {
    await alice.react({subject: post, reaction: 'like'})
  }
  for (let reply of bob.replies) {
    await alice.react({subject: reply, reaction: 'like'})
  }
  for (let post of bob.posts) {
    await carla.react({subject: post, reaction: 'woah'})
  }
  for (let reply of bob.replies) {
    await carla.react({subject: reply, reaction: 'woah'})
  }

  await new Promise(r => setTimeout(r, 5e3))
  await api.debug.whenAllSynced()

  await bob.login()
  var notifications = await api.notifications.list()
  notifications.sort((a, b) => new Date(b.item.createdAt) - new Date(a.item.createdAt))
  sim.testNotifications(t, notifications, [
    [carla, 'reaction', bob.replies[0], 'woah'],
    [carla, 'reaction', bob.posts[1], 'woah'],
    [carla, 'reaction', bob.posts[0], 'woah'],
    [alice, 'reaction', bob.replies[0], 'like'],
    [alice, 'reaction', bob.posts[1], 'like'],
    [alice, 'reaction', bob.posts[0], 'like'],
    [carla, 'comment', {text: 'Comment 2', reply: {root: bob.posts[0]}}],
    [carla, 'comment', {text: 'Reply 1', reply: {root: bob.posts[0], parent: alice.replies[0]}}],
    [alice, 'comment', {text: 'Comment 1', reply: {root: bob.posts[0]}}],
    [carla, 'follow', bob],
    [alice, 'follow', bob],
  ])

  let notes1 = await api.notifications.list({limit: 2})
  t.is(notes1.length, 2)
  let notes2 = await api.notifications.list({limit: 2, lt: notes1[1].key})
  t.is(notes2.length, 2)
  t.truthy(notes1[1].key !== notes2[0].key)

  await close()
  close = undefined
})

test('user & community notifications index', async t => {
  // bob only follows alice but is in a community with carla
  // =

  let sim = new TestFramework()
  let inst = await createServer()
  let api = inst.api
  close = inst.close

  await sim.createCitizen(inst, 'alice')
  await sim.createCitizen(inst, 'bob')
  await sim.createCitizen(inst, 'carla')
  await sim.users.alice.login()
  await sim.createCommunity(inst, 'folks')
  const {alice, bob, carla, folks} = sim.users

  await bob.login()
  await api.communities.join(folks.userId)
  await carla.login()
  await api.communities.join(folks.userId)

  await alice.follow(bob)
  await alice.follow(carla)
  await bob.follow(alice)
  // bob does NOT follow carla
  await carla.follow(bob)
  await carla.follow(alice)

  await bob.createPost({text: '1'})
  await bob.createPost({text: '2', community: {userId: folks.userId, dbUrl: folks.profile.dbUrl}})
  await carla.createPost({text: '3', community: {userId: folks.userId, dbUrl: folks.profile.dbUrl}})

  await alice.createComment({
    reply: {root: bob.posts[0]},
    text: 'Comment 1'
  })
  await carla.createComment({
    community: {userId: folks.userId, dbUrl: folks.profile.dbUrl},
    reply: {root: bob.posts[1]},
    text: 'Reply 1'
  })
  await bob.createComment({
    community: {userId: folks.userId, dbUrl: folks.profile.dbUrl},
    reply: {root: bob.posts[1], parent: carla.replies[0]},
    text: 'Reply 2'
  })
  await carla.createComment({
    community: {userId: folks.userId, dbUrl: folks.profile.dbUrl},
    reply: {root: bob.posts[1]},
    text: 'Comment 2'
  })

  await bob.react({subject: bob.posts[0], reaction: 'like'})
  await bob.react({subject: bob.posts[1], reaction: 'woah'})
  for (let post of bob.posts) {
    await alice.react({subject: post, reaction: 'like'})
  }
  for (let reply of bob.replies) {
    await alice.react({subject: reply, reaction: 'like'})
  }
  for (let post of bob.posts) {
    await carla.react({subject: post, reaction: 'woah'})
  }
  for (let reply of bob.replies) {
    await carla.react({subject: reply, reaction: 'woah'})
  }

  await new Promise(r => setTimeout(r, 5e3))
  await api.debug.whenAllSynced()

  await bob.login()
  var notifications = await api.notifications.list()
  notifications.sort((a, b) => new Date(b.item.createdAt) - new Date(a.item.createdAt))
  sim.testNotifications(t, notifications, [
    [carla, 'reaction', bob.replies[0], 'woah'],
    [carla, 'reaction', bob.posts[1], 'woah'],
    // bob does not follow carla so he does not receive [carla, 'reaction', bob.posts[0], 'woah'],
    [alice, 'reaction', bob.replies[0], 'like'],
    [alice, 'reaction', bob.posts[1], 'like'],
    [alice, 'reaction', bob.posts[0], 'like'],
    [carla, 'comment', {text: 'Comment 2', reply: {root: bob.posts[1]}}],
    [carla, 'comment', {text: 'Reply 1', reply: {root: bob.posts[1]}}],
    [alice, 'comment', {text: 'Comment 1', reply: {root: bob.posts[0]}}],
    [carla, 'follow', bob],
    [alice, 'follow', bob],
  ])

  await close()
  close = undefined
})