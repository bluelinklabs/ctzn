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

  let follow1 = await api.table.get(bob.userId, 'ctzn.network/follow', alice.userId)
  t.is(follow1.value.subject.dbUrl, alice.profile.dbUrl)
  t.is(follow1.value.subject.userId, alice.userId)

  let follow2 = await api.table.get(bob.userId, 'ctzn.network/follow', carla.userId)
  t.is(follow2.value.subject.dbUrl, carla.profile.dbUrl)
  t.is(follow2.value.subject.userId, carla.userId)

  let follows1 = (await api.table.list(bob.userId, 'ctzn.network/follow')).entries
  sim.testFollows(t, follows1, [alice, carla])

  let follows2 = (await api.table.list(alice.userId, 'ctzn.network/follow')).entries
  sim.testFollows(t, follows2, [bob, carla])

  let follows3 = (await api.table.list(carla.userId, 'ctzn.network/follow')).entries
  sim.testFollows(t, follows3, [alice, bob])

  let follows4 = (await api.table.list(dan.userId, 'ctzn.network/follow')).entries
  sim.testFollows(t, follows4, [alice, bob, carla])

  let follows5 = (await api.table.list(bob.userId, 'ctzn.network/follow', {limit: 1})).entries
  t.is(follows5.length, 1)

  // alice viewing self
  await alice.login()
  var followers = await api.view.get('ctzn.network/followers-view', alice.userId)
  t.is(followers.followers.length, 3)
  t.truthy(followers.followers.includes(bob.userId))
  t.truthy(followers.followers.includes(carla.userId))
  t.truthy(followers.followers.includes(dan.userId))

  // bob viewing alice
  await bob.login()
  var followers = await api.view.get('ctzn.network/followers-view', alice.userId)
  t.is(followers.followers.length, 3)
  t.truthy(followers.followers.includes(bob.userId))
  t.truthy(followers.followers.includes(carla.userId))
  t.truthy(followers.followers.includes(dan.userId))

  // carla viewing alice
  await carla.login()
  var followers = await api.view.get('ctzn.network/followers-view', alice.userId)
  t.is(followers.followers.length, 3)
  t.truthy(followers.followers.includes(bob.userId))
  t.truthy(followers.followers.includes(carla.userId))
  t.truthy(followers.followers.includes(dan.userId))

  // dan viewing alice
  await dan.login()
  var followers = await api.view.get('ctzn.network/followers-view', alice.userId)
  t.is(followers.followers.length, 3)
  t.truthy(followers.followers.includes(bob.userId))
  t.truthy(followers.followers.includes(carla.userId))
  t.truthy(followers.followers.includes(dan.userId))

  // changes indexed
  await bob.unfollow(alice)

  // alice viewing self
  await alice.login()
  var followers = await api.view.get('ctzn.network/followers-view', alice.userId)
  t.is(followers.followers.length, 2)
  t.truthy(followers.followers.includes(carla.userId))
  t.truthy(followers.followers.includes(dan.userId))
})