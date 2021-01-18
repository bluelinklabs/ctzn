import test from 'ava'
import { createServer } from './_util.js'

let close
let api
let profiles = {}

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

  profiles.alicia = await api.profiles.get('alicia')
  profiles.bobo = await api.profiles.get('bobo')
  profiles.carla = await api.profiles.get('carla')
})

test.after.always(async t => {
	await close()
})

test('basic CRUD', async t => {
  await api.accounts.login({username: 'bobo', password: 'password'})
  await api.follows.follow(profiles.alicia.url)
  await api.follows.follow(profiles.carla.url)
  await api.accounts.login({username: 'alicia', password: 'password'})
  await api.follows.follow(profiles.bobo.url)
  await api.follows.follow(profiles.carla.url)
  await api.accounts.login({username: 'carla', password: 'password'})
  await api.follows.follow(profiles.bobo.url)
  await api.follows.follow(profiles.alicia.url)

  let follow1 = await api.follows.get('bobo', profiles.alicia.url)
  t.is(follow1.value.subjectUrl, profiles.alicia.url)

  let follows1 = await api.follows.listFollows('bobo')
  t.is(follows1.length, 2)

  let follows2 = await api.follows.listFollows('alicia')
  t.is(follows2.length, 2)

  let follows3 = await api.follows.listFollows('carla')
  t.is(follows3.length, 2)

  let follows4 = await api.follows.listFollows('bobo', {limit: 1})
  t.is(follows4.length, 1)

  let followers1 = await api.follows.listFollowers('bobo')
  t.is(followers1.followerUrls.length, 2)

  let followers2 = await api.follows.listFollowers('alicia')
  t.is(followers2.followerUrls.length, 2)

  let followers3 = await api.follows.listFollowers('carla')
  t.is(followers3.followerUrls.length, 2)

  await api.accounts.login({username: 'bobo', password: 'password'})
  await api.follows.unfollow(profiles.alicia.url)

  let follows5 = await api.follows.listFollows('bobo')
  t.is(follows5.length, 1)

  let followers4 = await api.follows.listFollowers('alicia')
  t.is(followers4.followerUrls.length, 1)
})