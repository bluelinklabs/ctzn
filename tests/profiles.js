import test from 'ava'
import { createServer } from './_util.js'

let close
let api

test.before(async () => {
  let inst = await createServer()
  close = inst.close
  api = inst.api

  await inst.db.createUser({
    username: 'bobo',
    email: 'bobo@roberts.com',
    profile: {
      displayName: 'Bobo Roberts'
    }
  })
  await api.accounts.login({username: 'bobo', password: 'password'})
})

test.after.always(async t => {
	await close()
})

test('basic CRUD', async t => {
  await api.profiles.put({
    displayName: 'Bobo Roberts',
    description: 'Some person',
    homepageUrl: 'http://example.com'
  })

  let profile1 = await api.profiles.get('bobo@localhost')
  t.is(profile1.userId, 'bobo@localhost')
  t.truthy(/^hyper:\/\/([0-9a-f]{64})\/$/.test(profile1.dbUrl))
  t.is(profile1.value.displayName, 'Bobo Roberts')
  t.is(profile1.value.description, 'Some person')
  t.is(profile1.value.homepageUrl, 'http://example.com')

  await t.throwsAsync(() => api.profiles.put({}))
  await t.throwsAsync(() => api.profiles.put({description: 'hi'}))
})