import { PerformanceObserver, performance } from 'perf_hooks'
import { createServer } from './tests/_util.js'
import tmp from 'tmp-promise'
import { DEBUG_MODE_PORTS_MAP, constructEntryUrl } from './lib/strings.js'
import createMlts from 'monotonic-lexicographic-timestamp'
import { start } from './index.js'
import * as perf from './lib/perf.js'

const mlts = createMlts()

async function createInProcessServer () {
  const tmpdir = await tmp.dir({unsafeCleanup: true})
  const domain = `dev1.localhost`
  const port = DEBUG_MODE_PORTS_MAP[domain]
  console.log('Storing config in', tmpdir.path)

  const inst = await start({
    debugMode: true,
    simulateHyperspace: true,
    port: port,
    configDir: tmpdir.path,
    domain: domain,
    benchmarkMode: true
  })

  // const client = new WsClient(`ws://localhost:${port}/`)
  // const api = await createRpcApi(client)

  return {
    url: `http://localhost:${port}/`,
    server: inst.server,
    db: inst.db,
    close: inst.close
  }
}

main()
async function main () {
  return inProcessBench({numUsers: 10, numPosts: 100, numComments: 100})

  await bench({
    numServers: 1,
    numUsers: 10,
    numPosts: 100,
    numComments: 100,
    numVotes: 100
  })
  return
  await bench({
    numServers: 1,
    numUsers: 100,
    numPosts: 1000,
    numComments: 1000,
    numVotes: 1000
  })
  await bench({
    numServers: 2,
    numUsers: 100,
    numPosts: 1000,
    numComments: 1000,
    numVotes: 1000
  })
  await bench({
    numServers: 3,
    numUsers: 100,
    numPosts: 1000,
    numComments: 1000,
    numVotes: 1000
  })
}

async function inProcessBench ({numUsers, numPosts, numComments}) {
  const inst = await createInProcessServer()
  
  const benchInfo = {
    users: numUsers,
    follows: (numUsers - 1) * numUsers,
    posts: numUsers * numPosts,
    comments: numUsers * numComments
  }
  const obs = new PerformanceObserver((items) => {
    for (let entry of items.getEntries()) {
      if (!benchInfo[entry.name]) continue
      const num = benchInfo[entry.name]
      console.log(`${entry.name}: ${entry.duration}ms, ${num} items (${num/(entry.duration/1e3)} TPS)`)
    }
    performance.clearMarks()
  })
  obs.observe({ entryTypes: ['measure'] })

  const users = []
  const posts = []

  let _subCounter = -1
  const getRandomSubject = () => {
    const subjects = posts
    _subCounter++
    if (_subCounter === subjects.length) _subCounter = 0
    return subjects[_subCounter].url
  }

  console.log('Generating users...')
  performance.mark('gen-users-start')
  for (let i = 0; i < numUsers; i++) {
    const user = await inst.db.createUser({
      type: 'citizen',
      username: `user${i}`,
      email: `user${i}@email.com`,
      profile: {
        displayName: `User ${i}`
      }
    })
    user.username = `user${i}`
    users.push(user)
  }
  performance.mark('gen-users-end')
  performance.measure(`users`, 'gen-users-start', 'gen-users-end')

  console.log('Generating social graph...')
  performance.mark(`follows-start`)
  for (let i = 0; i < numUsers; i++) {
    const user = users[i]
    for (let j = 0; j < numUsers; j++) {
      if (i === j) continue
      for (let k = 0; k < 1; k++) {
        const pend = perf.measure('follows.follow')
        const value = {
          subject: {userId: users[j].userId, dbUrl: users[j].publicUserDb.url},
          createdAt: (new Date()).toISOString()
        }
        await user.publicUserDb.follows.put(users[j].userId, value)
        await inst.db.onDatabaseChange(user.publicUserDb, [inst.db.publicServerDb])
        inst.db.catchupIndexes(user.privateUserDb, [inst.db.publicUserDbs.get(users[j].userId)])
        pend()
      }
    }
  }
  performance.mark(`follows-end`)
  performance.measure(`follows`, `follows-start`, `follows-end`)

  console.log('Generating posts...')
  performance.mark(`posts-start`)
  let x = 0
  for (let i = 0; i < numUsers; i++) {
    const user = users[i]
    for (let j = 0; j < numPosts; j++) {
      const pend = perf.measure('posts.create')
      const key = mlts()
      const post = {
        text: `Post ${x++}`,
        createdAt: (new Date()).toISOString()
      }
      await user.publicUserDb.posts.put(key, post)
      posts.push({url: constructEntryUrl(user.publicUserDb.url, 'ctzn.network/post', key)})
      pend()
    }
  }
  performance.mark(`posts-end`)
  performance.measure(`posts`, `posts-start`, `posts-end`)

  console.log('Generating comments...')
  performance.mark(`comments-start`)
  for (let i = 0; i < numUsers; i++) {
    const user = users[i]
    for (let j = 0; j < numComments; j++) {
      const pend = perf.measure('comments.create')
      const key = mlts()
      await user.publicUserDb.comments.put(key, {
        subjectUrl: getRandomSubject(),
        text: `Comment ${x++}`,
        createdAt: (new Date()).toISOString()
      })
      await inst.db.onDatabaseChange(user.publicUserDb, [inst.db.publicServerDb])
      pend()
    }
  }
  performance.mark(`comments-end`)
  performance.measure(`comments`, `comments-start`, `comments-end`)

  // await inst.close()
  console.log('Bench finished')
}

async function bench ({numServers, numUsers, numPosts, numComments, numVotes}) {
  let instances = []
  let users = []
  let posts = []
  let comments = []
  let x = 1

  let _subCounter = -1
  const getRandomSubject = () => {
    const subjects = posts
    _subCounter++
    if (_subCounter === subjects.length) _subCounter = 0
    return subjects[_subCounter].url
  }

  console.log('Benching:')
  console.log('- Servers:', numServers)
  console.log('- Users:', numUsers)
  console.log('- Posts per user:', numPosts)
  console.log('- Comments per user:', numComments)
  console.log('- Votes per user:', numVotes)

  for (let i = 0; i < numServers; i++){
    instances.push(await createServer())
  }

  const benchInfo = {
    users: numUsers,
    follows: (numUsers - 1) * numUsers,
    posts: numUsers * numPosts,
    comments: numUsers * numComments,
    votes: numUsers * numVotes
  }
  const obs = new PerformanceObserver((items) => {
    for (let entry of items.getEntries()) {
      const num = benchInfo[entry.name]
      console.log(`${entry.name}: ${entry.duration}ms, ${num} items (${num/(entry.duration/1e3)} TPS)`)
    }
    performance.clearMarks()
  })
  obs.observe({ entryTypes: ['measure'] })

  console.log('Generating users...')
  performance.mark('gen-users-start')
  for (let i = 0; i < numUsers; i++) {
    const inst = instances[Math.floor(i / numUsers * numServers)]
    const user = await inst.api.debug.createUser({
      type: 'citizen',
      username: `user${i}`,
      email: `user${i}@email.com`,
      profile: {
        displayName: `User ${i}`
      }
    })
    user.username = `user${i}`
    user.inst = inst
    users.push(user)
  }
  performance.mark('gen-users-end')
  performance.measure(`users`, 'gen-users-start', 'gen-users-end')

  // await new Promise(r => setTimeout(r, 10e3))
  // for (let inst of instances) {
  //   await inst.api.debug.whenAllSynced()
  // }
  
  console.log('Generating social graph...')
  performance.mark(`follows-start`)
  for (let i = 0; i < numUsers; i++) {
    const user = users[i]
    await user.inst.api.accounts.login({username: user.username, password: 'password'})
    for (let j = 0; j < numUsers; j++) {
      if (i === j) continue
      await user.inst.api.follows.follow(users[j].userId)
    }
  }
  performance.mark(`follows-end`)
  performance.measure(`follows`, `follows-start`, `follows-end`)
  for (let inst of instances) {
    await inst.api.debug.whenAllSynced()
  }

  console.log('Generating posts...')
  performance.mark(`posts-start`)
  for (let i = 0; i < numUsers; i++) {
    const user = users[i]
    await user.inst.api.accounts.login({username: user.username, password: 'password'})
    for (let j = 0; j < numPosts; j++) {
      posts.push(await user.inst.api.posts.create({text: `Post ${x++}`}))
    }
  }
  performance.mark(`posts-end`)
  performance.measure(`posts`, `posts-start`, `posts-end`)

  console.log('Generating comments...')
  performance.mark(`comments-start`)
  for (let i = 0; i < numUsers; i++) {
    const user = users[i]
    await user.inst.api.accounts.login({username: user.username, password: 'password'})
    for (let j = 0; j < numComments; j++) {
      comments.push(await user.inst.api.comments.create({text: `Comment ${x++}`, subjectUrl: getRandomSubject()}))
    }
  }
  performance.mark(`comments-end`)
  performance.measure(`comments`, `comments-start`, `comments-end`)

  console.log('Generating votes...')
  performance.mark(`votes-start`)
  for (let i = 0; i < numUsers; i++) {
    const user = users[i]
    await user.inst.api.accounts.login({username: user.username, password: 'password'})
    for (let j = 0; j < numVotes; j++) {
      await user.inst.api.votes.put({subjectUrl: getRandomSubject(), vote: 1})
    }
  }
  performance.mark(`votes-end`)
  performance.measure(`votes`, `votes-start`, `votes-end`)

  for (let inst of instances) {
    await inst.close()
  }
}