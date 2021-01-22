import test from 'ava'
import { createServer } from './_util.js'

let close
let api
let posts = []

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
  posts.push(await api.posts.create({text: '1'}))
  posts.push(await api.posts.create({text: '2'}))
  posts.push(await api.posts.create({text: '3'}))
  t.is(posts.length, 3)
  for (let post of posts) {
    t.truthy(typeof post.key === 'string')
    t.truthy(typeof post.url === 'string')
  }

  let postEntries = await api.posts.listUserFeed('bobo@localhost')
  t.is(postEntries.length, 3)
  t.is(postEntries[0].key, posts[0].key)
  t.is(postEntries[0].value.text, '1')
  t.is(postEntries[1].value.text, '2')
  t.is(postEntries[2].value.text, '3')

  postEntries = await api.posts.listUserFeed('bobo@localhost', {reverse: true})
  t.is(postEntries.length, 3)
  t.is(postEntries[0].value.text, '3')
  t.is(postEntries[1].value.text, '2')
  t.is(postEntries[2].value.text, '1')

  postEntries = await api.posts.listUserFeed('bobo@localhost', {limit: 2})
  t.is(postEntries.length, 2)

  await api.posts.edit(posts[0].key, {text: '1234'})
  let editedPost = await api.posts.get('bobo@localhost', posts[0].key)
  t.is(editedPost.value.text, '1234')

  await api.posts.del(posts[0].key)
  await t.throwsAsync(() => api.posts.get('bobo@localhost', posts[0].key))
  postEntries = await api.posts.listUserFeed('bobo@localhost', {limit: 2})
  t.is(postEntries.length, 2)
  t.is(postEntries[0].value.text, '2')
  t.is(postEntries[1].value.text, '3')
})