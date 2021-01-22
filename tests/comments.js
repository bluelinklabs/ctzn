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
  await api.accounts.login({username: 'bobo', password: 'password'})

  posts.push(await api.posts.create({text: '1'}))
  posts.push(await api.posts.create({text: '2'}))
})

test.after.always(async t => {
	await close()
})

test('basic CRUD', async t => {
  comments.push(await api.comments.create({
    subjectUrl: posts[0].url,
    text: 'Comment 1'
  }))
  comments.push(await api.comments.create({
    subjectUrl: posts[0].url,
    parentCommentUrl: comments[0].url,
    text: 'Reply 1'
  }))
  comments.push(await api.comments.create({
    subjectUrl: posts[0].url,
    parentCommentUrl: comments[0].url,
    text: 'Reply 2'
  }))
  comments.push(await api.comments.create({
    subjectUrl: posts[0].url,
    text: 'Comment 2'
  }))
  t.is(comments.length, 4)
  for (let comment of comments) {
    t.is(typeof comment.key, 'string')
    t.is(typeof comment.url, 'string')
  }

  let comment1 = await api.comments.get('bobo@localhost', comments[0].key)
  t.is(comment1.value.subjectUrl, posts[0].url)
  t.falsy(comment1.value.parentCommentUrl)
  t.is(comment1.value.text, 'Comment 1')
  t.is(typeof comment1.value.createdAt, 'string')

  let comment2 = await api.comments.get('bobo@localhost', comments[1].key)
  t.is(comment2.value.subjectUrl, posts[0].url)
  t.is(comment2.value.parentCommentUrl, comment1.url)
  t.is(comment2.value.text, 'Reply 1')
  t.is(typeof comment2.value.createdAt, 'string')

  await api.comments.edit(comments[0].key, {text: 'The First Comment'})
  let comment1Edited = await api.comments.get('bobo@localhost', comments[0].key)
  t.is(comment1.value.subjectUrl, comment1Edited.value.subjectUrl)
  t.falsy(comment1Edited.value.parentCommentUrl)
  t.is(comment1Edited.value.text, 'The First Comment')
  t.is(comment1Edited.value.createdAt, comment1.value.createdAt)

  await api.comments.edit(comments[0].key, {subjectUrl: 'http://example.com'})
  let comment1Edited2 = await api.comments.get('bobo@localhost', comments[0].key)
  t.is(comment1.value.subjectUrl, comment1Edited2.value.subjectUrl)
  t.falsy(comment1Edited2.value.parentCommentUrl)
  t.is(comment1Edited2.value.text, 'The First Comment')
  t.is(comment1Edited2.value.createdAt, comment1.value.createdAt)

  let thread1 = await api.comments.getThread(posts[0].url)
  t.is(thread1[0].key, comments[0].key)
  t.is(thread1[0].replies[0].key, comments[1].key)
  t.is(thread1[0].replies[1].key, comments[2].key)
  t.is(thread1[1].key, comments[3].key)

  await api.comments.del(comments[0].key)
  await t.throwsAsync(() => api.comments.get('bobo@localhost', comments[0].key))

  let thread2 = await api.comments.getThread(posts[0].url)
  t.is(thread2[0].key, comments[1].key)
  t.is(thread2[1].key, comments[2].key)
  t.is(thread2[2].key, comments[3].key)
})