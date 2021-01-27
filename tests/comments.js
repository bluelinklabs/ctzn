import test from 'ava'
import { createServer, TestFramework } from './_util.js'

let close
let api
let sim = new TestFramework()

test.before(async () => {
  let inst = await createServer()
  close = inst.close
  api = inst.api

  await sim.createUser(inst, 'bob')
  await sim.users.bob.createPost({text: '1'})
  await sim.users.bob.createPost({text: '2'})
})

test.after.always(async t => {
	await close()
})

test('basic CRUD', async t => {
  const bob = sim.users.bob
  await bob.createComment({
    subjectUrl: bob.posts[0].url,
    text: 'Comment 1'
  })
  await bob.createComment({
    subjectUrl: bob.posts[0].url,
    parentCommentUrl: bob.comments[0].url,
    text: 'Reply 1'
  })
  await bob.createComment({
    subjectUrl: bob.posts[0].url,
    parentCommentUrl: bob.comments[0].url,
    text: 'Reply 2'
  })
  await bob.createComment({
    subjectUrl: bob.posts[0].url,
    text: 'Comment 2'
  })

  let comment1 = await api.comments.get(bob.userId, bob.comments[0].key)
  sim.testComment(t, comment1, ['bob', 'Comment 1'], {subject: bob.posts[0]})

  let comment2 = await api.comments.get(bob.userId, bob.comments[1].key)
  sim.testComment(t, comment2, ['bob', 'Reply 1'], {subject: bob.posts[0], parent: bob.comments[0]})

  await api.comments.edit(bob.comments[0].key, {text: 'The First Comment'})
  let comment1Edited = await api.comments.get(bob.userId, bob.comments[0].key)
  sim.testComment(t, comment1Edited, ['bob', 'The First Comment'], {subject: bob.posts[0]})

  // ensure that edits cant modify the subject
  await api.comments.edit(bob.comments[0].key, {subjectUrl: 'http://example.com'})
  let comment1Edited2 = await api.comments.get(bob.userId, bob.comments[0].key)
  t.is(comment1Edited2.value.subjectUrl, bob.posts[0].url)

  let thread1 = await api.comments.getThread(bob.posts[0].url)
  sim.testThread(t, thread1, [
    ['bob', 'The First Comment', [
      ['bob', 'Reply 1'],
      ['bob', 'Reply 2']
    ]],
    ['bob', 'Comment 2']
  ])

  await api.comments.del(bob.comments[0].key)
  await t.throwsAsync(() => api.comments.get(bob.userId, bob.comments[0].key))
  let thread2 = await api.comments.getThread(bob.posts[0].url)
  sim.testThread(t, thread2, [
    ['bob', 'Reply 1'],
    ['bob', 'Reply 2'],
    ['bob', 'Comment 2']
  ])
})