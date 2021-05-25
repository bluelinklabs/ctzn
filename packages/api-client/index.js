const isBrowser = typeof window !== 'undefined'

export function createApi ({origin, fetch, arrayBufferToBuffer, Blob, FormData}) {
  let cookies = {} // node-fetch requires us to track cookies manually
  let emitter = new EventTarget()

  const url = (path, query) => {
    const u = new URL(`/_api/${path}`, origin)
    if (query) {
      for (let k in query) {
        if (typeof query[k] !== 'undefined') {
          u.searchParams.set(k, query[k])
        }
      }
    }
    return u
  }
  
  const buildHeaders = (obj = {}) => {
    if (!isBrowser) {
      obj.Cookie = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ')
    }
    return obj
  }

  const setCookies = isBrowser ? noop : (res) => {
    const setCookie = res.headers.raw()['set-cookie']
    if (setCookie) {
      setCookie.forEach(str => {
        let kv = str.split('; ')[0]
        let [k, v] = kv.split('=')
        cookies[k] = v
      })
    }
  }

  const api = {
    // base HTTP api
    // =

    async get (path, query) {
      const res = await fetch(url(path, query), {
        headers: buildHeaders()
      })
      const resbody = await res.json()
      if (!res.ok || resbody.error) {
        throw new Error(resbody.message || res.statusText || res.status)
      }
      setCookies(res)
      return resbody
    },

    async getBuf (path, query) {
      const res = await fetch(url(path, query), {
        headers: buildHeaders()
      })
      if (!res.ok) {
        throw new Error(res.statusText || res.status)
      }
      setCookies(res)
      return arrayBufferToBuffer(await res.arrayBuffer())
    },

    async post (path, body) {
      const res = await fetch(url(path), {
        method: 'POST',
        headers: buildHeaders({'Content-Type': 'application/json'}),
        body: JSON.stringify(body || {})
      })
      const resbody = await res.json()
      if (!res.ok || resbody.error) {
        throw new Error(resbody.message || res.statusText || res.status)
      }
      setCookies(res)
      return resbody
    },

    async postMultipart (path, parts) {
      const formData = new FormData()
      for (let k in parts) {
        formData.append(k, parts[k], k)
      }
      const headers = isBrowser ? undefined : formData.headers
      const res = await fetch(url(path), {
        method: 'POST',
        headers: buildHeaders(headers),
        body: isBrowser ? formData : FormData.toStream(formData)
      })
      const resbody = await res.json()
      if (!res.ok || resbody.error) {
        throw new Error(resbody.message || res.statusText || res.status)
      }
      setCookies(res)
      return resbody
    },

    async put (path, body) {
      const res = await fetch(url(path), {
        method: 'PUT',
        headers: buildHeaders({'Content-Type': 'application/json'}),
        body: JSON.stringify(body || {})
      })
      const resbody = await res.json()
      if (!res.ok || resbody.error) {
        throw new Error(resbody.message || res.statusText || res.status)
      }
      setCookies(res)
      return resbody
    },

    async putBuf (path, body, mimeType) {
      if (typeof body === 'string') {
        body = await base64ToBufferAsync(body)
      }
      const res = await fetch(url(path), {
        method: 'PUT',
        headers: buildHeaders({'Content-Type': mimeType}),
        body
      })
      const resbody = await res.json()
      if (!res.ok || resbody.error) {
        throw new Error(resbody.message || res.statusText || res.status)
      }
      setCookies(res)
      return resbody
    },

    async delete (path) {
      const res = await fetch(url(path), {
        method: 'DELETE',
        headers: buildHeaders()
      })
      const resbody = await res.json()
      if (!res.ok || resbody.error) {
        throw new Error(resbody.message || res.statusText || res.status)
      }
      setCookies(res)
      return resbody
    },

    // higher level methods
    // =

    async method (path, params) {
      return api.post(`method/${path}`, params)
    },

    view: {
      async get (path, params) {
        return api.get(`view/${path}`, params)
      }
    },

    table: {
      async list (dbId, schemaId, opts) {
        return api.get(`table/${dbId}/${schemaId}`, opts)
      },
      async get (dbId, schemaId, key) {
        return api.get(`table/${dbId}/${schemaId}/${encodeURIComponent(key)}`)
      },
      async create (dbId, schemaId, value) {
        return api.post(`table/${dbId}/${schemaId}`, value)
      },
      async createWithBlobs (dbId, schemaId, value, blobs) {
        const parts = {
          value: new Blob([JSON.stringify(value)], {type: 'application/json'})
        }
        for (let k in blobs) {
          parts[k] = new Blob([await base64ToBufferAsync(blobs[k].base64buf)], {type: blobs[k].mimeType})
        }
        return api.postMultipart(`table/${dbId}/${schemaId}`, parts)
      },
      async update (dbId, schemaId, key, value) {
        return api.put(`table/${dbId}/${schemaId}/${encodeURIComponent(key)}`, value)
      },
      async delete (dbId, schemaId, key) {
        return api.delete(`table/${dbId}/${schemaId}/${encodeURIComponent(key)}`)
      },
      async getBlob (dbId, schemaId, key, blobName) {
        return api.getBuf(`table/${dbId}/${schemaId}/${encodeURIComponent(key)}/blobs/${blobName}`)
      },
      async putBlob (dbId, schemaId, key, blobName, buf, mimeType) {
        return api.putBuf(`table/${dbId}/${schemaId}/${encodeURIComponent(key)}/blobs/${blobName}`, buf, mimeType)
      },
      async delBlob (dbId, schemaId, key, blobName) {
        return api.delete(`table/${dbId}/${schemaId}/${encodeURIComponent(key)}/blobs/${blobName}`)
      }
    },

    // db() accessor
    // =

    db (dbId) {
      return {
        id: dbId,
        table (schemaId) {
          return {
            async list (opts) {
              return api.table.list(dbId, schemaId, opts)
            },
            async get (key) {
              return api.table.get(dbId, schemaId, key)
            },
            async create (value) {
              return api.table.create(dbId, schemaId, value)
            },
            async createWithBlobs (value, blobs) {
              return api.table.createWithBlobs(dbId, schemaId, value, blobs)
            },
            async update (key, value) {
              return api.table.update(dbId, schemaId, key, value)
            },
            async delete (key) {
              return api.table.delete(dbId, schemaId, key)
            },
            async getBlob (key, blobName) {
              return api.table.getBlob(dbId, schemaId, key, blobName)
            },
            async putBlob (key, blobName, buf, mimeType) {
              return api.table.putBlob(dbId, schemaId, key, blobName, buf, mimeType)
            },
            async delBlob (key, blobName) {
              return api.table.delBlob(dbId, schemaId, key, blobName)
            }
          }
        }
      }
    },

    // session management
    // =

    get user () {
      if (api.session.isActive()) {
        return api.db(api.session.info.username)
      }
      return undefined
    },

    session: {
      info: undefined,

      isActive () {
        return !!api.session.info
      },

      onChange (cb, opts) {
        emitter.addEventListener('change', cb, opts)
      },

      async setup () {
        try {
          let info
          try {
            info = JSON.parse(localStorage.getItem('session-info')) || undefined
          } catch (e) {}
          if (!info?.hasSession) {
            info = await api.method('ctzn.network/methods/whoami')
          }
          if (info?.hasSession) {
            api.session.info = info
          }
          emitter.dispatchEvent(new Event('change'))
        } catch (e) {
          console.log('Failed to setup session')
          console.log(e)
        }
      },

      async login ({username, password}) {
        const newSessionInfo = await api.method('ctzn.network/methods/login', {username, password})
        if (newSessionInfo) {
          localStorage.setItem('session-info', JSON.stringify(newSessionInfo))
          api.session.info = newSessionInfo
          emitter.dispatchEvent(new Event('change'))
        }
        return newSessionInfo
      },

      async logout () {
        if (api.session.info) {
          await api.method('ctzn.network/methods/logout').catch(e => undefined) // ignore failures, we'll just abandon the session
        }
        localStorage.removeItem('session-info')
        api.session.info = undefined
        emitter.dispatchEvent(new Event('change'))
      },

      async signup ({username, displayName, description, avatar, email, password}) {
        const newSessionInfo = await api.method('ctzn.network/methods/register', {
          username,
          displayName,
          description,
          email,
          password
        })
        if (newSessionInfo) {
          localStorage.setItem('session-info', JSON.stringify(newSessionInfo))
          api.session.info = newSessionInfo
          emitter.dispatchEvent(new Event('change'))
        }
        return newSessionInfo
      },

      async requestPasswordChangeCode ({username}) {
        await api.method('ctzn.network/methods/request-password-change-code', {username})
      },

      async changePassword ({username, code, newPassword}) {
        await api.method('ctzn.network/methods/change-password', {username, code, newPassword})
      }
    },

    // sugars
    // =

    async getProfile (dbId) {
      return api.view.get('ctzn.network/views/profile', {dbId})
    },
    
    async listUserFeed (dbId, opts = {}) {
      return (await api.view.get('ctzn.network/views/posts', {dbId, ...opts}))?.posts || []
    },
    
    async getPost (dbId, postKey) {
      if (!postKey && dbId.startsWith('hyper://')) {
        return api.view.get('ctzn.network/views/post', {dbUrl: dbId})
      }
      return api.view.get('ctzn.network/views/post', {dbId, postKey})
    },
    
    async getComment (dbId, commentKey) {
      if (!commentKey && dbId.startsWith('hyper://')) {
        return api.view.get('ctzn.network/views/comment', {dbUrl: dbId})
      }
      return api.view.get('ctzn.network/views/comment', {dbId, commentKey})
    },
    
    async getThread (dbUrl) {
      return (await api.view.get('ctzn.network/views/thread', {dbUrl}))?.comments
    },
    
    async listFollowers (dbId) {
      return (await api.view.get('ctzn.network/views/followers', {dbId}))?.followers
    }
  }

  return api
}

function noop () {}
 
function base64ToBufferAsync (base64) {
  if (typeof fetch !== 'undefined') {
    var dataUrl = "data:application/octet-binary;base64," + base64;
    return fetch(dataUrl).then(res => res.arrayBuffer())
  }
  return Buffer.from(base64, 'base64')
}