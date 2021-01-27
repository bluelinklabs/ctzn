import { start } from '../index.js'
import randomPort from 'random-port'
import { Client as WsClient } from 'rpc-websockets'
import tmp from 'tmp-promise'
import { parseEntryUrl } from '../lib/strings.js'

export async function createServer () {
  const tmpdir = await tmp.dir({unsafeCleanup: true})
  const port = await new Promise(r => randomPort(r))
  const inst = await start({
    debugMode: true,
    port,
    configDir: tmpdir.path,
    simulateHyperspace: true
  })
  console.log('Storing config in', tmpdir.path)

  const client = new WsClient(`ws://localhost:${port}/`)
  const api = await createRpcApi(client)

  return {
    db: inst.db,
    client,
    api,
    close: async () => {
      await inst.close()
      await tmpdir.cleanup()
    }
  }
}

async function createRpcApi (ws) {
  await new Promise(resolve => ws.on('open', resolve))
  return new Proxy({}, {
    get (target, prop) {
      // generate rpc calls as needed
      if (!(prop in target)) {
        target[prop] = new Proxy({}, {
          get (target, prop2) {
            if (!(prop2 in target)) {
              target[prop2] = async (...params) => {
                try {
                  return await ws.call(`${prop}.${prop2}`, params)
                } catch (e) {
                  throw new Error(e.data || e.message)
                }
              }
            }
            return target[prop2]
          }
        })
      }

      return target[prop]
    }
  })
}

export class TestFramework {
  constructor () {
    this.users = {}
  }

  async createUser (inst, username) {
    const user = new TestUser(inst, username)
    await user.setup()
    this.users[username] = user
    return user
  }

  testFeed (t, entries, desc) {
    t.is(entries.length, desc.length)
    for (let i = 0; i < desc.length; i++) {
      this.testPost(t, entries[i], desc[i])
    }
  }

  testPost (t, entry, desc) {
    const user = this.users[desc[0]]
    t.truthy(entry.url.startsWith(user.profile.dbUrl))
    t.is(entry.author.userId, user.userId)
    t.is(entry.value.text, desc[1])
  }

  testComment (t, entry, desc, {subject, parent}) {
    const user = this.users[desc[0]]
    t.truthy(entry.url.startsWith(user.profile.dbUrl))
    t.is(entry.author.userId, user.userId)
    t.is(entry.value.text, desc[1])
    t.is(entry.value.subjectUrl, subject.url)
    if (parent) t.is(entry.value.parentCommentUrl, parent.url)
    else t.falsy(entry.value.parentCommentUrl)
  }

  testThread (t, entries, desc) {
    t.is(entries.length, desc.length)
    for (let i = 0; i < desc.length; i++) {
      this.testThreadItem(t, entries[i], desc[i])
    }
  }

  testThreadItem (t, entry, desc) {
    const user = this.users[desc[0]]
    t.truthy(entry.url.startsWith(user.profile.dbUrl))
    t.is(entry.author.userId, user.userId)
    t.is(entry.value.text, desc[1])

    if (desc[2] && desc[2].length) {
      this.testThread(t, entry.replies, desc[2])
    }
  }

  testFollows (t, entries, users) {
    t.is(entries.length, users.length)
    for (let user of users) {
      t.is(entries.find(f => f.value.subject.userId === user.userId).value.subject.dbUrl, user.profile.dbUrl)
    }
  }

  testFollowers (t, followers, users) {
    t.is(followers.followerIds.length, users.length)
    for (let user of users) {
      t.truthy(followers.followerIds.includes(user.userId))
    }
  }

  listFollowers (user) {
    let followers = []
    for (let username in this.users) {
      if (this.users[username].following[user.userId]) {
        followers.push(this.users[username])
      }
    }
    return followers
  }

  testNotifications (t, entries, descs) {
    t.is(entries.length, descs.length)
    for (let i = 0; i < descs.length; i++) {
      const itemDesc = `notification ${i}`
      const entry = entries[i]
      const desc = descs[i]
      t.is(entry.author.userId, desc[0].userId, itemDesc)
      
      const {schemaId} = parseEntryUrl(entry.itemUrl)
      switch (desc[1]) {
        case 'follow':
          t.is(schemaId, 'ctzn.network/follow', itemDesc)
          t.is(entry.item.subject.dbUrl, desc[2].profile.dbUrl, itemDesc)
          t.is(entry.item.subject.userId, desc[2].userId, itemDesc)
          break
        case 'comment':
          t.is(schemaId, 'ctzn.network/comment', itemDesc)
          t.is(entry.item.text, desc[2].text, itemDesc)
          t.is(entry.item.subjectUrl, desc[2].subject.url, itemDesc)
          if (desc[2].parent) t.is(entry.item.parentCommentUrl, desc[2].parent.url, itemDesc)
          else t.falsy(entry.item.parentCommentUrl,itemDesc)
          break
        case 'upvote':
        case 'downvote':
          t.is(schemaId, 'ctzn.network/vote', itemDesc)
          t.is(entry.item.vote, desc[1] === 'upvote' ? 1 : -1, itemDesc)
          t.is(entry.item.subjectUrl, desc[2].url, itemDesc)
          break
      }
    }
  }
}

class TestUser {
  constructor (inst, username) {
    this.inst = inst
    this.username = username
    this.userId = undefined
    this.posts = []
    this.comments = []
    this.following = {}
    this.votes = {}
  }

  async setup () {
    const {userId} = await this.inst.db.createUser({
      username: this.username,
      email: `${this.username}@email.com`,
      profile: {
        displayName: this.username.slice(0, 1).toUpperCase() + this.username.slice(1)
      }
    })
    this.userId = userId
    this.profile = await this.inst.api.profiles.get(userId)
  }

  async login () {
    await this.inst.api.accounts.login({username: this.username, password: 'password'})
  }

  async createPost ({text}) {
    await this.login()
    this.posts.push(await this.inst.api.posts.create({text}))
  }

  async createComment ({text, subjectUrl, parentCommentUrl}) {
    await this.login()
    this.comments.push(await this.inst.api.comments.create({text, subjectUrl, parentCommentUrl}))
  }

  async follow (testUser) {
    await this.login()
    await this.inst.api.follows.follow(testUser.userId)
    this.following[testUser.userId] = testUser
  }

  async unfollow (testUser) {
    await this.login()
    await this.inst.api.follows.unfollow(testUser.userId)
    delete this.following[testUser.userId]
  }

  async vote ({subjectUrl, vote}) {
    await this.login()
    if (vote !== 0) {
      await this.inst.api.votes.put({subjectUrl, vote})
      this.votes[subjectUrl] = vote
    } else {
      await this.inst.api.votes.del(subjectUrl)
      delete this.votes[subjectUrl]
    }
  }

  async testSocialGraph (t, sim) {
    let follows = await this.inst.api.follows.listFollows(this.userId)
    sim.testFollows(t, follows, Object.values(this.following))
    let followers = await this.inst.api.follows.listFollowers(this.userId)
    sim.testFollowers(t, followers, sim.listFollowers(this))
  }
}