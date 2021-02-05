import test from 'ava'
import { createServer, TestFramework, randRange } from './_util.js'

let instances = []

test.after.always(async t => {
  for (let inst of instances) {
    await inst.close()
  }
})

test('cross-server user lookup', async t => {
  let inst1 = await createServer()
  instances.push(inst1)
  let inst2 = await createServer()
  instances.push(inst2)
  let inst3 = await createServer()
  instances.push(inst3)
  let sim = new TestFramework()
  const username = i => `user${i}`
  const user = i => sim.users[username(i)]

  // create users
  for (let i = 0; i < instances.length; i++) {
    await sim.createCitizen(instances[i], username(i))
  }

  // lookup users via all 3 instances
  for (let i = 0; i < instances.length; i++) {
    const inst = instances[i]
    for (let j = 0; j < instances.length; j++) {
      const res = await inst.api.users.lookupDbUrl(user(j).userId)
      t.deepEqual(res, {
        userId: user(j).userId,
        dbUrl: user(j).profile.dbUrl
      })
    }
  }
})
