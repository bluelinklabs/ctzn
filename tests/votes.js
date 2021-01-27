import test from 'ava'
import { createServer, TestFramework } from './_util.js'

let close
let api
let sim = new TestFramework()

test.before(async () => {
  let inst = await createServer()
  close = inst.close
  api = inst.api

  await sim.createUser(inst, 'alice')
  await sim.createUser(inst, 'bob')

  await sim.users.bob.createPost({text: '1'})
  await sim.users.bob.createPost({text: '2'})
})

test.after.always(async t => {
	await close()
})

test('basic CRUD', async t => {
  const {alice, bob} = sim.users

  await bob.vote({subjectUrl: bob.posts[0].url, vote: 1})
  await bob.vote({subjectUrl: bob.posts[1].url, vote: -1})
  await alice.vote({subjectUrl: bob.posts[0].url, vote: 1})
  await alice.vote({subjectUrl: bob.posts[1].url, vote: 1})

  let votes1 = await api.votes.getVotesForSubject(bob.posts[0].url)
  t.is(votes1.subjectUrl, bob.posts[0].url)
  t.is(votes1.upvoterIds.length, 2)
  t.is(votes1.downvoterIds.length, 0)

  let votes2 = await api.votes.getVotesForSubject(bob.posts[1].url)
  t.is(votes2.subjectUrl, bob.posts[1].url)
  t.is(votes2.upvoterIds.length, 1)
  t.is(votes2.downvoterIds.length, 1)

  await bob.vote({subjectUrl: bob.posts[0].url, vote: -1})

  let votes3 = await api.votes.getVotesForSubject(bob.posts[0].url)
  t.is(votes3.subjectUrl, bob.posts[0].url)
  t.is(votes3.upvoterIds.length, 1)
  t.is(votes3.downvoterIds.length, 1)

  await bob.vote({subjectUrl: bob.posts[0].url, vote: 0})

  let votes4 = await api.votes.getVotesForSubject(bob.posts[0].url)
  t.is(votes4.subjectUrl, bob.posts[0].url)
  t.is(votes4.upvoterIds.length, 1)
  t.is(votes4.downvoterIds.length, 0)

  await alice.vote({subjectUrl: bob.posts[0].url, vote: 0})

  let votes5 = await api.votes.getVotesForSubject(bob.posts[0].url)
  t.is(votes5.subjectUrl, bob.posts[0].url)
  t.is(votes5.upvoterIds.length, 0)
  t.is(votes5.downvoterIds.length, 0)
})