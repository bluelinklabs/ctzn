import test from 'ava'
import { createServer, TestFramework, randRange } from './_util.js'

let instances = []

test.after.always(async t => {
  for (let inst of instances) {
    await inst.close()
  }
})

test('single server', async t => {
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

function threadToDesc (sim, thread) {
  const desc = []
  for (let entry of thread) {
    let replies = undefined
    if (entry.replies) {
      replies = threadToDesc(sim, entry.replies)
    }
    const user = sim.users[entry.author.userId.split('@')[0]]
    desc.push([user, entry.value.text, replies])
  }
  return desc
}