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

  await new Promise(r => setTimeout(r, 5e3))
  await api.debug.whenAllSynced()

  // see all reactions by users followed by authed
  await bob.login()
  let res = await api.views.get('ctzn.network/reactions-to-view', bob.posts[0].url)
  t.is(res.subject.dbUrl, bob.posts[0].url)
  t.is(res.reactions.like.length, 2)
  t.is(res.reactions.woah.length, 1)

  // see all reactions by users followed by authed
  await bob.login()
  res = await api.views.get('ctzn.network/reactions-to-view', bob.posts[1].url)
  t.is(res.subject.dbUrl, bob.posts[1].url)
  t.is(res.reactions.like.length, 1)
  t.is(res.reactions.woah.length, 2)

  // see all reactions by users followed by author
  await carla.login()
  res = await api.views.get('ctzn.network/reactions-to-view', bob.posts[0].url)
  t.is(res.subject.dbUrl, bob.posts[0].url)
  t.is(res.reactions.like.length, 2)
  t.is(res.reactions.woah.length, 1)

  // dont see bob's reaction because he's not followed by authed or author
  await carla.login()
  res = await api.views.get('ctzn.network/reactions-to-view', alice.posts[0].url)
  t.is(res.subject.dbUrl, alice.posts[0].url)
  t.is(res.reactions.like.length, 1)
  t.is(res.reactions.woah.length, 1)

  // the rest are making sure changes are indexed

  await bob.login()
  await bob.unreact({subject: bob.posts[0], reaction: 'like'})
  await bob.react({subject: bob.posts[0], reaction: 'woah'})
  res = await api.views.get('ctzn.network/reactions-to-view', bob.posts[0].url)
  t.is(res.subject.dbUrl, bob.posts[0].url)
  t.is(res.reactions.like.length, 1)
  t.is(res.reactions.woah.length, 2)

  await bob.unreact({subject: bob.posts[0], reaction: 'woah'})
  res = await api.views.get('ctzn.network/reactions-to-view', bob.posts[0].url)
  t.is(res.subject.dbUrl, bob.posts[0].url)
  t.is(res.reactions.like.length, 1)
  t.is(res.reactions.woah.length, 1)

  await alice.unreact({subject: bob.posts[0], reaction: 'like'})
  res = await api.views.get('ctzn.network/reactions-to-view', bob.posts[0].url)
  t.is(res.subject.dbUrl, bob.posts[0].url)
  t.falsy(res.reactions.like)
  t.is(res.reactions.woah.length, 1)

  await carla.unreact({subject: bob.posts[0], reaction: 'woah'})
  res = await api.views.get('ctzn.network/reactions-to-view', bob.posts[0].url)
  t.is(res.subject.dbUrl, bob.posts[0].url)
  t.falsy(res.reactions.like)
  t.falsy(res.reactions.woah)
})

test('community indexes', async t => {
  const {alice, bob, carla} = sim.users

  await alice.react({subject: bob.posts[2], reaction: 'like'})
  await bob.react({subject: bob.posts[2], reaction: 'like'})
  await carla.react({subject: bob.posts[2], reaction: 'woah'})

  await new Promise(r => setTimeout(r, 5e3))
  await api.debug.whenAllSynced()

  // see only community member reactions no matter who is authed
  await bob.login()
  let res = await api.views.get('ctzn.network/reactions-to-view', bob.posts[2].url)
  t.is(res.subject.dbUrl, bob.posts[2].url)
  t.is(res.reactions.like.length, 2)
  t.is(res.reactions.woah.length, 1)

  // see only community member votes no matter who is authed
  await carla.login()
  res = await api.views.get('ctzn.network/reactions-to-view', bob.posts[2].url)
  t.is(res.subject.dbUrl, bob.posts[2].url)
  t.is(res.reactions.like.length, 2)
  t.is(res.reactions.woah.length, 1)

  // the rest are making sure changes are indexed

  await bob.login()
  await bob.unreact({subject: bob.posts[2], reaction: 'like'})
  await new Promise(r => setTimeout(r, 5e3))
  await api.debug.whenAllSynced()
  res = await api.views.get('ctzn.network/reactions-to-view', bob.posts[2].url)
  t.is(res.subject.dbUrl, bob.posts[2].url)
  t.is(res.reactions.like.length, 1)
  t.is(res.reactions.woah.length, 1)
})