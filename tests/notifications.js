import test from 'ava'
import { createServer } from './_util.js'

let close
let api
let profiles = {}
let posts
let comments

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
  await inst.db.createUser({
    username: 'carla',
    email: 'carla@carlson.com',
    profile: {
      displayName: 'Carla Carlson'
    }
  })

  profiles.alicia = await api.profiles.get('alicia@localhost')
  profiles.bobo = await api.profiles.get('bobo@localhost')
  profiles.carla = await api.profiles.get('carla@localhost')

  await api.accounts.login({username: 'bobo', password: 'password'})
  await api.follows.follow(profiles.alicia.userId)
  await api.follows.follow(profiles.carla.userId)
  await api.accounts.login({username: 'alicia', password: 'password'})
  await api.follows.follow(profiles.bobo.dbUrl)
  await api.follows.follow(profiles.carla.dbUrl)
  await api.accounts.login({username: 'carla', password: 'password'})
  await api.follows.follow(profiles.bobo.userId)
  await api.follows.follow(profiles.alicia.dbUrl)

  posts = []
  await api.accounts.login({username: 'bobo', password: 'password'})
  posts.push(await api.posts.create({text: '1'}))
  posts.push(await api.posts.create({text: '2'}))
  await api.accounts.login({username: 'carla', password: 'password'})
  posts.push(await api.posts.create({text: '3'}))

  comments = []
  await api.accounts.login({username: 'alicia', password: 'password'})
  comments.push(await api.comments.create({
    subjectUrl: posts[0].url,
    text: 'Comment 1'
  }))
  await api.accounts.login({username: 'carla', password: 'password'})
  comments.push(await api.comments.create({
    subjectUrl: posts[0].url,
    parentCommentUrl: comments[0].url,
    text: 'Reply 1'
  }))
  await api.accounts.login({username: 'bobo', password: 'password'})
  comments.push(await api.comments.create({
    subjectUrl: posts[0].url,
    parentCommentUrl: comments[0].url,
    text: 'Reply 2'
  }))
  await api.accounts.login({username: 'carla', password: 'password'})
  comments.push(await api.comments.create({
    subjectUrl: posts[0].url,
    text: 'Comment 2'
  }))

  await api.accounts.login({username: 'bobo', password: 'password'})
  await api.votes.put({subjectUrl: posts[0].url, vote: 1})
  await api.votes.put({subjectUrl: posts[1].url, vote: -1})
  await api.accounts.login({username: 'alicia', password: 'password'})
  for (let post of posts) {
    await api.votes.put({subjectUrl: post.url, vote: 1})
  }
  for (let comment of comments) {
    await api.votes.put({subjectUrl: comment.url, vote: 1})
  }
  await api.accounts.login({username: 'carla', password: 'password'})
  for (let post of posts) {
    await api.votes.put({subjectUrl: post.url, vote: -1})
  }
  for (let comment of comments) {
    await api.votes.put({subjectUrl: comment.url, vote: -1})
  }
})

test.after.always(async t => {
	await close()
})

test('basic CRUD', async t => {
  await api.accounts.login({username: 'bobo', password: 'password'})
  let notifications1 = await api.notifications.list({reverse: true})
  t.is(notifications1.length, 11)
  t.is(notifications1[0].item.subjectUrl, comments[2].url)
  t.is(notifications1[0].item.vote, -1)
  t.is(notifications1[0].author.userId, 'carla@localhost')
  t.is(notifications1[1].item.subjectUrl, posts[1].url)
  t.is(notifications1[1].item.vote, -1)
  t.is(notifications1[1].author.userId, 'carla@localhost')
  t.is(notifications1[2].item.subjectUrl, posts[0].url)
  t.is(notifications1[2].item.vote, -1)
  t.is(notifications1[2].author.userId, 'carla@localhost')
  t.is(notifications1[3].item.subjectUrl, comments[2].url)
  t.is(notifications1[3].item.vote, 1)
  t.is(notifications1[3].author.userId, 'alicia@localhost')
  t.is(notifications1[4].item.subjectUrl, posts[1].url)
  t.is(notifications1[4].item.vote, 1)
  t.is(notifications1[4].author.userId, 'alicia@localhost')
  t.is(notifications1[5].item.subjectUrl, posts[0].url)
  t.is(notifications1[5].item.vote, 1)
  t.is(notifications1[5].author.userId, 'alicia@localhost')
  t.is(notifications1[6].item.subjectUrl, posts[0].url)
  t.is(notifications1[6].item.text, 'Comment 2')
  t.is(notifications1[6].author.userId, 'carla@localhost')
  t.is(notifications1[7].item.subjectUrl, posts[0].url)
  t.is(notifications1[7].item.parentCommentUrl, comments[0].url)
  t.is(notifications1[7].item.text, 'Reply 1')
  t.is(notifications1[7].author.userId, 'carla@localhost')
  t.is(notifications1[8].item.subjectUrl, posts[0].url)
  t.is(notifications1[8].item.text, 'Comment 1')
  t.is(notifications1[8].author.userId, 'alicia@localhost')
  t.is(notifications1[9].item.subject.dbUrl, profiles.bobo.dbUrl)
  t.is(notifications1[9].item.subject.userId, 'bobo@localhost')
  t.is(notifications1[9].author.userId, 'carla@localhost')
  t.is(notifications1[10].item.subject.dbUrl, profiles.bobo.dbUrl)
  t.is(notifications1[10].item.subject.userId, 'bobo@localhost')
  t.is(notifications1[10].author.userId, 'alicia@localhost')
})