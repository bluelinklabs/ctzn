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

  profiles.alicia = await api.profiles.get('alicia@localhost')
  profiles.bobo = await api.profiles.get('bobo@localhost')
  profiles.carla = await api.profiles.get('carla@localhost')
})

test.after.always(async t => {
	await close()
})

test('basic CRUD', async t => {
  await api.accounts.login({username: 'bobo', password: 'password'})
  await api.follows.follow(profiles.alicia.userId)
  await api.follows.follow(profiles.carla.userId)
  await api.accounts.login({username: 'alicia', password: 'password'})
  await api.follows.follow(profiles.bobo.dbUrl)
  await api.follows.follow(profiles.carla.dbUrl)
  await api.accounts.login({username: 'carla', password: 'password'})
  await api.follows.follow(profiles.bobo.userId)
  await api.follows.follow(profiles.alicia.dbUrl)

  let follow1 = await api.follows.get('bobo@localhost', profiles.alicia.dbUrl)
  t.is(follow1.value.subject.dbUrl, profiles.alicia.dbUrl)
  t.is(follow1.value.subject.userId, profiles.alicia.userId)

  let follow2 = await api.follows.get('bobo@localhost', profiles.carla.userId)
  t.is(follow2.value.subject.dbUrl, profiles.carla.dbUrl)
  t.is(follow2.value.subject.userId, profiles.carla.userId)

  let follows1 = await api.follows.listFollows('bobo@localhost')
  t.is(follows1.length, 2)
  t.is(follows1.find(f => f.value.subject.userId === 'alicia@localhost').value.subject.dbUrl, profiles.alicia.dbUrl)
  t.is(follows1.find(f => f.value.subject.userId === 'carla@localhost').value.subject.dbUrl, profiles.carla.dbUrl)

  let follows2 = await api.follows.listFollows('alicia@localhost')
  t.is(follows2.length, 2)
  t.is(follows2.find(f => f.value.subject.userId === 'bobo@localhost').value.subject.dbUrl, profiles.bobo.dbUrl)
  t.is(follows2.find(f => f.value.subject.userId === 'carla@localhost').value.subject.dbUrl, profiles.carla.dbUrl)

  let follows3 = await api.follows.listFollows('carla@localhost')
  t.is(follows3.length, 2)
  t.is(follows3.find(f => f.value.subject.userId === 'alicia@localhost').value.subject.dbUrl, profiles.alicia.dbUrl)
  t.is(follows3.find(f => f.value.subject.userId === 'bobo@localhost').value.subject.dbUrl, profiles.bobo.dbUrl)

  let follows4 = await api.follows.listFollows('bobo@localhost', {limit: 1})
  t.is(follows4.length, 1)

  let followers1 = await api.follows.listFollowers('bobo@localhost')
  t.is(followers1.followerIds.length, 2)
  t.truthy(followers1.followerIds.includes('alicia@localhost'))
  t.truthy(followers1.followerIds.includes('carla@localhost'))

  let followers2 = await api.follows.listFollowers('alicia@localhost')
  t.is(followers2.followerIds.length, 2)
  t.truthy(followers2.followerIds.includes('bobo@localhost'))
  t.truthy(followers2.followerIds.includes('carla@localhost'))

  let followers3 = await api.follows.listFollowers('carla@localhost')
  t.is(followers3.followerIds.length, 2)
  t.truthy(followers3.followerIds.includes('bobo@localhost'))
  t.truthy(followers3.followerIds.includes('alicia@localhost'))

  await api.accounts.login({username: 'bobo', password: 'password'})
  await api.follows.unfollow(profiles.alicia.userId)

  let follows5 = await api.follows.listFollows('bobo@localhost')
  t.is(follows5.length, 1)

  let followers4 = await api.follows.listFollowers('alicia@localhost')
  t.is(followers4.followerIds.length, 1)
})