import test from 'ava'
import { createServer, TestFramework, randRange } from './_util.js'
import fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const TEST_IMAGE_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'test-img.jpg')

let instances = []

test.after.always(async t => {
  for (let inst of instances) {
    await inst.close()
  }
})

test('2 instances, all users follow all other users', async t => {
  /**
   * In this topology, there are 2 instances, and all users follow all other users.
   * Because instances sync the data of users their own members follow,
   * this will cause all user data to be available in both instances.
   */

  const NUM_USERS = 6
  const NUM_POSTS = 5
  const NUM_COMMENTS = 20
  // const NUM_VOTES = 50

  let inst1 = await createServer()
  instances.push(inst1)
  let inst2 = await createServer()
  instances.push(inst2)
  let sim = new TestFramework()
  const username = i => `user${i}`
  const user = i => sim.users[username(i)]
  const aliasDbKeyToUsername = url => {
    for (let i = 0; i < NUM_USERS; i++) {
      url = url.replace(user(i).dbKey, username(i))
    }
    return url
  }

  // create users
  for (let i = 0; i < NUM_USERS; i++) {
    if (i < Math.floor(NUM_USERS / 2)) {
      await sim.createUser(inst1, username(i))
      console.log('INST 1', user(i).dbKey)
    } else {
      await sim.createUser(inst2, username(i))
      console.log('INST 2', user(i).dbKey)
    }
  }
  
  // create social graph
  console.log('Generating test social graph...')
  for (let i = 0; i < NUM_USERS; i++) {
    for (let j = 0; j < NUM_USERS; j++) {
      if (i === j) continue
      await user(i).follow(user(j))
    }
  }
  for (let inst of instances) {
    await inst.api.post('debug/update-external-dbs')
  }
  for (let inst of instances) {
    await inst.api.get('debug/when-all-synced')
  }

  for (let i = 0; i < NUM_USERS; i++) {
    for (let j = 0; j < NUM_USERS; j++) {
      await user(j).login()
      await user(i).testSocialGraph(t, sim, user(j).inst)
    }
  }
  
  // create post, comment, and vote activity
  var x = 0
  for (let i = 0; i < NUM_USERS; i++) {
    console.log(`Generating test activity for ${username(i)}...`)
    for (let j = 0; j < NUM_POSTS; j++) {
      await user(i).createPost({text: `Post ${x++}`})
    }
    for (let j = 0; j < NUM_COMMENTS; j++) {
      const root = sim.getRandomPost()
      const parent = await sim.getRandomParentFor([inst1, inst2], root)
      await user(i).createComment({text: `Comment ${x++}`, reply: {root, parent}})
    }
    // for (let j = 0; j < NUM_VOTES; j++) {
    //   let vote = randRange(0, 1)
    //   if (vote === 0) vote = -1
    //   await user(i).vote({subject: sim.getRandomSubject(), vote})
    // }
  }
  for (let inst of instances) {
    await inst.api.post('debug/update-external-dbs')
  }
  for (let inst of instances) {
    await inst.api.get('debug/when-all-synced')
  }

  // test home feeds
  for (let i = 0; i < NUM_USERS; i++) {
    let expectedHomeFeedUrls = sim.getExpectedHomeFeedUrls(user(i))
    expectedHomeFeedUrls = expectedHomeFeedUrls.map(aliasDbKeyToUsername)
    await user(i).login()
    const postEntries = (await user(i).inst.api.view.get('ctzn.network/views/feed')).feed
    t.deepEqual(postEntries.map(p => aliasDbKeyToUsername(p.dbUrl)), expectedHomeFeedUrls)
  }

  // test user feeds
  for (let i = 0; i < NUM_USERS; i++) {
    let expectedUserFeedUrls = sim.getExpectedUserFeedUrls(user(i))
    expectedUserFeedUrls = expectedUserFeedUrls.map(aliasDbKeyToUsername)
    const postEntries1 = (await inst1.api.view.get('ctzn.network/views/posts', {dbId: user(i).dbKey})).posts
    t.deepEqual(postEntries1.map(p => aliasDbKeyToUsername(p.dbUrl)), expectedUserFeedUrls)
    const postEntries2 = (await inst2.api.view.get('ctzn.network/views/posts', {dbId: user(i).dbKey})).posts
    t.deepEqual(postEntries2.map(p => aliasDbKeyToUsername(p.dbUrl)), expectedUserFeedUrls)
  }

  // test post threads
  for (let post of sim.allPosts) {
    const thread1 = (await inst1.api.view.get('ctzn.network/views/thread', {dbUrl: post.dbUrl})).comments
    sim.testThread(t, thread1, threadToDesc(sim, sim.getThread(post)))
    const thread2 = (await inst2.api.view.get('ctzn.network/views/thread', {dbUrl: post.dbUrl})).comments
    sim.testThread(t, thread2, threadToDesc(sim, sim.getThread(post)))
  }

  // test vote counts
  // for (let subject of sim.allSubjects) {
  //   const votes1 = await inst1.api.votes.getVotesForSubject(subject.url)
  //   t.deepEqual(votes1.upvoterIds.sort(), sim.getExpectedVoterIds(subject, 1).sort())
  //   t.deepEqual(votes1.downvoterIds.sort(), sim.getExpectedVoterIds(subject, -1).sort())
  //   const votes2 = await inst2.api.votes.getVotesForSubject(subject.url)
  //   t.deepEqual(votes2.upvoterIds.sort(), sim.getExpectedVoterIds(subject, 1).sort())
  //   t.deepEqual(votes2.downvoterIds.sort(), sim.getExpectedVoterIds(subject, -1).sort())
  // }
})

test('3 instances, all users follow all other users', async t => {
  /**
   * In this topology, there are 3 instances, and all users follow all other users.
   * Because instances sync the data of users their own members follow,
   * this will cause all user data to be available in both instances.
   */

  const NUM_USERS = 6
  const NUM_POSTS = 5
  const NUM_COMMENTS = 20
  // const NUM_VOTES = 50

  let inst1 = await createServer()
  instances.push(inst1)
  let inst2 = await createServer()
  instances.push(inst2)
  let inst3 = await createServer()
  instances.push(inst3)
  let sim = new TestFramework()
  const username = i => `user${i}`
  const user = i => sim.users[username(i)]
  const aliasDbKeyToUsername = url => {
    for (let i = 0; i < NUM_USERS; i++) {
      url = url.replace(user(i).dbKey, username(i))
    }
    return url
  }

  // create users
  for (let i = 0; i < NUM_USERS; i++) {
    if (i < Math.floor(NUM_USERS / 3)) {
      await sim.createUser(inst1, username(i))
      console.log('INST 1', user(i).dbKey)
    } else if (i < Math.floor(NUM_USERS * 2 / 3)) {
      await sim.createUser(inst2, username(i))
      console.log('INST 2', user(i).dbKey)
    } else {
      await sim.createUser(inst3, username(i))
      console.log('INST 3', user(i).dbKey)
    }
  }
  
  // create social graph
  console.log('Generating test social graph...')
  for (let i = 0; i < NUM_USERS; i++) {
    for (let j = 0; j < NUM_USERS; j++) {
      if (i === j) continue
      await user(i).follow(user(j))
    }
  }
  for (let inst of instances) {
    await inst.api.post('debug/update-external-dbs')
  }
  for (let inst of instances) {
    await inst.api.get('debug/when-all-synced')
  }

  for (let i = 0; i < NUM_USERS; i++) {
    for (let j = 0; j < NUM_USERS; j++) {
      await user(j).login()
      await user(i).testSocialGraph(t, sim, user(j).inst)
    }
  }
  
  // create post, comment, and vote activity
  var x = 0
  for (let i = 0; i < NUM_USERS; i++) {
    console.log(`Generating test activity for ${username(i)}...`)
    for (let j = 0; j < NUM_POSTS; j++) {
      await user(i).createPost({text: `Post ${x++}`})
    }
    for (let j = 0; j < NUM_COMMENTS; j++) {
      const root = sim.getRandomPost()
      const parent = await sim.getRandomParentFor([inst1, inst2, inst3], root)
      await user(i).createComment({text: `Comment ${x++}`, reply: {root, parent}})
    }
    // for (let j = 0; j < NUM_VOTES; j++) {
    //   let vote = randRange(0, 1)
    //   if (vote === 0) vote = -1
    //   await user(i).vote({subject: sim.getRandomSubject(), vote})
    // }
  }
  for (let inst of instances) {
    await inst.api.post('debug/update-external-dbs')
  }
  for (let inst of instances) {
    await inst.api.get('debug/when-all-synced')
  }

  // test home feeds
  for (let i = 0; i < NUM_USERS; i++) {
    let expectedHomeFeedUrls = sim.getExpectedHomeFeedUrls(user(i))
    expectedHomeFeedUrls = expectedHomeFeedUrls.map(aliasDbKeyToUsername)
    await user(i).login()
    const postEntries = (await user(i).inst.api.view.get('ctzn.network/views/feed')).feed
    t.deepEqual(postEntries.map(p => aliasDbKeyToUsername(p.dbUrl)), expectedHomeFeedUrls)
  }

  // test user feeds
  for (let i = 0; i < NUM_USERS; i++) {
    let expectedUserFeedUrls = sim.getExpectedUserFeedUrls(user(i))
    expectedUserFeedUrls = expectedUserFeedUrls.map(aliasDbKeyToUsername)
    const postEntries1 = (await inst1.api.view.get('ctzn.network/views/posts', {dbId: user(i).dbKey})).posts
    t.deepEqual(postEntries1.map(p => aliasDbKeyToUsername(p.dbUrl)), expectedUserFeedUrls)
    const postEntries2 = (await inst2.api.view.get('ctzn.network/views/posts', {dbId: user(i).dbKey})).posts
    t.deepEqual(postEntries2.map(p => aliasDbKeyToUsername(p.dbUrl)), expectedUserFeedUrls)
  }

  // test post threads
  for (let post of sim.allPosts) {
    const thread1 = (await inst1.api.view.get('ctzn.network/views/thread', {dbUrl: post.dbUrl})).comments
    sim.testThread(t, thread1, threadToDesc(sim, sim.getThread(post)))
    const thread2 = (await inst2.api.view.get('ctzn.network/views/thread', {dbUrl: post.dbUrl})).comments
    sim.testThread(t, thread2, threadToDesc(sim, sim.getThread(post)))
    const thread3 = (await inst2.api.view.get('ctzn.network/views/thread', {dbUrl: post.dbUrl})).comments
    sim.testThread(t, thread3, threadToDesc(sim, sim.getThread(post)))
  }

  // test vote counts
  // for (let subject of sim.allSubjects) {
  //   const votes1 = await inst1.api.votes.getVotesForSubject(subject.url)
  //   t.deepEqual(votes1.upvoterIds.sort(), sim.getExpectedVoterIds(subject, 1).sort())
  //   t.deepEqual(votes1.downvoterIds.sort(), sim.getExpectedVoterIds(subject, -1).sort())
  //   const votes2 = await inst2.api.votes.getVotesForSubject(subject.url)
  //   t.deepEqual(votes2.upvoterIds.sort(), sim.getExpectedVoterIds(subject, 1).sort())
  //   t.deepEqual(votes2.downvoterIds.sort(), sim.getExpectedVoterIds(subject, -1).sort())
  // }
})

test('2 instances, no follows (on-demand fetches)', async t => {
  /**
   * In this topology, there are 3 instances, and no user follows the other.
   * This means all data-accesses of remote content are fetched on-demand from
   * the remote instance.
   */

  const NUM_USERS = 6
  const NUM_POSTS = 5
  const NUM_COMMENTS = 20
  // const NUM_VOTES = 50

  let inst1 = await createServer()
  instances.push(inst1)
  let inst2 = await createServer()
  instances.push(inst2)
  let sim = new TestFramework()
  const username = i => `user${i}`
  const user = i => sim.users[username(i)]

  // create users
  for (let i = 0; i < NUM_USERS; i++) {
    if (i < Math.floor(NUM_USERS / 2)) {
      await sim.createUser(inst1, username(i))
      console.log('INST 1', user(i).dbKey)
    } else {
      await sim.createUser(inst2, username(i))
      console.log('INST 2', user(i).dbKey)
    }
  }

  // create post, comment, and vote activity
  var x = 0
  for (let i = 0; i < NUM_USERS; i++) {
    console.log(`Generating test activity for ${username(i)}...`)
    for (let j = 0; j < NUM_POSTS; j++) {
      await user(i).createPost({text: `Post ${x++}`})
    }
    for (let j = 0; j < NUM_COMMENTS; j++) {
      const root = sim.getRandomPost()
      const parent = await sim.getRandomParentFor([inst1, inst2], root)
      await user(i).createComment({text: `Comment ${x++}`, reply: {root, parent}})
    }
    // for (let j = 0; j < NUM_VOTES; j++) {
    //   let vote = randRange(0, 1)
    //   if (vote === 0) vote = -1
    //   await user(i).vote({subject: sim.getRandomSubject(), vote})
    // }
  }
  for (let inst of instances) {
    await inst.api.post('debug/update-external-dbs')
  }
  for (let inst of instances) {
    await inst.api.get('debug/when-all-synced')
  }

  // test posts
  for (let i = 0; i < NUM_USERS; i++) {
    for (let j = 0; j < NUM_POSTS; j++) {
      let post = user(i).posts[j]
      const postEntry1 = (await inst1.api.view.get('ctzn.network/views/post', {dbUrl: post.dbUrl}))
      t.deepEqual(postEntry1.value.text, post.value.text)
      const postEntry2 = (await inst2.api.view.get('ctzn.network/views/post', {dbUrl: post.dbUrl}))
      t.deepEqual(postEntry2.value.text, post.value.text)
    }
  }

  // test comments
  for (let i = 0; i < NUM_USERS; i++) {
    for (let j = 0; j < NUM_COMMENTS; j++) {
      let comment = user(i).comments[j]
      const commentEntry1 = (await inst1.api.view.get('ctzn.network/views/comment', {dbUrl: comment.dbUrl}))
      t.deepEqual(commentEntry1.value.text, comment.value.text)
      const commentEntry2 = (await inst2.api.view.get('ctzn.network/views/comment', {dbUrl: comment.dbUrl}))
      t.deepEqual(commentEntry2.value.text, comment.value.text)
    }
  }
})

test('optimistic sync of followed users', async t => {
  const NUM_USERS = 2
  const NUM_POSTS = 5

  let inst1 = await createServer()
  instances.push(inst1)
  let inst2 = await createServer()
  instances.push(inst2)
  let sim = new TestFramework()
  const username = i => `user${i}`
  const user = i => sim.users[username(i)]

  // create users
  for (let i = 0; i < NUM_USERS; i++) {
    if (i < Math.floor(NUM_USERS / 2)) {
      await sim.createUser(inst1, username(i))
      console.log('INST 1', user(i).dbKey)
    } else {
      await sim.createUser(inst2, username(i))
      console.log('INST 2', user(i).dbKey)
    }
  }
  
  // create social graph
  console.log('Generating test social graph...')
  for (let i = 0; i < NUM_USERS; i++) {
    for (let j = 0; j < NUM_USERS; j++) {
      if (i === j) continue
      await user(i).follow(user(j))
    }
  }
  for (let inst of instances) {
    await inst.api.post('debug/update-external-dbs')
  }
  for (let inst of instances) {
    await inst.api.get('debug/when-all-synced')
  }

  for (let i = 0; i < NUM_USERS; i++) {
    for (let j = 0; j < NUM_USERS; j++) {
      await user(j).login()
      await user(i).testSocialGraph(t, sim, user(j).inst)
    }
  }
  
  // create post and comment activity
  var x = 0
  const posts = []
  const base64buf = fs.readFileSync(TEST_IMAGE_PATH, 'base64')
  for (let i = 0; i < NUM_USERS; i++) {
    console.log(`Generating test activity for ${username(i)}...`)
    for (let j = 0; j < NUM_POSTS; j++) {
      await user(i).login()
      posts.push(await user(i).inst.api.table.createWithBlobs(user(i).dbKey, 'ctzn.network/post', {
        text: `Post ${x++}`,
        media: [{type: 'image'}]
      }, {
        media1Thumb: {base64buf, mimeType: 'image/jpeg'},
        media1: {base64buf, mimeType: 'image/jpeg'}
      }))
    }
  }

  for (let inst of instances) {
    await inst.api.post('debug/update-external-dbs')
  }
  for (let inst of instances) {
    await inst.api.get('debug/when-all-synced')
  }

  // test post availability
  for (let i = 0; i < NUM_USERS; i++) {
    for (let j = 0; j < NUM_POSTS; j++) {
      let post = posts[j]
      t.truthy(await inst1.api.get('debug/is-record-blob-cached', {dbUrl: post.dbUrl, blobName: 'media1Thumb'}))
      t.truthy(await inst1.api.get('debug/is-record-blob-cached', {dbUrl: post.dbUrl, blobName: 'media1'}))
      t.truthy(await inst2.api.get('debug/is-record-blob-cached', {dbUrl: post.dbUrl, blobName: 'media1Thumb'}))
      t.truthy(await inst2.api.get('debug/is-record-blob-cached', {dbUrl: post.dbUrl, blobName: 'media1'}))
    }
  }
})

function threadToDesc (sim, thread) {
  const descs = []
  for (let entry of thread) {
    let replies = undefined
    if (entry.replies) {
      replies = threadToDesc(sim, entry.replies)
    }
    const user = Object.values(sim.users).find(user => user.dbKey === entry.author.dbKey)
    descs.push([user, entry.value.text, replies])
  }
  return descs
}
