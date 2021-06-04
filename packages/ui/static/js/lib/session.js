import { create as createApi } from '../../vendor/ctzn-api-client.js'

let emitter = new EventTarget()
export let myCommunities = undefined
export let myFollowers = undefined
export let myFollowing = undefined
export let api = createApi()
export let info = undefined

export async function setup () {
  window.api = api
  api.session.onChange(() => {info = api.session.info})
  await api.session.setup()
  loadSecondaryState()
}

export async function loadSecondaryState () {
  if (!api.session.isActive()) {
    return
  }
  let [profile, followers, follows] = await Promise.all([
    api.user.table('ctzn.network/profile').get('self').catch(e => {}),
    api.view.get('ctzn.network/views/followers', {dbId: api.session.info.username}).catch(e => []),
    api.user.table('ctzn.network/follow').list().catch(e => [])
  ])
  myCommunities = profile.value?.communities || []
  myFollowers = followers?.followers
  myFollowing = follows?.entries?.map(e => e.value.subject.dbKey) || []
  emitter.dispatchEvent(new Event('secondary-state'))
}

export function isActive () {
  return api.session.isActive()
}

export function isFollowingMe (dbKey) {
  if (api.session.info?.dbKey === dbKey) return true
  return !!myFollowers?.includes?.(dbKey)
}

export function onChange (cb) {
  return api.session.onChange(cb)
}

export function onSecondaryState (cb, opts) {
  emitter.addEventListener('secondary-state', cb, opts)
}

export function unOnSecondaryState (cb) {
  emitter.removeEventListener('secondary-state', cb)
}

export async function modifyProfile (cb) {
  const profile = await api.user.table('ctzn.network/profile').get('self').catch(e => {})
  const v = cb(profile.value || {})
  await api.user.table('ctzn.network/profile').create(v)
}