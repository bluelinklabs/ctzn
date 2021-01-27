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
    subjectUrl: bob.posts[0].url,
    text: 'Comment 1'
  })
  await carla.createComment({
    subjectUrl: bob.posts[0].url,
    parentCommentUrl: alice.comments[0].url,
    text: 'Reply 1'
  })
  await bob.createComment({
    subjectUrl: bob.posts[0].url,
    parentCommentUrl: alice.comments[0].url,
    text: 'Reply 2'
  })
  await carla.createComment({
    subjectUrl: bob.posts[0].url,
    text: 'Comment 2'
  })

  await bob.vote({subjectUrl: bob.posts[0].url, vote: 1})
  await bob.vote({subjectUrl: bob.posts[1].url, vote: -1})
  for (let post of bob.posts) {
    await alice.vote({subjectUrl: post.url, vote: 1})
  }
  for (let comment of bob.comments) {
    await alice.vote({subjectUrl: comment.url, vote: 1})
  }
  for (let post of bob.posts) {
    await carla.vote({subjectUrl: post.url, vote: -1})
  }
  for (let comment of bob.comments) {
    await carla.vote({subjectUrl: comment.url, vote: -1})
  }
})

test.after.always(async t => {
	await close()
})

test('basic CRUD', async t => {
  const {alice, bob, carla} = sim.users

  await bob.login()
  let notifications1 = await api.notifications.list({reverse: true})
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