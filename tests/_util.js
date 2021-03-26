import { Client as WsClient } from 'rpc-websockets'
import tmp from 'tmp-promise'
import { parseEntryUrl, DEBUG_MODE_PORTS_MAP } from '../lib/strings.js'
import { spawn } from 'child_process'
import * as path from 'path'
import { fileURLToPath } from 'url'

const INSPECTOR_ENABLED = false

let nServer = 1
export async function createServer (extensions = '') {
  const tmpdir = await tmp.dir({unsafeCleanup: true})
  const domain = `dev${nServer++}.localhost`
  const port = DEBUG_MODE_PORTS_MAP[domain]
  console.log('Storing config in', tmpdir.path)

  const binPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin.js')
  const serverProcess = spawn(
    'node',
    [binPath, 'start-test', '--configDir', tmpdir.path, '--domain', domain, '--extensions', extensions || ''],
    {
      stdio: [process.stdin, process.stdout, process.stderr],
      env: INSPECTOR_ENABLED ? Object.assign({}, process.env, {NODE_OPTIONS: `--inspect=localhost:${5555+nServer}`}) : undefined
    }
  )

  const client = new WsClient(`ws://localhost:${port}/`)
  const api = await createRpcApi(client)
  await api.debug.whenServerReady()

  return {
    url: `http://localhost:${port}/`,
    domain,
    serverUserId: `server@${domain}`,
    client,
    api,
    process: serverProcess,
    close: async () => {
      const p = new Promise(r => {
        if (serverProcess.exitCode !== null) r()
        serverProcess.on('exit', r)
      })
      serverProcess.kill()
      await p
      await tmpdir.cleanup()
    }
  }
}

async function createRpcApi (ws) {
  await new Promise(resolve => ws.on('open', resolve))

  return new Proxy({url: ws.address}, {
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

  async createCitizen (inst, username) {
    const user = new TestCitizen(inst, username)
    await user.setup()
    this.users[username] = user
    return user
  }

  async createCommunity (inst, username) {
    const user = new TestCommunity(inst, username)
    await user.setup()
    this.users[username] = user
    return user
  }

  async dbmethod (inst, database, method, args) {
    var res = await inst.api.dbmethod.call({database, method, args})
    if (res.result.code !== 'success') {
      throw new Error(res.result.details?.message || res.result.code)
    }
    return res
  }

  testFeed (t, entries, desc) {
    t.is(entries.length, desc.length)
    for (let i = 0; i < desc.length; i++) {
      this.testPost(t, entries[i], desc[i])
    }
  }

  testPost (t, entry, desc) {
    const user = desc[0]
    t.truthy(entry.url.startsWith(user.profile.dbUrl))
    t.is(entry.author.userId, user.userId)
    t.is(entry.value.text, desc[1])
  }

  testComment (t, entry, desc, reply) {
    const user = desc[0]
    t.truthy(entry.url.startsWith(user.profile.dbUrl))
    t.is(entry.author.userId, user.userId)
    t.is(entry.value.text, desc[1])
    t.is(entry.value.reply.root.dbUrl, reply.root.url)
    if (reply.parent) t.is(entry.value.reply.parent.dbUrl, reply.parent.url)
  }

  testThread (t, entries, descs) {
    t.is(entries.length, descs.length, `expected ${descs.length} entries\n${threadDescToString(descs)}`)
    for (let i = 0; i < descs.length; i++) {
      this.testThreadItem(t, entries[i], descs[i])
    }
  }

  testThreadItem (t, entry, desc) {
    const user = desc[0]
    t.truthy(entry.url.startsWith(user.profile.dbUrl), `expected comment to be authored by ${user.userId}\n${commentDescToString(desc)}`)
    t.is(entry.author.userId, user.userId, `expected author userId to be ${user.userId}\n${commentDescToString(desc)}`)
    t.is(entry.value.text, desc[1], `expected comment text to be ${desc[1]}\n${commentDescToString(desc)}`)

    if (desc[2] && desc[2].length) {
      this.testThread(t, entry.replies, desc[2])
    }
  }

  testFollows (t, entries, users) {
    t.is(entries.length, users.length, `expected ${users.length} follows ${users.map(u=>u.userId).join(', ')} got ${entries.map(e=>e.value.subject.userId).join(', ')}`)
    for (let user of users) {
      t.is(
        entries.find(f => f.value.subject.userId === user.userId).value.subject.dbUrl,
        user.profile.dbUrl,
        `expected to be following ${user.userId}`
      )
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

  get allPosts () {
    return Object.values(this.users).map(user => user.posts).flat()
  }

  get allComments () {
    return Object.values(this.users).map(user => user.comments).flat()
  }

  get allSubjects () {
    return [this.allPosts, this.allComments].flat()
  }

  getRandomSubject () {
    const subjects = this.allSubjects
    return subjects[randRange(0, subjects.length - 1)]
  }

  getRandomPost () {
    const posts = this.allPosts
    return posts[randRange(0, posts.length - 1)]
  }

  async getRandomParentFor (inst, post) {
    if (randRange(0, 1) === 0) return undefined // 1/2 chance of no parent
    if (Array.isArray(inst)) {
      inst = inst[randRange(0, inst.length - 1)]
    }
    let comments = flattenThread((await inst.api.view.get('ctzn.network/thread-view', post.url)).comments)
    return comments[randRange(0, comments.length - 1)]
  }

  getExpectedHomeFeedUrls (user) {
    let users = [user].concat(Object.values(user.following))
    let posts = users.map(user => user.posts).flat()
    posts.sort((a, b) => (new Date(b.value.createdAt)) - (new Date(a.value.createdAt)))
    return posts.map(p => p.url)
  }

  getExpectedUserFeedUrls (user) {
    return user.posts.slice().map(p => p.url)
  }

  getExpectedReactorIds (subject, reaction) {
    var ids = []
    for (let username in this.users) {
      if (this.users[username].reactions[subject.url][reaction]) {
        ids.push(this.users[username].userId)
      }
    }
    return ids
  }

  getThread (post, filterFn) {
    const comments = this.allComments.filter(c => {
      return (c.value.subject.dbUrl === post.url && (!filterFn || filterFn(c)))
    })
    return commentEntriesToThread(comments) || []
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
          t.is(entry.item.reply.root.dbUrl, desc[2].reply.root.url, itemDesc)
          if (desc[2].reply.parent) t.is(entry.item.reply.parent.dbUrl, desc[2].reply.parent.url, itemDesc)
          else t.falsy(entry.item.reply.parent, itemDesc)
          break
        case 'reaction':
          t.is(schemaId, 'ctzn.network/reaction', itemDesc)
          t.is(entry.item.reaction, desc[3], itemDesc)
          t.is(entry.item.subject.dbUrl, desc[2].url, itemDesc)
          break
      }
    }
  }
}

class TestCitizen {
  constructor (inst, username) {
    this.inst = inst
    this.username = username
    this.userId = undefined
    this.dbUrl = undefined
    this.posts = []
    this.comments = []
    this.following = {}
    this.reactions = {}
  }

  get replies () {
    return this.comments.filter(p => !!p.value.reply)
  }

  async setup () {
    const {userId, dbUrl} = await this.inst.api.debug.createUser({
      type: 'citizen',
      username: this.username,
      email: `${this.username}@email.com`,
      password: 'password',
      profile: {
        displayName: this.username.slice(0, 1).toUpperCase() + this.username.slice(1)
      }
    })
    this.userId = userId
    this.dbUrl = dbUrl
    this.profile = await this.inst.api.view.get('ctzn.network/profile-view', userId)
  }

  async login () {
    await this.inst.api.accounts.login({username: this.username, password: 'password'})
  }

  async createPost ({text, extendedText, community}) {
    await this.login()
    const {url} = await this.inst.api.table.create(
      this.userId,
      'ctzn.network/post',
      {text, extendedText, community, createdAt: (new Date()).toISOString()}
    )
    this.posts.push(await this.inst.api.view.get('ctzn.network/post-view', url))
    return this.posts[this.posts.length - 1]
  }

  async createComment ({text, community, reply}) {
    await this.login()
    if (reply) {
      reply.root = {dbUrl: reply.root.url, authorId: reply.root.author.userId}
      if (reply.parent) {
        reply.parent = {dbUrl: reply.parent.url, authorId: reply.parent.author.userId}
      }
    }
    const {url} = await this.inst.api.table.create(
      this.userId,
      'ctzn.network/comment',
      {text, community, reply}
    )
    this.comments.push(await this.inst.api.view.get('ctzn.network/comment-view', url))
    return this.comments[this.comments.length - 1]
  }

  async follow (testCitizen) {
    await this.login()
    await this.inst.api.table.create(this.userId, 'ctzn.network/follow', {
      subject: {
        userId: testCitizen.userId,
        dbUrl: testCitizen.dbUrl
      }
    })
    this.following[testCitizen.userId] = testCitizen
  }

  async unfollow (testCitizen) {
    await this.login()
    await this.inst.api.table.delete(this.userId, 'ctzn.network/follow', testCitizen.userId)
    delete this.following[testCitizen.userId]
  }

  async react ({subject, reaction}) {
    await this.login()
    await this.inst.api.table.create(
      this.userId,
      'ctzn.network/reaction',
      {
        subject: {dbUrl: subject.url, authorId: subject.author.userId},
        reaction
      }
    )
    this.reactions[subject.url] = this.reactions[subject.url] || {}
    this.reactions[subject.url][reaction] = true
  }

  async unreact ({subject, reaction}) {
    await this.login()
    await this.inst.api.table.delete(this.userId, 'ctzn.network/reaction', `${reaction}:${subject.url}`)
    delete this.reactions[subject.url][reaction]
  }
}

class TestCommunity {
  constructor (inst, username) {
    this.inst = inst
    this.username = username
    this.userId = undefined
    this.members = {}
  }

  async setup () {
    const {userId} = await this.inst.api.communities.create({
      username: this.username,
      displayName: this.username.slice(0, 1).toUpperCase() + this.username.slice(1)
    })
    this.userId = userId
    this.profile = await this.inst.api.view.get('ctzn.network/profile-view', userId)
  }
}

export function randRange (min, max) {
  min = Math.ceil(min)
  max = Math.floor(max)
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function flattenThread (thread, comments = []) {
  for (let comment of thread) {
    comments.push(comment)
    if (comment.replies?.length) {
      flattenThread(comment.replies, comments)
    }
  }
  return comments
}

function commentEntriesToThread (commentEntries) {
  commentEntries = JSON.parse(JSON.stringify(commentEntries)) // deep clone

  const commentEntriesByUrl = {}
  commentEntries.forEach(commentEntry => { commentEntriesByUrl[commentEntry.url] = commentEntry })

  const rootCommentEntries = []
  commentEntries.forEach(commentEntry => {
    if (commentEntry.value.reply?.parent) {
      let parent = commentEntriesByUrl[commentEntry.value.reply.parent.dbUrl]
      if (!parent) {
        commentEntry.isMissingParent = true
        rootCommentEntries.push(commentEntry)
        return
      }
      if (!parent.replies) {
        parent.replies = []
        parent.replyCount = 0
      }
      parent.replies.push(commentEntry)
      parent.replyCount++
    } else {
      rootCommentEntries.push(commentEntry)
    }
  })
  return rootCommentEntries
}

function threadDescToString (descs, prefix = '') {
  let items = []
  for (let desc of descs) {
    items.push(`${prefix}${desc[0].userId} ${desc[1]}`)
    if (desc[2]) items = items.concat(threadDescToString(desc[2], `  ${prefix}`))
  }
  return items.join('\n')
}

function commentDescToString (desc, prefix = '') {
  let items = []
  items.push(`${prefix}${desc[0].userId} ${desc[1]}`)
  if (desc[2]) items = items.concat(threadDescToString(desc[2], `  ${prefix}`))
  return items.join('\n')
}
