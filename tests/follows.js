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
  await sim.createCitizen(inst, 'dan')
  await sim.users.alice.login()
  await sim.createCommunity(inst, 'folks')

  const {alice, bob, carla, folks} = sim.users
  await bob.login()
  await api.communities.join(folks.userId)
  await bob.follow(alice)
  await bob.follow(carla)
})

test.after.always(async t => {
	await close()
})

test('basic CRUD', async t => {
  const {alice, bob, carla, dan, folks} = sim.users
  await alice.login()
  await api.communities.join(folks.userId)
  await bob.login()
  await api.communities.join(folks.userId)
  await dan.login()
  await api.communities.join(folks.userId)

  // bob, alice, and carla all follow each other
  await bob.follow(alice)
  await bob.follow(carla)
  await alice.follow(bob)
  await alice.follow(carla)
  await carla.follow(alice)
  await carla.follow(bob)

  // dan follows everybody and gets no follow backs
  // however, he's in "folks" with alice and bob
  await dan.follow(alice)
  await dan.follow(bob)
  await dan.follow(carla)

  await new Promise(r => setTimeout(r, 5e3))
  await api.debug.whenAllSynced()

  let follow1 = await api.follows.get(bob.userId, alice.userId)
  t.is(follow1.value.subject.dbUrl, alice.profile.dbUrl)
  t.is(follow1.value.subject.userId, alice.userId)

  let follow2 = await api.follows.get(bob.userId, carla.userId)
  t.is(follow2.value.subject.dbUrl, carla.profile.dbUrl)
  t.is(follow2.value.subject.userId, carla.userId)

  let follows1 = await api.follows.listFollows(bob.userId)
  sim.testFollows(t, follows1, [alice, carla])

  let follows2 = await api.follows.listFollows(alice.userId)
  sim.testFollows(t, follows2, [bob, carla])

  let follows3 = await api.follows.listFollows(carla.userId)
  sim.testFollows(t, follows3, [alice, bob])

  let follows4 = await api.follows.listFollows(dan.userId)
  sim.testFollows(t, follows4, [alice, bob, carla])

  let follows5 = await api.follows.listFollows(bob.userId, {limit: 1})
  t.is(follows5.length, 1)

  // alice viewing self
  await alice.login()
  var followers = await api.follows.listFollowers(alice.userId)
  t.is(followers.myFollowed.length, 2)
  t.truthy(followers.myFollowed.includes(bob.userId))
  t.truthy(followers.myFollowed.includes(carla.userId))
  t.is(followers.myCommunity.length, 2)
  t.truthy(followers.myCommunity.includes(bob.userId))
  t.truthy(followers.myCommunity.includes(dan.userId))
  t.is(followers.community.length, 2)
  t.truthy(followers.community.includes(bob.userId))
  t.truthy(followers.community.includes(dan.userId))

  // bob viewing alice
  await bob.login()
  var followers = await api.follows.listFollowers(alice.userId)
  t.is(followers.myFollowed.length, 2)
  t.truthy(followers.myFollowed.includes(bob.userId))
  t.truthy(followers.myFollowed.includes(carla.userId))
  t.is(followers.myCommunity.length, 2)
  t.truthy(followers.myCommunity.includes(bob.userId))
  t.truthy(followers.myCommunity.includes(dan.userId))
  t.is(followers.community.length, 2)
  t.truthy(followers.community.includes(bob.userId))
  t.truthy(followers.community.includes(dan.userId))

  // carla viewing alice
  await carla.login()
  var followers = await api.follows.listFollowers(alice.userId)
  t.is(followers.myFollowed.length, 2)
  t.truthy(followers.myFollowed.includes(bob.userId))
  t.truthy(followers.myFollowed.includes(carla.userId))
  t.is(followers.myCommunity.length, 0)
  t.is(followers.community.length, 2)
  t.truthy(followers.community.includes(bob.userId))
  t.truthy(followers.community.includes(dan.userId))

  // dan viewing alice
  await dan.login()
  var followers = await api.follows.listFollowers(alice.userId)
  t.is(followers.myFollowed.length, 3)
  t.truthy(followers.myFollowed.includes(bob.userId))
  t.truthy(followers.myFollowed.includes(carla.userId))
  t.truthy(followers.myFollowed.includes(dan.userId))
  t.is(followers.myCommunity.length, 2)
  t.truthy(followers.community.includes(bob.userId))
  t.truthy(followers.community.includes(dan.userId))
  t.is(followers.community.length, 2)
  t.truthy(followers.community.includes(bob.userId))
  t.truthy(followers.community.includes(dan.userId))

  // changes indexed
  await bob.unfollow(alice)
  await new Promise(r => setTimeout(r, 5e3))
  await api.debug.whenAllSynced()

  // alice viewing self
  await alice.login()
  var followers = await api.follows.listFollowers(alice.userId)
  t.is(followers.myFollowed.length, 1)
  t.truthy(followers.myFollowed.includes(carla.userId))
  t.is(followers.myCommunity.length, 1)
  t.truthy(followers.myCommunity.includes(dan.userId))
  t.is(followers.community.length, 1)
  t.truthy(followers.community.includes(dan.userId))

  // bob viewing alice
  await bob.login()
  var followers = await api.follows.listFollowers(alice.userId)
  t.is(followers.myFollowed.length, 1)
  t.truthy(followers.myFollowed.includes(carla.userId))
  t.is(followers.myCommunity.length, 1)
  t.truthy(followers.myCommunity.includes(dan.userId))
  t.is(followers.community.length, 1)
  t.truthy(followers.community.includes(dan.userId))

  // carla viewing alice
  await carla.login()
  var followers = await api.follows.listFollowers(alice.userId)
  t.is(followers.myFollowed.length, 1)
  t.truthy(followers.myFollowed.includes(carla.userId))
  t.is(followers.myCommunity.length, 0)
  t.is(followers.community.length, 1)
  t.truthy(followers.community.includes(dan.userId))

  // dan viewing alice
  await dan.login()
  var followers = await api.follows.listFollowers(alice.userId)
  t.is(followers.myFollowed.length, 2)
  t.truthy(followers.myFollowed.includes(carla.userId))
  t.truthy(followers.myFollowed.includes(dan.userId))
  t.is(followers.myCommunity.length, 1)
  t.truthy(followers.community.includes(dan.userId))
  t.is(followers.community.length, 1)
  t.truthy(followers.community.includes(dan.userId))
})