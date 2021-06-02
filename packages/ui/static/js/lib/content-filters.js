export const IDs = ['Satire', 'Maybe wrong', 'Unverified', 'Politics', 'Upsetting', 'NSFW']
export const DEFAULT_FILTERED_IDs = ['Upsetting', 'NSFW']

export function isFiltered (id) {
  return get().includes(id)
}

export function isAnyFiltered (ids) {
  return !!get().find(id => ids.includes(id))
}

export function toggle (id) {
  const arr = get()
  if (arr.includes(id)) arr.splice(arr.indexOf(id), 1)
  else arr.push(id)
  set(arr)
}

function get () {
  try {
    return JSON.parse(localStorage.getItem('content-filters')) || DEFAULT_FILTERED_IDs
  } catch (e) {
    return []
  }
}

function set (v) {
  localStorage.setItem('content-filters', JSON.stringify(v))
}