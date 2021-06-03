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
  await sim.createUser(inst, 'dan')

  const {alice, bob, carla} = sim.users
  await bob.login()
  await bob.follow(alice)
  await bob.follow(carla)
})

test.after.always(async t => {
	await close()
})

test('basic CRUD', async t => {
  const {alice, bob, carla, dan} = sim.users

  // bob, alice, and carla all follow each other
  await bob.follow(alice)
  await bob.follow(carla)
  await alice.follow(bob)
  await alice.follow(carla)
  await carla.follow(alice)
  await carla.follow(bob)

  // dan follows everybody and gets no follow backs
  await dan.follow(alice)
  await dan.follow(bob)
  await dan.follow(carla)

  let follow1 = await api.table.get(bob.dbKey, 'ctzn.network/follow', alice.dbKey)
  t.is(follow1.value.subject.dbKey, alice.dbKey)

  let follow2 = await api.table.get(bob.dbKey, 'ctzn.network/follow', carla.dbKey)
  t.is(follow2.value.subject.dbKey, carla.dbKey)

  let follows1 = (await api.table.list(bob.dbKey, 'ctzn.network/follow')).entries
  sim.testFollows(t, follows1, [alice, carla])

  let follows2 = (await api.table.list(alice.dbKey, 'ctzn.network/follow')).entries
  sim.testFollows(t, follows2, [bob, carla])

  let follows3 = (await api.table.list(carla.dbKey, 'ctzn.network/follow')).entries
  sim.testFollows(t, follows3, [alice, bob])

  let follows4 = (await api.table.list(dan.dbKey, 'ctzn.network/follow')).entries
  sim.testFollows(t, follows4, [alice, bob, carla])

  let follows5 = (await api.table.list(bob.dbKey, 'ctzn.network/follow', {limit: 1})).entries
  t.is(follows5.length, 1)

  // alice viewing self
  await alice.login()
  var followers = await api.view.get('ctzn.network/views/followers', {dbId: alice.dbKey})
  t.is(followers.followers.length, 3)
  t.truthy(followers.followers.includes(bob.dbKey))
  t.truthy(followers.followers.includes(carla.dbKey))
  t.truthy(followers.followers.includes(dan.dbKey))

  // bob viewing alice
  await bob.login()
  var followers = await api.view.get('ctzn.network/views/followers', {dbId: alice.dbKey})
  t.is(followers.followers.length, 3)
  t.truthy(followers.followers.includes(bob.dbKey))
  t.truthy(followers.followers.includes(carla.dbKey))
  t.truthy(followers.followers.includes(dan.dbKey))

  // carla viewing alice
  await carla.login()
  var followers = await api.view.get('ctzn.network/views/followers', {dbId: alice.dbKey})
  t.is(followers.followers.length, 3)
  t.truthy(followers.followers.includes(bob.dbKey))
  t.truthy(followers.followers.includes(carla.dbKey))
  t.truthy(followers.followers.includes(dan.dbKey))

  // dan viewing alice
  await dan.login()
  var followers = await api.view.get('ctzn.network/views/followers', {dbId: alice.dbKey})
  t.is(followers.followers.length, 3)
  t.truthy(followers.followers.includes(bob.dbKey))
  t.truthy(followers.followers.includes(carla.dbKey))
  t.truthy(followers.followers.includes(dan.dbKey))

  // changes indexed
  await bob.unfollow(alice)

  // alice viewing self
  await alice.login()
  var followers = await api.view.get('ctzn.network/views/followers', {dbId: alice.dbKey})
  t.is(followers.followers.length, 2)
  t.truthy(followers.followers.includes(carla.dbKey))
  t.truthy(followers.followers.includes(dan.dbKey))
})