import { BasePopup } from '../com/popups/base.js'

// we put the constants on window so that mobile debuggers can tweak the values
window.SWIPE_VEL_THRESH = 0.5
window.SWIPE_X_THRESH = 60
window.SWIPE_XN_THRESH = 2
window.SWIPE_Y_MAX = 500
window.SWIPE_TS_MAX = 1000
window.SWIPE_LOG = false

// globals
// =

let currentNav = undefined

// exported api
// =

export const events = new EventTarget()

export function setup () {
  let handling = false
  let touchstartTs = undefined
  let touchstartX = 0
  let touchstartY = 0
  function onTouchMove (e) {
    let diffX = e.changedTouches[0].screenX - touchstartX
    let diffTs = Date.now() - touchstartTs
    let velX = diffX / diffTs
    events.dispatchEvent(new CustomEvent('swiping', {detail: {diffX, pct: velX / window.SWIPE_VEL_THRESH}}))
  }
  function onCancel () {
    events.dispatchEvent(new CustomEvent('swiping', {detail: {diffX: 0, pct: 0}}))
  }
  document.body.addEventListener('touchstart', e => {
    for (let el of e.composedPath()) {
      if (el.scrollWidth > el.offsetWidth) {
        return
      }
    }
    
    if (e.changedTouches.length !== 1) {
      return // multiple fingers, probably a pinch, abort abort abort
    }
    handling = true
    touchstartX = e.changedTouches[0].screenX
    touchstartY = e.changedTouches[0].screenY
    touchstartTs = Date.now()
    document.body.addEventListener('touchmove', onTouchMove)
  }, false)
  document.body.addEventListener('touchend', e => {
    document.body.removeEventListener('touchmove', onTouchMove)
    if (!handling) return
    handling = false

    let touchendX = e.changedTouches[0].screenX
    let touchendY = e.changedTouches[0].screenY
    let diffX = touchendX - touchstartX
    let diffY = touchendY - touchstartY
    let diffXNormalized = diffX / Math.abs(diffY + 1)
    let diffTs = Date.now() - touchstartTs
    let velX = diffX / diffTs
    let velY = diffY / diffTs
    if (window.SWIPE_LOG) {
      console.log({diffX, diffY, diffXNormalized, diffTs})
      console.log({velX, velY})
    }
    if (Math.abs(velY) > window.SWIPE_VEL_THRESH) {
      return onCancel()
    }
    if (Math.abs(velX) > window.SWIPE_VEL_THRESH) {
      if (diffX > 0) {
        events.dispatchEvent(new Event('swipe-right'))
        moveNav(-1)
        onCancel()
        return
      } else if (diffX < 0) {
        events.dispatchEvent(new Event('swipe-left'))
        moveNav(1)
        onCancel()
        return
      }
    }
    onCancel()

    /*if (diffTs > window.SWIPE_TS_MAX) {
      return onCancel()
    }
    if (Math.abs(diffY) < window.SWIPE_Y_MAX) {
      if (diffX > (window.SWIPE_X_THRESH) && diffXNormalized > (window.SWIPE_XN_THRESH)) {
        events.dispatchEvent(new Event('swipe-right'))
        moveNav(-1)
        return
      } else if (diffX < -1 * (window.SWIPE_X_THRESH) && diffXNormalized < -1 * (window.SWIPE_XN_THRESH)) {
        events.dispatchEvent(new Event('swipe-left'))
        moveNav(1)
        return
      }
    }
    onCancel()*/
  }, false)
}

export function setCurrentNav (nav) {
  const oldNav = currentNav
  currentNav = nav
  return oldNav
}

// internal methods
// =

function moveNav (dir) {
  if (typeof currentNav === 'function') {
    currentNav(dir)
    return
  }

  if (BasePopup.getActive()) {
    if (BasePopup.getActive().shouldCloseOnOuterClick) {
      BasePopup.destroy()
    }
    return
  }

  if (!currentNav) return
  const item = currentNav[getCurrentNavPosition() + dir]
  if (item?.back) {
    if (window.history.length > 1) {
      window.history.back()
    } else {
      document.body.dispatchEvent(new CustomEvent('navigate-to', {detail: {url: '/', replace: true}}))
    }
  } else if (item) {
    document.body.dispatchEvent(new CustomEvent('navigate-to', {detail: {url: item, replace: true}}))
  } else if (dir === -1) {
    document.body.dispatchEvent(new CustomEvent('open-main-menu'))
  }
}

function getCurrentNavPosition () {
  if (!currentNav) return
  const i = currentNav.indexOf(location.pathname)
  if (i === -1) return 0
  return i
}