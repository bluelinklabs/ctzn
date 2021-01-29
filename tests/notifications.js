import test from 'ava'
import { createServer, TestFramework } from './_util.js'

let close
let api
let sim = new TestFramework()

test.before(async () => {
  let inst = await createServer()
  close = inst.close
  api = inst.api

  await sim.createUser(inst, 'alice')
  await sim.createUser(inst, 'bob')
  await sim.createUser(inst, 'carla')
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
    subject: bob.posts[0],
    text: 'Comment 1'
  })
  await carla.createComment({
    subject: bob.posts[0],
    parent: alice.comments[0],
    text: 'Reply 1'
  })
  await bob.createComment({
    subject: bob.posts[0],
    parent: alice.comments[0],
    text: 'Reply 2'
  })
  await carla.createComment({
    subject: bob.posts[0],
    text: 'Comment 2'
  })

  await bob.vote({subject: bob.posts[0], vote: 1})
  await bob.vote({subject: bob.posts[1], vote: -1})
  for (let post of bob.posts) {
    await alice.vote({subject: post, vote: 1})
  }
  for (let comment of bob.comments) {
    await alice.vote({subject: comment, vote: 1})
  }
  for (let post of bob.posts) {
    await carla.vote({subject: post, vote: -1})
  }
  for (let comment of bob.comments) {
    await carla.vote({subject: comment, vote: -1})
  }
})

test.after.always(async t => {
	await close()
})

test('server notifications index', async t => {
  const {alice, bob, carla} = sim.users

  await bob.login()
  let notifications1 = await api.notifications.list()
  sim.testNotifications(t, notifications1, [
    [carla, 'downvote', bob.comments[0]],
    [carla, 'downvote', bob.posts[1]],
    [carla, 'downvote', bob.posts[0]],
    [alice, 'upvote', bob.comments[0]],
    [alice, 'upvote', bob.posts[1]],
    [alice, 'upvote', bob.posts[0]],
    [carla, 'comment', {text: 'Comment 2', subject: bob.posts[0]}],
    [carla, 'comment', {text: 'Reply 1', subject: bob.posts[0], parent: alice.comments[0]}],
    [alice, 'comment', {text: 'Comment 1', subject: bob.posts[0]}],
    [carla, 'follow', bob],
    [alice, 'follow', bob],
  ])
})