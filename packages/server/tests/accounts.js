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
})

test.after.always(async t => {
	await close()
})

test('change-password flow', async t => {
  await api.method('ctzn.network/methods/request-password-change-code', {username: 'alice'})
  const email = await api.get('debug/last-email')
  t.truthy(email)
  t.is(email.to[0], 'alice@email.com')
  t.is(email.subject, 'Password change code for dev1.localhost')

  const code = /([\d]{3}\-[\d]{4}\-[\d]{3})/.exec(email.contents.find(c => typeof c === 'string'))[0]
  t.truthy(code)
  
  await api.method('ctzn.network/methods/change-password', {username: 'alice', code, newPassword: 'new-password'})
  await api.method('ctzn.network/methods/login', {username: 'alice', password: 'new-password'})
})