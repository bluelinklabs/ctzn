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
  await bob.login()
  await bob.follow(alice)
  await bob.follow(carla)

  await bob.createPost({text: '1'})
  await bob.createPost({text: '2'})
  await bob.createPost({text: '3'})
  await alice.createPost({text: '4'})
})

test.after.always(async t => {
	await close()
})

test('votes', async t => {
  const {alice, bob, carla} = sim.users
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

  for (let comment of bob.comments) {
    await alice.vote(comment, 1)
    await bob.vote(comment, 1)
    await carla.vote(comment, -1)
  }

  await bob.login()
  for (let comment of bob.comments) {
    let reply = await api.view.get('ctzn.network/views/comment', {dbId: 'bob', commentKey: comment.key})
    t.is(reply.votes.tally, 1)
    t.is(reply.votes.mine, 1)
  }

  await carla.login()
  for (let comment of bob.comments) {
    let reply = await api.view.get('ctzn.network/views/comment', {dbId: 'bob', commentKey: comment.key})
    t.is(reply.votes.tally, 1)
    t.is(reply.votes.mine, -1)
  }

  await bob.login()
  let thread = (await api.view.get('ctzn.network/views/thread', {dbUrl: bob.posts[0].dbUrl})).comments
  t.is(thread[0].votes.tally, 1)
  t.is(thread[0].votes.mine, 1)
  t.is(thread[0].replies[0].votes.tally, 1)
  t.is(thread[0].replies[0].votes.mine, 1)
  t.is(thread[0].replies[1].votes.tally, 1)
  t.is(thread[0].replies[1].votes.mine, 1)
  t.is(thread[1].votes.tally, 1)
  t.is(thread[1].votes.mine, 1)
})