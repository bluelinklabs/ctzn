import test from 'ava'
import { createServer } from './_util.js'

let close
let api
let posts = []
let comments = []

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
  await inst.db.createUser({
    username: 'alicia',
    email: 'alicia@allison.com',
    profile: {
      displayName: 'Alicia Allison'
    }
  })
  await api.accounts.login({username: 'bobo', password: 'password'})

  posts.push(await api.posts.create({text: '1'}))
  posts.push(await api.posts.create({text: '2'}))
})

test.after.always(async t => {
	await close()
})

test('basic CRUD', async t => {

  console.log(posts[0])
  await api.accounts.login({username: 'bobo', password: 'password'})
  await api.votes.put({subjectUrl: posts[0].url, vote: 1})
  await api.votes.put({subjectUrl: posts[1].url, vote: -1})
  await api.accounts.login({username: 'alicia', password: 'password'})
  await api.votes.put({subjectUrl: posts[0].url, vote: 1})
  await api.votes.put({subjectUrl: posts[1].url, vote: 1})

  let votes1 = await api.votes.getVotesForSubject(posts[0].url)
  t.is(votes1.subjectUrl, posts[0].url)
  t.is(votes1.upvoteUrls.length, 2)
  t.is(votes1.downvoteUrls.length, 0)

  let votes2 = await api.votes.getVotesForSubject(posts[1].url)
  t.is(votes2.subjectUrl, posts[1].url)
  t.is(votes2.upvoteUrls.length, 1)
  t.is(votes2.downvoteUrls.length, 1)

  await api.accounts.login({username: 'bobo', password: 'password'})
  await api.votes.put({subjectUrl: posts[0].url, vote: -1})

  let votes3 = await api.votes.getVotesForSubject(posts[0].url)
  t.is(votes3.subjectUrl, posts[0].url)
  t.is(votes3.upvoteUrls.length, 1)
  t.is(votes3.downvoteUrls.length, 1)

  await api.accounts.login({username: 'bobo', password: 'password'})
  await api.votes.del(posts[0].url)

  let votes4 = await api.votes.getVotesForSubject(posts[0].url)
  t.is(votes4.subjectUrl, posts[0].url)
  t.is(votes4.upvoteUrls.length, 1)
  t.is(votes4.downvoteUrls.length, 0)

  await api.accounts.login({username: 'alicia', password: 'password'})
  await api.votes.del(posts[0].url)

  let votes5 = await api.votes.getVotesForSubject(posts[0].url)
  t.is(votes5.subjectUrl, posts[0].url)
  t.is(votes5.upvoteUrls.length, 0)
  t.is(votes5.downvoteUrls.length, 0)
})