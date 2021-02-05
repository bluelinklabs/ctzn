import test from 'ava'
import { createServer, TestFramework, randRange } from './_util.js'

let instances = []

test.after.always(async t => {
  for (let inst of instances) {
    await inst.close()
  }
})

test('external citizen databases are loaded and unloaded by follows', async t => {
  let inst1 = await createServer()
  instances.push(inst1)
  let inst2 = await createServer()
  instances.push(inst2)
  let sim = new TestFramework()
  const username = i => `user${i}`
  const user = i => sim.users[username(i)]

  // create users
  await sim.createCitizen(inst1, username(0))
  await sim.createCitizen(inst2, username(1))

  // test that inst2 doesnt have inst1's user loaded
  await t.throwsAsync(() => inst2.api.posts.listUserFeed(user(0).userId))

  // follow
  await user(1).follow(user(0))
  
  for (let inst of instances) {
    await inst.api.debug.whenAllSynced()
  }

  // test that inst2 now does have inst1's user loaded
  t.truthy(await inst2.api.posts.listUserFeed(user(0).userId))

  // unfollow
  await user(1).unfollow(user(0))

  // test that inst2 again doesnt have inst1's user loaded
  await new Promise(r => setTimeout(r, 500))
  await t.throwsAsync(() => inst2.api.posts.listUserFeed(user(0).userId))
})

test.skip('external community databases are loaded and unloaded by community joins', async t => {
  // TODO run this test when remote community joins are supported
})

test.skip('external citizen databases are loaded and unloaded by community joins', async t => {
  // TODO run this test when remote community joins are supported
})