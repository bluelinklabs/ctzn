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
})

test.after.always(async t => {
	await close()
})

test('basic CRUD', async t => {
  const {alice, bob, carla} = sim.users
  await bob.follow(alice)
  await bob.follow(carla)
  await alice.follow(bob)
  await alice.follow(carla)
  await carla.follow(alice)
  await carla.follow(bob)

  await alice.testSocialGraph(t, sim)
  await bob.testSocialGraph(t, sim)
  await carla.testSocialGraph(t, sim)

  let follow1 = await api.follows.get(sim.users.bob.userId, alice.userId)
  t.is(follow1.value.subject.dbUrl, alice.profile.dbUrl)
  t.is(follow1.value.subject.userId, alice.userId)

  let follow2 = await api.follows.get(sim.users.bob.userId, carla.userId)
  t.is(follow2.value.subject.dbUrl, carla.profile.dbUrl)
  t.is(follow2.value.subject.userId, carla.userId)

  let follows1 = await api.follows.listFollows(sim.users.bob.userId)
  sim.testFollows(t, follows1, [alice, carla])

  let follows2 = await api.follows.listFollows(sim.users.alice.userId)
  sim.testFollows(t, follows2, [bob, carla])

  let follows3 = await api.follows.listFollows(sim.users.carla.userId)
  sim.testFollows(t, follows3, [alice, bob])

  let follows4 = await api.follows.listFollows(sim.users.bob.userId, {limit: 1})
  t.is(follows4.length, 1)

  let followers1 = await api.follows.listFollowers(sim.users.bob.userId)
  sim.testFollowers(t, followers1, [alice, carla])

  let followers2 = await api.follows.listFollowers(sim.users.alice.userId)
  sim.testFollowers(t, followers2, [bob, carla])

  let followers3 = await api.follows.listFollowers(sim.users.carla.userId)
  sim.testFollowers(t, followers3, [alice, bob])

  await bob.unfollow(alice)

  await alice.testSocialGraph(t, sim)
  await bob.testSocialGraph(t, sim)
  await carla.testSocialGraph(t, sim)

  let follows5 = await api.follows.listFollows(sim.users.bob.userId)
  sim.testFollows(t, follows5, [carla])

  let followers4 = await api.follows.listFollowers(sim.users.alice.userId)
  sim.testFollowers(t, followers4, [carla])
})