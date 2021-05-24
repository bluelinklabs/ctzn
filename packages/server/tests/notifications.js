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

  await bob.login()
  var notifications = (await api.view.get('ctzn.network/views/notifications')).notifications
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
    [alice, 'follow', bob]
  ])

  let notes1 = (await api.view.get('ctzn.network/views/notifications', {limit: 2})).notifications
  t.is(notes1.length, 2)
  let notes2 = (await api.view.get('ctzn.network/views/notifications', {limit: 2, lt: notes1[1].key})).notifications
  t.is(notes2.length, 2)
  t.truthy(notes1[1].key !== notes2[0].key)

  await close()
  close = undefined
})
