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
  await bob.login()
  await bob.follow(alice)
  await bob.follow(carla)

  await bob.createPost({text: '1'})
  await bob.createPost({text: '2'})
  await alice.createPost({text: '4'})
})

test.after.always(async t => {
	await close()
})

test('self indexes', async t => {
  const {alice, bob, carla} = sim.users

  await bob.tag({subject: bob.posts[0], topic: 'ctzn'})
  await bob.tag({subject: bob.posts[1], topic: 'javascript'})
  await bob.tag({subject: alice.posts[0], topic: 'ctzn'})
  await alice.tag({subject: bob.posts[0], topic: 'ctzn'})
  await alice.tag({subject: bob.posts[1], topic: 'ctzn'})
  await alice.tag({subject: alice.posts[0], topic: 'ctzn'})
  await carla.tag({subject: bob.posts[0], topic: 'javascript'})
  await carla.tag({subject: bob.posts[1], topic: 'javascript'})
  await carla.tag({subject: alice.posts[0], topic: 'javascript'})

  // source=follows
  await bob.login()
  let res = await api.view.get('ctzn.network/topic-records-view', 'ctzn')
  t.is(res.topic, 'ctzn')
  t.is(res.records['ctzn.network/post'].length, 3)
  for (let i = 0; i < 3; i++) {
    t.is(typeof res.records['ctzn.network/post'][i].seq, 'number')
    t.is(typeof res.records['ctzn.network/post'][i].key, 'string')
    t.is(typeof res.records['ctzn.network/post'][i].url, 'string')
    t.is(typeof res.records['ctzn.network/post'][i].author.userId, 'string')
    t.is(typeof res.records['ctzn.network/post'][i].author.displayName, 'string')
    t.is(typeof res.records['ctzn.network/post'][i].value.text, 'string')
    t.is(typeof res.records['ctzn.network/post'][i].value.createdAt, 'string')
    t.truthy(res.records['ctzn.network/post'][i].taggedBy.length > 0)
  }
  res.records['ctzn.network/post'][0].taggedBy.sort()
  t.is(res.records['ctzn.network/post'][0].taggedBy.length, 2)
  t.is(res.records['ctzn.network/post'][0].taggedBy[0], 'alice@dev1.localhost')
  t.is(res.records['ctzn.network/post'][0].taggedBy[1], 'bob@dev1.localhost')
  res.records['ctzn.network/post'][1].taggedBy.sort()
  t.is(res.records['ctzn.network/post'][1].taggedBy.length, 2)
  t.is(res.records['ctzn.network/post'][1].taggedBy[0], 'alice@dev1.localhost')
  t.is(res.records['ctzn.network/post'][1].taggedBy[1], 'bob@dev1.localhost')
  t.is(res.records['ctzn.network/post'][2].taggedBy.length, 1)
  t.is(res.records['ctzn.network/post'][2].taggedBy[0], 'alice@dev1.localhost')

  // source=follows
  await alice.login()
  let res2 = await api.view.get('ctzn.network/topic-records-view', 'ctzn')
  t.is(res2.topic, 'ctzn')
  t.is(res2.records['ctzn.network/post'].length, 3)
  for (let i = 0; i < 3; i++) {
    t.is(typeof res2.records['ctzn.network/post'][i].seq, 'number')
    t.is(typeof res2.records['ctzn.network/post'][i].key, 'string')
    t.is(typeof res2.records['ctzn.network/post'][i].url, 'string')
    t.is(typeof res2.records['ctzn.network/post'][i].author.userId, 'string')
    t.is(typeof res2.records['ctzn.network/post'][i].author.displayName, 'string')
    t.is(typeof res2.records['ctzn.network/post'][i].value.text, 'string')
    t.is(typeof res2.records['ctzn.network/post'][i].value.createdAt, 'string')
    t.truthy(res2.records['ctzn.network/post'][i].taggedBy.length > 0)
  }
  t.is(res2.records['ctzn.network/post'][0].taggedBy.length, 1)
  t.is(res2.records['ctzn.network/post'][0].taggedBy[0], 'alice@dev1.localhost')
  t.is(res2.records['ctzn.network/post'][1].taggedBy.length, 1)
  t.is(res2.records['ctzn.network/post'][1].taggedBy[0], 'alice@dev1.localhost')
  t.is(res2.records['ctzn.network/post'][2].taggedBy.length, 1)
  t.is(res2.records['ctzn.network/post'][2].taggedBy[0], 'alice@dev1.localhost')

  // source=follows
  await carla.login()
  let res3 = await api.view.get('ctzn.network/topic-records-view', 'ctzn')
  t.is(res3.topic, 'ctzn')
  t.falsy(res3.records['ctzn.network/post'])

  // source=follows
  await bob.login()
  let res4 = await api.view.get('ctzn.network/topic-records-view', 'javascript')
  t.is(res4.topic, 'javascript')
  t.is(res4.records['ctzn.network/post'].length, 3)
  for (let i = 0; i < 3; i++) {
    t.is(typeof res4.records['ctzn.network/post'][i].seq, 'number')
    t.is(typeof res4.records['ctzn.network/post'][i].key, 'string')
    t.is(typeof res4.records['ctzn.network/post'][i].url, 'string')
    t.is(typeof res4.records['ctzn.network/post'][i].author.userId, 'string')
    t.is(typeof res4.records['ctzn.network/post'][i].author.displayName, 'string')
    t.is(typeof res4.records['ctzn.network/post'][i].value.text, 'string')
    t.is(typeof res4.records['ctzn.network/post'][i].value.createdAt, 'string')
    t.truthy(res4.records['ctzn.network/post'][i].taggedBy.length > 0)
  }
  res4.records['ctzn.network/post'].sort((a, b) => a.taggedBy.length - b.taggedBy.length)
  t.is(res4.records['ctzn.network/post'][0].taggedBy.length, 1)
  t.is(res4.records['ctzn.network/post'][0].taggedBy[0], 'carla@dev1.localhost')
  t.is(res4.records['ctzn.network/post'][1].taggedBy.length, 1)
  t.is(res4.records['ctzn.network/post'][1].taggedBy[0], 'carla@dev1.localhost')
  res4.records['ctzn.network/post'][2].taggedBy.sort()
  t.is(res4.records['ctzn.network/post'][2].taggedBy.length, 2)
  t.is(res4.records['ctzn.network/post'][2].taggedBy[0], 'bob@dev1.localhost')
  t.is(res4.records['ctzn.network/post'][2].taggedBy[1], 'carla@dev1.localhost')

  // source=follows
  await alice.login()
  let res5 = await api.view.get('ctzn.network/topic-records-view', 'javascript')
  t.is(res5.topic, 'javascript')
  t.falsy(res5.records['ctzn.network/post'])

  // source=follows
  await carla.login()
  let res6 = await api.view.get('ctzn.network/topic-records-view', 'javascript')
  t.is(res6.topic, 'javascript')
  t.is(res6.records['ctzn.network/post'].length, 3)
  for (let i = 0; i < 3; i++) {
    t.is(typeof res6.records['ctzn.network/post'][i].seq, 'number')
    t.is(typeof res6.records['ctzn.network/post'][i].key, 'string')
    t.is(typeof res6.records['ctzn.network/post'][i].url, 'string')
    t.is(typeof res6.records['ctzn.network/post'][i].author.userId, 'string')
    t.is(typeof res6.records['ctzn.network/post'][i].author.displayName, 'string')
    t.is(typeof res6.records['ctzn.network/post'][i].value.text, 'string')
    t.is(typeof res6.records['ctzn.network/post'][i].value.createdAt, 'string')
    t.truthy(res6.records['ctzn.network/post'][i].taggedBy.length > 0)
  }
  t.is(res6.records['ctzn.network/post'][0].taggedBy.length, 1)
  t.is(res6.records['ctzn.network/post'][0].taggedBy[0], 'carla@dev1.localhost')
  t.is(res6.records['ctzn.network/post'][1].taggedBy.length, 1)
  t.is(res6.records['ctzn.network/post'][1].taggedBy[0], 'carla@dev1.localhost')
  t.is(res6.records['ctzn.network/post'][2].taggedBy.length, 1)
  t.is(res6.records['ctzn.network/post'][2].taggedBy[0], 'carla@dev1.localhost')

  // source=carla
  await alice.login()
  let res7 = await api.view.get('ctzn.network/topic-records-view', 'javascript', 'carla@dev1.localhost')
  t.is(res7.topic, 'javascript')
  t.is(res7.records['ctzn.network/post'].length, 3)
  for (let i = 0; i < 3; i++) {
    t.is(typeof res7.records['ctzn.network/post'][i].seq, 'number')
    t.is(typeof res7.records['ctzn.network/post'][i].key, 'string')
    t.is(typeof res7.records['ctzn.network/post'][i].url, 'string')
    t.is(typeof res7.records['ctzn.network/post'][i].author.userId, 'string')
    t.is(typeof res7.records['ctzn.network/post'][i].author.displayName, 'string')
    t.is(typeof res7.records['ctzn.network/post'][i].value.text, 'string')
    t.is(typeof res7.records['ctzn.network/post'][i].value.createdAt, 'string')
    t.truthy(res7.records['ctzn.network/post'][i].taggedBy.length > 0)
  }
  t.is(res7.records['ctzn.network/post'][0].taggedBy.length, 1)
  t.is(res7.records['ctzn.network/post'][0].taggedBy[0], 'carla@dev1.localhost')
  t.is(res7.records['ctzn.network/post'][1].taggedBy.length, 1)
  t.is(res7.records['ctzn.network/post'][1].taggedBy[0], 'carla@dev1.localhost')
  t.is(res7.records['ctzn.network/post'][2].taggedBy.length, 1)
  t.is(res7.records['ctzn.network/post'][2].taggedBy[0], 'carla@dev1.localhost')
})
