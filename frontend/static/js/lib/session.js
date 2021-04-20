import { create as createRpcApi } from './rpc-api.js'
import * as toast from '../com/toast.js'

let emitter = new EventTarget()
export let info = undefined
export let api = undefined

export async function setup () {
  if (isActive()) return
  
  let oldSessionInfo
  try {
    oldSessionInfo = JSON.parse(localStorage.getItem('session-info'))
    if (!oldSessionInfo) return emitter.dispatchEvent(new Event('change'))

    const newApi = await connectApi()
    
    const newSessionInfo = await newApi.accounts.resumeSession(oldSessionInfo.sessionId)
    if (newSessionInfo) {
      info = Object.assign(oldSessionInfo, newSessionInfo)
      console.debug('Resumed session')
      localStorage.setItem('session-info', JSON.stringify(info))
      api = newApi
      emitter.dispatchEvent(new Event('change'))
    } else {
      throw new Error('Session not found')
    }
  } catch (e) {
    if (e.toString().includes('Connection failed')) {
      toast.create(`Failed to connect to your server at ${oldSessionInfo.domain}`, 'error')
    }
    console.error('Failed to resume API session')
    console.error(e)
    emitter.dispatchEvent(new Event('change'))
  }

  // DEBUG
  window.api = api
}

export async function doLogin ({username, password}) {
  const newApi = await connectApi()
  const newSessionInfo = await newApi.accounts.login({username, password})
  if (newSessionInfo) {
    // override a couple items to be safe
    newSessionInfo.username = username

    localStorage.setItem('session-info', JSON.stringify(newSessionInfo))
    info = newSessionInfo
    api = newApi
    emitter.dispatchEvent(new Event('change'))
  }
  return newSessionInfo
}

export async function doLogout () {
  if (info && api) {
    await api.accounts.logout().catch(e => undefined) // ignore failures, we'll just abandon the session
  }
  localStorage.removeItem('session-info')
  info = undefined
  api = undefined
  emitter.dispatchEvent(new Event('change'))
}

export function hasOneSaved () {
  return !!localStorage.getItem('session-info')
}

export function getSavedInfo () {
  return JSON.parse(localStorage.getItem('session-info'))
}

export function isActive () {
  if (!info || !api) return false
  return true
}

export function onChange (cb, opts) {
  emitter.addEventListener('change', cb, opts)
}

let _sessionRecoverPromise = undefined
async function connectApi () {
  let wsEndpoint = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.hostname}:${location.port}/`
  return createRpcApi(wsEndpoint, async () => {
    if (_sessionRecoverPromise) return _sessionRecoverPromise
    if (api && hasOneSaved()) {
      // we still have a saved session, try to resume again
      _sessionRecoverPromise = new Promise(async (resolve) => {
        const newSessionInfo = await api.accounts.resumeSession(info.sessionId).catch(e => undefined)
        if (newSessionInfo) {
          Object.assign(info, newSessionInfo)
          console.debug('Recovered session')
          localStorage.setItem('session-info', JSON.stringify(info))
          resolve(true)
        } else {
          resolve(false)
        }
        _sessionRecoverPromise = undefined
      })
      return _sessionRecoverPromise
    }
  })
}

// DEBUG
window.doLogin = doLogin
window.doLogout = doLogout