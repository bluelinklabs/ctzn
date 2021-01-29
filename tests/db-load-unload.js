import test from 'ava'
import { createServer, TestFramework, randRange } from './_util.js'

let instances = []

test.after.always(async t => {
  for (let inst of instances) {
    await inst.close()
  }
})

test('external user databases are loaded and unloaded as needed', async t => {
  let inst1 = await createServer()
  instances.push(inst1)
  let inst2 = await createServer()
  instances.push(inst2)
  let sim = new TestFramework()
  const username = i => `user${i}`
  const user = i => sim.users[username(i)]

  // create users
  await sim.createUser(inst1, username(0))
  await sim.createUser(inst2, username(1))

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
  await t.throwsAsync(() => inst2.api.posts.listUserFeed(user(0).userId))
})
