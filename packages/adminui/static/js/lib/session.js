import { create as createApi } from '../../vendor/ctzn-api-client.js'

export let api = createApi()
export let info = undefined

let isSetup = false
export async function setup () {
  if (isSetup) return
  isSetup = true
  window.api = api
  api.session.onChange(() => {info = api.session.info})
  await api.session.setup()
}

export function isActive () {
  return api.session.isActive()
}

export function onChange (cb) {
  return api.session.onChange(cb)
}
