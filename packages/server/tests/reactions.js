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

  const {alice, bob, carla} = sim.users
  await bob.follow(alice)
  await bob.follow(carla)

  await bob.createPost({text: '1'})
  await bob.createPost({text: '2'})
  await bob.createPost({text: '3'}})
  await alice.createPost({text: '4'})
})

test.after.always(async t => {
	await close()
})

test('self indexes', async t => {
  const {alice, bob, carla} = sim.users

  await bob.react({subject: bob.posts[0], reaction: 'like'})
  await bob.react({subject: bob.posts[1], reaction: 'woah'})
  await bob.react({subject: alice.posts[0], reaction: 'like'})
  await alice.react({subject: bob.posts[0], reaction: 'like'})
  await alice.react({subject: bob.posts[1], reaction: 'like'})
  await alice.react({subject: alice.posts[0], reaction: 'like'})
  await carla.react({subject: bob.posts[0], reaction: 'woah'})
  await carla.react({subject: bob.posts[1], reaction: 'woah'})
  await carla.react({subject: alice.posts[0], reaction: 'woah'})

  await bob.login()
  let res = await api.view.get('ctzn.network/reactions-to-view', bob.posts[0].url)
  t.is(res.subject.dbUrl, bob.posts[0].url)
  t.is(res.reactions.like.length, 2)
  t.is(res.reactions.woah.length, 1)

  await bob.login()
  res = await api.view.get('ctzn.network/reactions-to-view', bob.posts[1].url)
  t.is(res.subject.dbUrl, bob.posts[1].url)
  t.is(res.reactions.like.length, 1)
  t.is(res.reactions.woah.length, 2)

  await carla.login()
  res = await api.view.get('ctzn.network/reactions-to-view', bob.posts[0].url)
  t.is(res.subject.dbUrl, bob.posts[0].url)
  t.is(res.reactions.like.length, 2)
  t.is(res.reactions.woah.length, 1)

  // the rest are making sure changes are indexed

  await bob.login()
  await bob.unreact({subject: bob.posts[0], reaction: 'like'})
  await bob.react({subject: bob.posts[0], reaction: 'woah'})
  res = await api.view.get('ctzn.network/reactions-to-view', bob.posts[0].url)
  t.is(res.subject.dbUrl, bob.posts[0].url)
  t.is(res.reactions.like.length, 1)
  t.is(res.reactions.woah.length, 2)

  await bob.unreact({subject: bob.posts[0], reaction: 'woah'})
  res = await api.view.get('ctzn.network/reactions-to-view', bob.posts[0].url)
  t.is(res.subject.dbUrl, bob.posts[0].url)
  t.is(res.reactions.like.length, 1)
  t.is(res.reactions.woah.length, 1)

  await alice.unreact({subject: bob.posts[0], reaction: 'like'})
  res = await api.view.get('ctzn.network/reactions-to-view', bob.posts[0].url)
  t.is(res.subject.dbUrl, bob.posts[0].url)
  t.falsy(res.reactions.like)
  t.is(res.reactions.woah.length, 1)

  await carla.unreact({subject: bob.posts[0], reaction: 'woah'})
  res = await api.view.get('ctzn.network/reactions-to-view', bob.posts[0].url)
  t.is(res.subject.dbUrl, bob.posts[0].url)
  t.falsy(res.reactions.like)
  t.falsy(res.reactions.woah)
})