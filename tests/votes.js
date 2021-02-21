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

  const {alice, bob, carla, folks} = sim.users
  await alice.login()
  await api.communities.join(folks.userId)
  await bob.login()
  await api.communities.join(folks.userId)
  await bob.follow(alice)
  await bob.follow(carla)

  await bob.createPost({text: '1'})
  await bob.createPost({text: '2'})
  await bob.createPost({text: '3', community: {userId: folks.userId, dbUrl: folks.profile.dbUrl}})
  await alice.createPost({text: '4'})
})

test.after.always(async t => {
	await close()
})

test('self indexes', async t => {
  const {alice, bob, carla} = sim.users

  await bob.vote({subject: bob.posts[0], vote: 1})
  await bob.vote({subject: bob.posts[1], vote: -1})
  await bob.vote({subject: alice.posts[0], vote: 1})
  await alice.vote({subject: bob.posts[0], vote: 1})
  await alice.vote({subject: bob.posts[1], vote: 1})
  await alice.vote({subject: alice.posts[0], vote: 1})
  await carla.vote({subject: bob.posts[0], vote: -1})
  await carla.vote({subject: bob.posts[1], vote: -1})
  await carla.vote({subject: alice.posts[0], vote: -1})

  await new Promise(r => setTimeout(r, 5e3))
  await api.debug.whenAllSynced()

  // see all votes by users followed by authed
  await bob.login()
  let votes = await api.votes.getVotesForSubject(bob.posts[0].url)
  t.is(votes.subject.dbUrl, bob.posts[0].url)
  t.is(votes.upvoterIds.length, 2)
  t.is(votes.downvoterIds.length, 1)

  // see all votes by users followed by authed
  await bob.login()
  votes = await api.votes.getVotesForSubject(bob.posts[1].url)
  t.is(votes.subject.dbUrl, bob.posts[1].url)
  t.is(votes.upvoterIds.length, 1)
  t.is(votes.downvoterIds.length, 2)

  // see all votes by users followed by author
  await carla.login()
  votes = await api.votes.getVotesForSubject(bob.posts[0].url)
  t.is(votes.subject.dbUrl, bob.posts[0].url)
  t.is(votes.upvoterIds.length, 2)
  t.is(votes.downvoterIds.length, 1)

  // dont see bob's vote because he's not followed by authed or author
  await carla.login()
  votes = await api.votes.getVotesForSubject(alice.posts[0].url)
  t.is(votes.subject.dbUrl, alice.posts[0].url)
  t.is(votes.upvoterIds.length, 1)
  t.is(votes.downvoterIds.length, 1)

  // the rest are making sure changes are indexed

  await bob.login()
  await bob.vote({subject: bob.posts[0], vote: -1})
  votes = await api.votes.getVotesForSubject(bob.posts[0].url)
  t.is(votes.subject.dbUrl, bob.posts[0].url)
  t.is(votes.upvoterIds.length, 1)
  t.is(votes.downvoterIds.length, 2)

  await bob.vote({subject: bob.posts[0], vote: 0})
  votes = await api.votes.getVotesForSubject(bob.posts[0].url)
  t.is(votes.subject.dbUrl, bob.posts[0].url)
  t.is(votes.upvoterIds.length, 1)
  t.is(votes.downvoterIds.length, 1)

  await alice.vote({subject: bob.posts[0], vote: 0})
  votes = await api.votes.getVotesForSubject(bob.posts[0].url)
  t.is(votes.subject.dbUrl, bob.posts[0].url)
  t.is(votes.upvoterIds.length, 0)
  t.is(votes.downvoterIds.length, 1)

  await carla.vote({subject: bob.posts[0], vote: 0})
  votes = await api.votes.getVotesForSubject(bob.posts[0].url)
  t.is(votes.subject.dbUrl, bob.posts[0].url)
  t.is(votes.upvoterIds.length, 0)
  t.is(votes.downvoterIds.length, 0)
})

test('community indexes', async t => {
  const {alice, bob, carla} = sim.users

  await alice.vote({subject: bob.posts[2], vote: 1})
  await bob.vote({subject: bob.posts[2], vote: 1})
  await carla.vote({subject: bob.posts[2], vote: -1})

  await new Promise(r => setTimeout(r, 5e3))
  await api.debug.whenAllSynced()

  // see only community member votes no matter who is authed
  await bob.login()
  let votes = await api.votes.getVotesForSubject(bob.posts[2].url)
  t.is(votes.subject.dbUrl, bob.posts[2].url)
  t.is(votes.upvoterIds.length, 2)
  t.is(votes.downvoterIds.length, 0)

  // see only community member votes no matter who is authed
  await carla.login()
  votes = await api.votes.getVotesForSubject(bob.posts[2].url)
  t.is(votes.subject.dbUrl, bob.posts[2].url)
  t.is(votes.upvoterIds.length, 2)
  t.is(votes.downvoterIds.length, 0)

  // the rest are making sure changes are indexed

  await bob.login()
  await bob.vote({subject: bob.posts[2], vote: 0})
  await new Promise(r => setTimeout(r, 5e3))
  await api.debug.whenAllSynced()
  votes = await api.votes.getVotesForSubject(bob.posts[2].url)
  t.is(votes.subject.dbUrl, bob.posts[2].url)
  t.is(votes.upvoterIds.length, 1)
  t.is(votes.downvoterIds.length, 0)
})