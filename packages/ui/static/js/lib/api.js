import { DEBUG_ENDPOINTS, BLOB_URL } from './const.js'
import { joinPath, parseUserId } from './strings.js'
import * as session from './session.js'
import * as toast from '../com/toast.js'

// exported api
// =

export class CtznAPI {
  constructor () {
    this.databases = {}
    this.views = {}
  }

  get user () {
    return this.db(session.info.userId)
  }

  get blob () {
    if (session.isActive()) {
      return session.api.blob
    }
  }

  async getBlobByHomeServer (userId, blobName) {
    const domain = getDomain(userId)
    if (session.isActive(domain)) {
      return session.api.blob.get(userId, blobName)
    }
    const req = await fetch(BLOB_URL(userId, blobName))
    const blob = await req.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = reject
      reader.onload = () => {
        resolve({buf: reader.result.split(',')[1]})
      }
      reader.readAsDataURL(blob)
    })
  }

  async lookupUser (userId) {
    const {domain} = parseUserId(userId)
    const origin = DEBUG_ENDPOINTS[domain] ? `http://${DEBUG_ENDPOINTS[domain]}/` : `https://${domain}/`
    const url = joinPath(origin, `.well-known/webfinger?resource=acct:${userId}`)
    const jrd = await (await fetch(url)).json()
    return {
      userId,
      dbUrl: jrd?.links?.find(l => l?.rel === 'self' && l?.href?.startsWith('hyper://'))?.href
    }
  }

  db (databaseId) {
    if (!this.databases[databaseId]) {
      this.databases[databaseId] = new CtznAPIDatabase(this, databaseId)
    }
    return this.databases[databaseId]
  }

  async view (viewId, ...args) {
    return session.api.view.get(viewId, ...args)
  }

  async viewByHomeServer (userId, viewId, ...args) {
    const domain = getDomain(userId)
    if (session.isActive(domain)) {
      return (await this.view(viewId, ...args))
    }
    // TODO views should move away from positional arguments
    if (args[0] && typeof args[0] !== 'object') {
      return (await httpGet(domain, `.view/${viewId}/${encodeURIComponent(args[0])}`, args[1]))
    }
    return (await httpGet(domain, `.view/${viewId}`, args[0]))
  }

  // getters
  // =
  
  async getProfile (userId) {
    const domain = getDomain(userId)
    if (session.isActive(domain)) {
      return this.view('ctzn.network/profile-view', userId)
    }
    return httpGet(domain, `.view/ctzn.network/profile-view/${encodeURIComponent(userId)}`)
  }
  
  async listUserFeed (userId, opts) {
    const domain = getDomain(userId)
    if (session.isActive(domain)) {
      return (await this.view('ctzn.network/posts-view', userId, opts))?.posts || []
    }
    return (await httpGet(domain, `.view/ctzn.network/posts-view/${encodeURIComponent(userId)}`, opts))?.posts || []
  }
  
  async getPost (userId, key) {
    const domain = getDomain(userId)
    if (session.isActive(domain)) {
      if (key.startsWith('hyper://')) {
        return this.view('ctzn.network/post-view', key)
      }
      return this.view('ctzn.network/post-view', userId, key)
    }
    const username = getUsername(userId)
    key = toKey(key)
    return httpGet(domain, `.view/ctzn.network/post-view/${username}/${encodeURIComponent(key)}`)
  }
  
  async getComment (userId, key) {
    const domain = getDomain(userId)
    if (session.isActive(domain)) {
      if (key.startsWith('hyper://')) {
        return this.view('ctzn.network/comment-view', key)
      }
      return this.view('ctzn.network/comment-view', userId, key)
    }
    const username = getUsername(userId)
    key = toKey(key)
    return httpGet(domain, `.view/ctzn.network/comment-view/${username}/${encodeURIComponent(key)}`)
  }
  
  async getThread (authorId, subjectUrl, communityId = undefined) {
    const domain = getDomain(communityId || authorId)
    if (session.isActive(domain)) {
      return (await this.view('ctzn.network/thread-view', subjectUrl))?.comments
    }
    return (await httpGet(domain, `.view/ctzn.network/thread-view/${encodeURIComponent(subjectUrl)}`))?.comments
  }

  async listAllMembers (userId) {
    let members = []
    let gt = undefined
    for (let i = 0; i < 1000; i++) {
      let m = await this.db(userId).table('ctzn.network/community-member').list({gt, limit: 100})
      members = m.length ? members.concat(m) : members
      if (m.length < 100) break
      gt = m[m.length - 1].key
    }
    return members
  }
  
  async listFollowers (userId) {
    const domain = getDomain(userId)
    if (session.isActive(domain)) {
      return (await this.view('ctzn.network/followers-view', userId))?.followers
    }
    let [mine, theirs] = await Promise.all([
      session.isActive(domain) ? this.view('ctzn.network/followers-view', userId) : undefined,
      httpGet(domain, `/.view/ctzn.network/followers-view/${encodeURIComponent(userId)}`).catch(e => undefined)
    ])
    if (!mine && !theirs) throw new Error('Failed to fetch any follower information')
    return union(mine?.followers, theirs?.followers)
  }
  
  async listOwnedItems (userId, opts = {}) {
    const domain = getDomain(userId)
    if (session.isActive(domain)) {
      return (await this.view('ctzn.network/owned-items-view', userId, opts))?.items
    }
    return (await httpGet(domain, `.view/ctzn.network/owned-items-view/${encodeURIComponent(userId)}`, opts))?.items
  }
  
  async getCommunityUserPermission (communityId, citizenId, permId) {
    const domain = getDomain(communityId)
    if (session.isActive(domain)) {
      return (await this.view('ctzn.network/community-user-permission-view', communityId, citizenId, permId))
    }
    const e = encodeURIComponent
    return (await httpGet(domain, `.view/ctzn.network/community-user-permission-view/${e(communityId)}/${e(citizenId)}/${e(permId)}`))
  }

  // utils
  // =

  listPendingCalls () {
    return readPendingCallsFromLS(this.api)
  }
  
  untrackPendingCall (call) {
    const calls = readPendingCallsFromLS(this.api)
    let i = calls.findIndex(c => c.__response.key === call.__response.key)
    if (i !== -1) calls.splice(i, 1)
    writeToLS(calls)
  }
}

class CtznAPIDatabase {
  constructor (api, databaseId) {
    this.api = api
    this.id = databaseId
    this.domain = getDomain(this.id)
    this.tables = {}
  }

  get useHTTP () {
    return !session.isActive(this.domain)
  }

  table (schemaId) {
    if (!this.tables[schemaId]) {
      this.tables[schemaId] = new CtznAPITable(this, schemaId)
    }
    return this.tables[schemaId]
  }

  async method (method, args, opts = undefined) {
    const res = await session.api.dbmethod.call({
      database: this.id,
      method,
      args,
      wait: false
    })
    if (res.result && res.result.code !== 'success') {
      throw new MethodCallError(method, res.result)
    }
    const wrappedRes = new CtznAPIDbmethodCall(this.api, res)
    if (wrappedRes.pending()) {
      trackPendingCall(this.api, wrappedRes)
      if (!opts?.quiet) {
        toast.create('Your request is being processed')
      }
    }
    return wrappedRes
  }
}

class CtznAPITable {
  constructor (db, schemaId) {
    this.db = db
    this.schemaId = schemaId
  }

  async list (opts) {
    if (this.db.useHTTP) {
      return (await httpGet(this.db.domain, `.table/${encodeURIComponent(this.db.id)}/${this.schemaId}`, opts))?.entries
    }
    return (await session.api.table.list(this.db.id, this.schemaId, opts))?.entries
  }

  async get (key) {
    if (this.db.useHTTP) {
      return (await httpGet(this.db.domain, `.table/${encodeURIComponent(this.db.id)}/${this.schemaId}/${encodeURIComponent(key)}`))
    }
    return session.api.table.get(this.db.id, this.schemaId, key)
  }

  async create (value) {
    return session.api.table.create(this.db.id, this.schemaId, value)
  }

  async update (key, value) {
    return session.api.table.update(this.db.id, this.schemaId, key, value)
  }

  async delete (key) {
    return session.api.table.delete(this.db.id, this.schemaId, key)
  }
}

class CtznAPIDbmethodCall {
  constructor (api, response) {
    this.api = api
    this.hydrate(response)
  }

  hydrate (response) {
    this.__response = response
    if (response?.result) {
      for (let k in response?.result) {
        this[k] = response?.result[k]
      }
    }
  }

  async checkResult ({wait, timeout} = {}) {
    if (!this.pending()) {
      return true
    }
    const res = await session.api.dbmethod.getResult({
      call: this.__response.key,
      wait,
      timeout
    })
    if (res) {
      this.hydrate(res)
      return true
    }
    return false
  }

  success () {
    return !this.failed() && !this.pending()
  }

  failed () {
    return !this.pending() && this.__response.result.code !== 'success'
  }

  pending () {
    return !this.__response.result
  }
}

// internal methods
// =

function trackPendingCall (api, call) {
  const calls = readPendingCallsFromLS(api)
  calls.push(call)
  writeToLS(calls)
}

function readPendingCallsFromLS (api) {
  let calls
  try { calls = JSON.parse(localStorage.getItem('pending-dbmethod-calls')) }
  catch (e) {}
  calls = calls && Array.isArray(calls) ? calls : []
  return calls.map(response => new CtznAPIDbmethodCall(api, response))
}

function writeToLS (calls) {
  localStorage.setItem('pending-dbmethod-calls', JSON.stringify(calls.map(c => c.__response), null, 2))
}

class MethodCallError extends Error {
  constructor (method, result) {
    super(result.details?.message || result.code)
    this.method = method
    this.code = result.code
    this.details = result.details
  }
}

function getDomain (userId) {
  return userId.split('@')[1] || userId
}

function getUsername (userId) {
  return userId.split('@')[0] || userId
}

function toKey (key) {
  if (key.startsWith('hyper://')) {
    return key.split('/').slice(-1)[0]
  }
  return key
}

async function httpGet (domain, path, query = undefined) {
  const origin = DEBUG_ENDPOINTS[domain] ? `http://${DEBUG_ENDPOINTS[domain]}/` : `https://${domain}/`
  let url = joinPath(origin, path)
  if (query) {
    query = Object.fromEntries(Object.entries(query).filter(([k, v]) => typeof v !== 'undefined'))
    url += '?' + (new URLSearchParams(query)).toString()
  }
  return (await fetch(url)).json()
}

function union (arr1 = [], arr2 = []) {
  const s = new Set(arr1.concat(arr2))
  return Array.from(s)
}