import test from 'ava'
import { createServer, TestFramework, randRange } from './_util.js'

let instances = []

test.after.always(async t => {
  for (let inst of instances) {
    await inst.close()
  }
})

test.skip('1 server', async t => {
  const NUM_USERS = 5
  const NUM_POSTS = 5
  const NUM_COMMENTS = 20
  const NUM_VOTES = 50

  let inst = await createServer()
  instances.push(inst)
  let sim = new TestFramework()
  const username = i => `user${i}`
  const user = i => sim.users[username(i)]

  // create users
  for (let i = 0; i < NUM_USERS; i++) {
    await sim.createUser(inst, username(i))
  }
  
  // create social graph
  console.log('Generating test social graph...')
  for (let i = 0; i < NUM_USERS; i++) {
    for (let j = 0; j < randRange(3, NUM_USERS); j++) {
      if (i === j) continue
      await user(i).follow(user(j))
    }
  }
  for (let i = 0; i < NUM_USERS; i++) {
    await user(i).login()
    await user(i).testSocialGraph(t, sim)
  }
  
  // create post, comment, and vote activity
  for (let i = 0; i < NUM_USERS; i++) {
    console.log(`Generating test activity for ${username(i)}...`)
    for (let j = 0; j < NUM_POSTS; j++) {
      await user(i).createPost({text: `Post ${j}`})
    }
    for (let j = 0; j < NUM_COMMENTS; j++) {
      const commentSubject = sim.getRandomPost()
      const commentParent = await sim.getRandomParentFor(inst, commentSubject)
      await user(i).createComment({text: `Comment ${j}`, subject: commentSubject, parent: commentParent})
    }
    for (let j = 0; j < NUM_VOTES; j++) {
      let vote = randRange(0, 1)
      if (vote === 0) vote = -1
      await user(i).vote({subject: sim.getRandomSubject(), vote})
    }
  }

  // test home feeds
  for (let i = 0; i < NUM_USERS; i++) {
    const expectedHomeFeedUrls = sim.getExpectedHomeFeedUrls(user(i))
    await user(i).login()
    const postEntries = await inst.api.posts.listHomeFeed()
    t.deepEqual(postEntries.map(p => p.url), expectedHomeFeedUrls)
  }

  // test user feeds
  for (let i = 0; i < NUM_USERS; i++) {
    const expectedUserFeedUrls = sim.getExpectedUserFeedUrls(user(i))
    const postEntries = await inst.api.posts.listUserFeed(user(i).userId)
    t.deepEqual(postEntries.map(p => p.url), expectedUserFeedUrls)
  }

  // test post threads
  for (let post of sim.allPosts) {
    const thread = await inst.api.comments.getThread(post.url)
    sim.testThread(t, thread, threadToDesc(sim, sim.getThread(post)))
  }

  // test vote counts
  for (let subject of sim.allSubjects) {
    const votes = await inst.api.votes.getVotesForSubject(subject.url)
    t.deepEqual(votes.upvoterIds.sort(), sim.getExpectedVoterIds(subject, 1).sort())
    t.deepEqual(votes.downvoterIds.sort(), sim.getExpectedVoterIds(subject, -1).sort())
  }

  t.truthy(true)
})

test.skip('2 servers, all users follow all other users', async t => {
  /**
   * In this topology, there are 2 servers, and all users follow all other users.
   * Because servers sync the data of users their own members follow,
   * this will cause all user data to be available in both servers.
   */

  const NUM_USERS = 5
  const NUM_POSTS = 5
  const NUM_COMMENTS = 20
  const NUM_VOTES = 50

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
    } else {
      await sim.createUser(inst2, username(i))
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
  await new Promise(r => setTimeout(r, 5e3)) // TODO update whenAllSynced to handle buffered bg syncs
  for (let inst of instances) {
    await inst.api.debug.whenAllSynced()
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
      const commentSubject = sim.getRandomPost()
      const commentParent = await sim.getRandomParentFor([inst1, inst2], commentSubject)
      await user(i).createComment({text: `Comment ${x++}`, subject: commentSubject, parent: commentParent})
    }
    for (let j = 0; j < NUM_VOTES; j++) {
      let vote = randRange(0, 1)
      if (vote === 0) vote = -1
      await user(i).vote({subject: sim.getRandomSubject(), vote})
    }
  }
  await new Promise(r => setTimeout(r, 5e3)) // TODO update whenAllSynced to handle buffered bg syncs
  for (let inst of instances) {
    await inst.api.debug.whenAllSynced()
  }

  // test home feeds
  for (let i = 0; i < NUM_USERS; i++) {
    const expectedHomeFeedUrls = sim.getExpectedHomeFeedUrls(user(i))
    await user(i).login()
    const postEntries = await user(i).inst.api.posts.listHomeFeed()
    t.deepEqual(postEntries.map(p => p.url), expectedHomeFeedUrls)
  }

  // test user feeds
  for (let i = 0; i < NUM_USERS; i++) {
    const expectedUserFeedUrls = sim.getExpectedUserFeedUrls(user(i))
    const postEntries1 = await inst1.api.posts.listUserFeed(user(i).userId)
    t.deepEqual(postEntries1.map(p => p.url), expectedUserFeedUrls)
    const postEntries2 = await inst2.api.posts.listUserFeed(user(i).userId)
    t.deepEqual(postEntries2.map(p => p.url), expectedUserFeedUrls)
  }

  // test post threads
  for (let post of sim.allPosts) {
    const thread1 = await inst1.api.comments.getThread(post.url)
    sim.testThread(t, thread1, threadToDesc(sim, sim.getThread(post)))
    const thread2 = await inst1.api.comments.getThread(post.url)
    sim.testThread(t, thread2, threadToDesc(sim, sim.getThread(post)))
  }

  // test vote counts
  for (let subject of sim.allSubjects) {
    const votes1 = await inst1.api.votes.getVotesForSubject(subject.url)
    t.deepEqual(votes1.upvoterIds.sort(), sim.getExpectedVoterIds(subject, 1).sort())
    t.deepEqual(votes1.downvoterIds.sort(), sim.getExpectedVoterIds(subject, -1).sort())
    const votes2 = await inst2.api.votes.getVotesForSubject(subject.url)
    t.deepEqual(votes2.upvoterIds.sort(), sim.getExpectedVoterIds(subject, 1).sort())
    t.deepEqual(votes2.downvoterIds.sort(), sim.getExpectedVoterIds(subject, -1).sort())
  }

  t.truthy(true)
})

test.skip('2 servers, users only follow users on their own server', async t => {
  /**
   * In this topology, there are 2 servers, and users only follow members of their own server.
   * Because servers *only* sync the data of users their own members follow,
   * this will cause the servers to have *no* data from the other server
   */

  const NUM_USERS = 5
  const NUM_POSTS = 5
  const NUM_COMMENTS = 20
  const NUM_VOTES = 50

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
    } else {
      await sim.createUser(inst2, username(i))
    }
  }
  
  // create social graph
  console.log('Generating test social graph...')
  for (let i = 0; i < NUM_USERS; i++) {
    for (let j = 0; j < NUM_USERS; j++) {
      if (i === j) continue
      if (user(i).inst !== user(j).inst) continue // only follow users on my server
      await user(i).follow(user(j))
    }
  }
  await new Promise(r => setTimeout(r, 5e3)) // TODO update whenAllSynced to handle buffered bg syncs
  for (let inst of instances) {
    await inst.api.debug.whenAllSynced()
  }
  for (let i = 0; i < NUM_USERS; i++) {
    await user(i).login()
    await user(i).testSocialGraph(t, sim)
  }
  
  // create post, comment, and vote activity
  for (let i = 0; i < NUM_USERS; i++) {
    console.log(`Generating test activity for ${username(i)}...`)
    for (let j = 0; j < NUM_POSTS; j++) {
      await user(i).createPost({text: `Post ${j}`})
    }
    for (let j = 0; j < NUM_COMMENTS; j++) {
      const commentSubject = sim.getRandomPost()
      const commentParent = await sim.getRandomParentFor(user(i).inst, commentSubject)
      await user(i).createComment({text: `Comment ${j}`, subject: commentSubject, parent: commentParent})
    }
    for (let j = 0; j < NUM_VOTES; j++) {
      let vote = randRange(0, 1)
      if (vote === 0) vote = -1
      await user(i).vote({subject: sim.getRandomSubject(), vote})
    }
  }
  await new Promise(r => setTimeout(r, 5e3)) // TODO update whenAllSynced to handle buffered bg syncs
  for (let inst of instances) {
    await inst.api.debug.whenAllSynced()
  }

  // test home feeds
  for (let i = 0; i < NUM_USERS; i++) {
    const expectedHomeFeedUrls = sim.getExpectedHomeFeedUrls(user(i))
    await user(i).login()
    const postEntries = await user(i).inst.api.posts.listHomeFeed()
    t.deepEqual(postEntries.map(p => p.url), expectedHomeFeedUrls)
  }

  // test user feeds
  for (let i = 0; i < NUM_USERS; i++) {
    const expectedUserFeedUrls = sim.getExpectedUserFeedUrls(user(i))
    for (let inst of instances) {
      if (user(i).inst === inst) {
        const postEntries = await inst.api.posts.listUserFeed(user(i).userId)
        t.deepEqual(postEntries.map(p => p.url), expectedUserFeedUrls)
      } else {
        t.throwsAsync(() => inst.api.posts.listUserFeed(user(i).userId))
      }
    }
  }

  // test post threads
  for (let post of sim.allPosts) {
    const thread1 = await inst1.api.comments.getThread(post.url)
    sim.testThread(t, thread1, threadToDesc(sim, sim.getThread(post, c => c.author.userId.endsWith(inst1.domain))))
    const thread2 = await inst2.api.comments.getThread(post.url)
    sim.testThread(t, thread2, threadToDesc(sim, sim.getThread(post, c => c.author.userId.endsWith(inst2.domain))))
  }

  // test vote counts
  for (let subject of sim.allSubjects) {
    const votes1 = await inst1.api.votes.getVotesForSubject(subject.url)
    t.deepEqual(votes1.upvoterIds.sort(), sim.getExpectedVoterIds(subject, 1).filter(id => id.endsWith(inst1.domain)).sort())
    t.deepEqual(votes1.downvoterIds.sort(), sim.getExpectedVoterIds(subject, -1).filter(id => id.endsWith(inst1.domain)).sort())
    const votes2 = await inst2.api.votes.getVotesForSubject(subject.url)
    t.deepEqual(votes2.upvoterIds.sort(), sim.getExpectedVoterIds(subject, 1).filter(id => id.endsWith(inst2.domain)).sort())
    t.deepEqual(votes2.downvoterIds.sort(), sim.getExpectedVoterIds(subject, -1).filter(id => id.endsWith(inst2.domain)).sort())
  }

  t.truthy(true)
})

function threadToDesc (sim, thread) {
  const descs = []
  for (let entry of thread) {
    let replies = undefined
    if (entry.replies) {
      replies = threadToDesc(sim, entry.replies)
    }
    const user = sim.users[entry.author.userId.split('@')[0]]
    descs.push([user, entry.value.text, replies])
  }
  return descs
}