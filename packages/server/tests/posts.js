import test from 'ava'
import { createServer, TestFramework } from './_util.js'
import fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const TEST_IMAGE_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'test-img.jpg')

let close
let api
let sim = new TestFramework()

test.before(async () => {
  let inst = await createServer()
  close = inst.close
  api = inst.api

  await sim.createUser(inst, 'alice')
  await sim.createUser(inst, 'bob')
  await sim.createUser(inst, 'carla')
  const {alice, bob, carla} = sim.users
  await alice.follow(bob)
  await alice.follow(carla)
  await bob.follow(alice)
  await bob.follow(carla)
  await carla.follow(alice)
  await carla.follow(bob)
})

test.after.always(async t => {
	await close()
})

test('single user posting to self', async t => {
  const bob = sim.users.bob
  await bob.createPost({text: '1'})
  await bob.createPost({text: '2'})
  await bob.createPost({text: '3'})

  let postEntries = (await api.view.get('ctzn.network/views/posts', {dbId: bob.username})).posts
  sim.testFeed(t, postEntries, [
    [bob, '1'],
    [bob, '2'],
    [bob, '3']
  ])

  postEntries = (await api.view.get('ctzn.network/views/posts', {dbId: bob.username, reverse: true})).posts
  sim.testFeed(t, postEntries, [
    [bob, '3'],
    [bob, '2'],
    [bob, '1']
  ])

  postEntries = (await api.view.get('ctzn.network/views/posts', {dbId: bob.username, limit: 2})).posts
  sim.testFeed(t, postEntries, [
    [bob, '1'],
    [bob, '2']
  ])

  await api.table.update(
    bob.username,
    'ctzn.network/post',
    bob.posts[0].key,
    Object.assign({}, bob.posts[0].value, {text: '1234'})
  )
  let editedPost = await api.view.get('ctzn.network/views/post', {dbId: bob.username, postKey: bob.posts[0].key})
  sim.testPost(t, editedPost, [bob, '1234'])

  await api.table.delete(bob.username, 'ctzn.network/post', bob.posts[0].key)
  await t.throwsAsync(() => api.view.get('ctzn.network/views/post', bob.username, bob.posts[0].key))
  postEntries = (await api.view.get('ctzn.network/views/posts', {dbId: bob.username})).posts
  sim.testFeed(t, postEntries, [
    [bob, '2'],
    [bob, '3']
  ])
})

test('feeds', async t => {
  const {alice, bob, carla} = sim.users
  await alice.createPost({text: '4'})
  await carla.createPost({text: '5'})
  await bob.createPost({text: '6'})

  await bob.login()
  let postEntries = (await api.view.get('ctzn.network/views/feed')).feed
  sim.testFeed(t, postEntries, [
    [bob, '6'],
    [carla, '5'],
    [alice, '4'],
    [bob, '3'],
    [bob, '2']
  ])
  postEntries = (await api.view.get('ctzn.network/views/feed', {limit: 2})).feed
  sim.testFeed(t, postEntries, [
    [bob, '6'],
    [carla, '5']
  ])
  postEntries = (await api.view.get('ctzn.network/views/feed', {lt: bob.posts[2].key})).feed
  sim.testFeed(t, postEntries, [
    [bob, '2']
  ])

  await alice.login()
  postEntries = (await api.view.get('ctzn.network/views/feed')).feed
  sim.testFeed(t, postEntries, [
    [bob, '6'],
    [carla, '5'],
    [alice, '4'],
    [bob, '3'],
    [bob, '2']
  ])
})

test('feed audiences & communities', async t => {
  const {alice, bob, carla} = sim.users
  await bob.updateProfile({displayName: 'Bob', communities: ['stuff']})
  await alice.createPost({text: '7', audience: 'stuff'})
  await alice.createPost({text: '8', audience: 'things'})
  await bob.createPost({text: '9', audience: 'stuff'})

  await bob.login()
  let postEntries = (await api.view.get('ctzn.network/views/feed')).feed
  sim.testFeed(t, postEntries, [
    [bob, '9'],
    [alice, '7'],
    [bob, '6'],
    [carla, '5'],
    [alice, '4'],
    [bob, '3'],
    [bob, '2']
  ])

  await bob.updateProfile({displayName: 'Bob', communities: ['stuff', 'things']})
  let postEntries2 = (await api.view.get('ctzn.network/views/feed')).feed
  sim.testFeed(t, postEntries2, [
    [bob, '9'],
    [alice, '8'],
    [alice, '7'],
    [bob, '6'],
    [carla, '5'],
    [alice, '4'],
    [bob, '3'],
    [bob, '2']
  ])
})

test('post with images', async t => {
  const bob = sim.users.bob
  await bob.login()
  const base64buf = fs.readFileSync(TEST_IMAGE_PATH, 'base64')
  const res = await api.table.createWithBlobs('bob', 'ctzn.network/post', {
    text: 'Images test',
    media: [{type: 'image'}]
  }, {
    media1Thumb: {base64buf, mimeType: 'image/jpeg'},
    media1: {base64buf, mimeType: 'image/jpeg'}
  })
  const uploadedBuf = await api.table.getBlob('bob', 'ctzn.network/post', res.key, 'media1')
  t.is(uploadedBuf.toString('base64'), base64buf)

  await t.throwsAsync(() => api.table.createWithBlobs('bob', 'ctzn.network/post', {
    text: 'Images test 2',
    media: [{}]
  }, {
    media1234: {base64buf, mimeType: 'image/jpeg'}
  }))

  await t.throwsAsync(() => api.table.createWithBlobs('bob', 'ctzn.network/post', {
    text: 'Images test 3',
    media: [{}]
  }, {
    media1: {base64buf, mimeType: 'application/javascript'}
  }))

  await t.throwsAsync(() => api.table.createWithBlobs('bob', 'ctzn.network/post', {
    text: 'Images test 4',
    media: [{}]
  }, {
    media1Thumb: {base64buf: '0'.repeat(400000), mimeType: 'image/jpeg'}
  }))
})

test('reposts', async t => {
  const {alice, bob, carla} = sim.users
  await alice.repost(bob.posts[1])
  await carla.repost(bob.posts[1])

  const postEntry = await api.view.get('ctzn.network/views/post', {dbUrl: bob.posts[1].dbUrl})
  t.is(postEntry.value.text, '2')
  t.is(postEntry.reposts.length, 2)

  await bob.login()
  let postEntries = (await api.view.get('ctzn.network/views/feed')).feed
  sim.testFeed(t, postEntries, [
    [bob, '2', carla],
    [bob, '2', alice],
    [bob, 'Images test'],
    [bob, '9'],
    [alice, '8'],
    [alice, '7'],
    [bob, '6'],
    [carla, '5'],
    [alice, '4'],
    [bob, '3'],
    [bob, '2']
  ])

  await alice.login()
  postEntries = (await api.view.get('ctzn.network/views/posts', {dbId: alice.username, reverse: true})).posts
  sim.testFeed(t, postEntries, [
    [bob, '2', alice],
    [alice, '8'],
    [alice, '7'],
    [alice, '4']
  ])

  await alice.login()
  postEntries = (await api.view.get('ctzn.network/views/feed')).feed
  sim.testFeed(t, postEntries, [
    [bob, '2', carla],
    [bob, '2', alice],
    [bob, 'Images test'],
    [bob, '6'],
    [carla, '5'],
    [alice, '4'],
    [bob, '3'],
    [bob, '2']
  ])
})

test('muting', async t => {
  const {alice, bob, carla} = sim.users

  await alice.login()
  let postEntries = (await api.view.get('ctzn.network/views/feed')).feed
  sim.testFeed(t, postEntries, [
    [bob, '2', carla],
    [bob, '2', alice],
    [bob, 'Images test'],
    [bob, '6'],
    [carla, '5'],
    [alice, '4'],
    [bob, '3'],
    [bob, '2']
  ])

  await api.method('ctzn.network/methods/set-muted', {dbKey: bob.dbKey, muted: true})

  let profile = await api.view.get('ctzn.network/views/profile', {dbId: 'bob'})
  t.is(profile.isMuted, true)
  await carla.login()
  profile = await api.view.get('ctzn.network/views/profile', {dbId: 'bob'})
  t.is(profile.isMuted, false)

  await alice.login()
  postEntries = (await api.view.get('ctzn.network/views/feed')).feed
  sim.testFeed(t, postEntries, [
    [carla, '5'],
    [alice, '4']
  ])

  await api.method('ctzn.network/methods/set-muted', {dbKey: bob.dbKey, muted: false})
  profile = await api.view.get('ctzn.network/views/profile', {dbId: 'bob'})
  t.is(profile.isMuted, false)

  postEntries = (await api.view.get('ctzn.network/views/feed')).feed
  sim.testFeed(t, postEntries, [
    [bob, '2', carla],
    [bob, '2', alice],
    [bob, 'Images test'],
    [bob, '6'],
    [carla, '5'],
    [alice, '4'],
    [bob, '3'],
    [bob, '2']
  ])

})