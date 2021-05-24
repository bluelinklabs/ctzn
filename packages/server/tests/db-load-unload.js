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
  await t.throwsAsync(() => inst2.api.table.list(user(0).dbKey, 'ctzn.network/post'))

  // follow
  await user(1).follow(user(0))
  
  for (let inst of instances) {
    await inst.api.post('debug/update-external-dbs')
    await inst.api.get('debug/when-all-synced')
  }

  // test that inst2 now does have inst1's user loaded
  t.truthy((await inst2.api.view.get('ctzn.network/views/posts', {dbId: user(0).dbKey})).posts)

  // unfollow
  await user(1).unfollow(user(0))
  
  for (let inst of instances) {
    await inst.api.post('debug/update-external-dbs')
    await inst.api.get('debug/when-all-synced')
  }

  // test that inst2 again doesnt have inst1's user loaded
  await new Promise(r => setTimeout(r, 500))
  await t.throwsAsync(() => inst2.api.view.get('ctzn.network/views/posts', user(0).dbKey))
})
