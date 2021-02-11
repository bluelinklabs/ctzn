import test from 'ava'
import { createServer } from './_util.js'
import fetch from 'node-fetch'

let inst

test.before(async () => {
  inst = await createServer()

  await inst.api.debug.createUser({
    type: 'citizen',
    username: 'bobo',
    email: 'bobo@roberts.com',
    password: 'password',
    profile: {
      displayName: 'Bobo Roberts'
    }
  })
  await inst.api.accounts.login({username: 'bobo', password: 'password'})
})

test.after.always(async t => {
	await inst.close()
})

test('basic CRUD', async t => {
  await inst.api.profiles.put({
    displayName: 'Bobo Roberts',
    description: 'Some citizen',
    homepageUrl: 'http://example.com'
  })

  let profile1 = await inst.api.profiles.get(`bobo@${inst.domain}`)
  t.is(profile1.userId, `bobo@${inst.domain}`)
  t.truthy(/^hyper:\/\/([0-9a-f]{64})\/$/.test(profile1.dbUrl))
  t.is(profile1.value.displayName, 'Bobo Roberts')
  t.is(profile1.value.description, 'Some citizen')
  t.is(profile1.value.homepageUrl, 'http://example.com')

  await t.throwsAsync(() => inst.api.profiles.put({}))
  await t.throwsAsync(() => inst.api.profiles.put({description: 'hi'}))
})

test('webfinger', async t => {
  const profile = await inst.api.profiles.get(`bobo@${inst.domain}`)
  const jrd = await (await fetch(`${inst.url}.well-known/webfinger?resource=acct:bobo@${inst.domain}`)).json()
  t.deepEqual(jrd, {
    subject: `acct:bobo@${inst.domain}`,
    links: [{rel: 'self', href: profile.dbUrl}]
  })
})