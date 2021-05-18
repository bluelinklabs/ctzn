import test from 'ava'
import { createServer, TestFramework } from './_util.js'

let instances = []

test.after.always(async t => {
  for (let inst of instances) {
    await inst.close()
  }
})

test('server table queries', async t => {
  let sim = new TestFramework()
  let inst = await createServer()
  let api = inst.api
  instances.push(inst)

  await sim.createCitizen(inst, 'alice')
  await sim.createCitizen(inst, 'bob')
  await sim.createCitizen(inst, 'carla')
  await sim.users.alice.login()
  await sim.createCommunity(inst, 'folks')
  await sim.createCommunity(inst, 'ppl')
  const {alice, bob, carla, folks, ppl} = sim.users
  await bob.login()
  await api.communities.join(folks.userId)
  await api.communities.join(ppl.userId)
  await carla.login()
  await api.communities.join(folks.userId)

  await alice.createPost({text: '1', community: {userId: folks.userId, dbUrl: folks.profile.dbUrl}})
  await bob.createPost({text: '2', community: {userId: folks.userId, dbUrl: folks.profile.dbUrl}})
  await carla.createPost({text: '3', community: {userId: folks.userId, dbUrl: folks.profile.dbUrl}})
  await alice.createPost({text: '4', community: {userId: ppl.userId, dbUrl: ppl.profile.dbUrl}})
  await bob.createPost({text: '5', community: {userId: ppl.userId, dbUrl: ppl.profile.dbUrl}})

  const usersEntries = (await api.table.list(inst.serverUserId, 'ctzn.network/user'))?.entries
  t.is(usersEntries.length, 5)
  t.truthy(usersEntries.find(entry => entry.key === 'alice'))
  t.truthy(usersEntries.find(entry => entry.key === 'bob'))
  t.truthy(usersEntries.find(entry => entry.key === 'carla'))
  t.truthy(usersEntries.find(entry => entry.key === 'folks'))
  t.truthy(usersEntries.find(entry => entry.key === 'ppl'))

  const feedIdxEntries = (await api.table.list(inst.serverUserId, 'ctzn.network/feed-idx'))?.entries
  t.is(feedIdxEntries.length, 5)
})
