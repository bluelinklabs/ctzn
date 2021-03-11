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
  await sim.createCommunity(inst, 'ppl')

  const {alice, bob, carla, folks, ppl} = sim.users
  await alice.login()
  await api.communities.join(folks.userId)
  await api.communities.join(ppl.userId)
  await bob.login()
  await api.communities.join(folks.userId)
  await api.communities.join(ppl.userId)
  await carla.login()
  await api.communities.join(folks.userId)
  await api.communities.join(ppl.userId)
})

test.after.always(async t => {
	await close()
})

test('ping method', async t => {
  const {alice, folks} = sim.users

  await alice.login()
  const res1 = await api.dbmethod.call({
    database: folks.userId,
    method: 'ctzn.network/ping-method',
    args: {message: 'Ping?'}
  })
  t.is(res1.result.code, 'success')
  t.is(res1.result.details.message, 'Ping?')

  const res2 = await api.dbmethod.getResult({call: res1.key})
  t.is(res2.value.code, 'success')
  t.is(res2.value.details.message, 'Ping?')
})
