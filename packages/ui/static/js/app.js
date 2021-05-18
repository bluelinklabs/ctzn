import { LitElement, html } from '../vendor/lit/lit.min.js'
import PullToRefresh from '../vendor/pulltorefreshjs/index.js'
import * as session from './lib/session.js'
import { emit } from './lib/dom.js'
import * as gestures from './lib/gestures.js'
import * as toast from './com/toast.js'
import * as contextMenu from './com/context-menu.js'
import { DRIVE_KEY_REGEX } from './lib/strings.js'
import { BasePopup } from './com/popups/base.js'
import './com/header.js'
import './views/account.js'
import './views/communities.js'
import './views/forgot-password.js'
import './views/main.js'
import './views/notifications.js'
import './views/post.js'
import './views/page.js'
import './views/signup.js'
import './views/topic.js'
import './views/user.js'

const PAGE_PATH_REGEX = new RegExp('/([^/]+@[^/]+)/ctzn.network/page/([^/]+)', 'i')
const POST_PATH_REGEX = new RegExp('/([^/]+@[^/]+)/ctzn.network/post/([^/]+)', 'i')
const COMMENT_PATH_REGEX = new RegExp('/([^/]+@[^/]+)/ctzn.network/comment/([^/]+)', 'i')
const TOPIC_PATH_REGEX = new RegExp('/topic/([^/]+)')
const USER_PATH_REGEX = new RegExp('/([^/]+@[^/]+)')
const USER_PAGE_REGEX = new RegExp('^/([^/]+@[^/]+)/([^/]+)$')

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    /*
    TODO - disabled until we can get caching to work correctly
    navigator.serviceWorker
      .register('/service-worker.js')
      .catch(console.error)
    */
    const registration = await navigator.serviceWorker.getRegistration('/')
    if (registration) {
      await registration.unregister()
    }
  })
}

class CtznApp extends LitElement {
  static get properties () {
    return {
      currentPath: {type: String},
      isLoading: {type: Boolean}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()

    this.isLoading = true
    this.pageHasChanges = false
    this.currentPath = window.location.pathname

    // "cached view" helper state
    this.hasVisitedHome = false
    this.hasVisitedNotifications = false
    this.lastUserPath = undefined

    gestures.setup()
    this.setGestureNav()
    
    document.body.addEventListener('click', this.onGlobalClick.bind(this))
    document.body.addEventListener('view-thread', this.onViewThread.bind(this))
    document.body.addEventListener('navigate-to', this.onNavigateTo.bind(this))
    document.body.addEventListener('delete-post', this.onDeletePost.bind(this))
    document.body.addEventListener('moderator-remove-post', this.onModeratorRemovePost.bind(this))
    window.addEventListener('popstate', this.onHistoryPopstate.bind(this))
    window.addEventListener('beforeunload', this.onBeforeUnload.bind(this))

    this.load()
  }

  async load () {
    try {
      await session.setup()
    } finally {
      this.isLoading = false
      await this.updateComplete
      this.querySelector('#view')?.load?.()
    }
  }

  updated (changedProperties) {
    if (changedProperties.has('currentPath')) {
      this.querySelector('#view')?.load?.()
    }
  }

  connectedCallback () {
    super.connectedCallback()
    this.ptr = PullToRefresh.init({
      mainElement: 'body',
      onRefresh: async (done) => {
        await this.querySelector('#view')?.refresh?.()
        done()
      }
    })
  }

  disconnectedCallback (...args) {
    super.disconnectedCallback(...args)
    PullToRefresh.destroyAll()
  }

  navigateTo (pathname, replace = false) {
    if (this.pageHasChanges) {
      if (!confirm('Lose unsaved changes?')) {
        return
      }
    }
    this.pageHasChanges = false

    contextMenu.destroy()
    BasePopup.destroy()
    
    if (history.scrollRestoration) {
      history.scrollRestoration = 'manual'
    }

    if (replace) {
      window.history.replaceState({}, null, pathname)
    } else {
      window.history.replaceState({scrollY: window.scrollY}, null)
      window.history.pushState({}, null, pathname)
    }
    this.currentPath = pathname
    if (this.currentPath === '/' || this.currentPath === '/notifications') {
      this.updateComplete.then(() => {
        window.scrollTo(0, 0)
      })
    }
    this.setGestureNav()
  }

  setGestureNav () {
    switch (this.currentPath) {
      case '/':
      case '/index':
      case '/index.html':
      case '/inbox':
      case '/notifications':
      case '/search':
        gestures.setCurrentNav(['/', '/notifications', '/search'])
        return
      case '/communities':
        gestures.setCurrentNav([{back: true}, '/communities'])
        return
      default:
        // NOTE: user-view specifies the gestures nav since it uses custom UIs
        if (!USER_PATH_REGEX.test(this.currentPath)) {
          gestures.setCurrentNav(undefined)
        } else if (this.querySelector('app-user-view')) {
          this.querySelector('app-user-view').setGesturesNav()
        }
    }
    if (TOPIC_PATH_REGEX.test(this.currentPath)) {
      gestures.setCurrentNav([{back: true}, this.currentPath])
      return
    }
    if (PAGE_PATH_REGEX.test(this.currentPath)) {
      gestures.setCurrentNav([{back: true}, this.currentPath])
      return
    }
    if (POST_PATH_REGEX.test(this.currentPath)) {
      gestures.setCurrentNav([{back: true}, this.currentPath])
      return
    }
    if (COMMENT_PATH_REGEX.test(this.currentPath)) {
      gestures.setCurrentNav([{back: true}, this.currentPath])
      return
    }
  }

  async scrollToAfterLoad (scrollY) {
    await this.updateComplete

    try {
      let view = this.querySelector('#view')
      view.pageLoadScrollTo(scrollY)
    } catch (e) {}
  }

  reloadView () {
    try {
      let view = this.querySelector('#view')
      view.load()
    } catch (e) {
      console.log('Failed to reload view', e)
    }
  }

  // rendering
  // =

  render () {
    if (this.isLoading) {
      return html`
        <div class="max-w-4xl mx-auto">
          <div class="py-32 text-center text-gray-400">
            <span class="spinner h-7 w-7"></span>
          </div>
        </div>
      `
    }

    /**
     * NOTE
     * We keep the DOM of the home view and the last-viewed user in
     * the document with "display: none". This is so they will load
     * quickly and preserve the scroll state.
     * -prf
     */

    if (this.currentPath === '/') {
      this.hasVisitedHome = true
    } else if (this.currentPath === '/notifications') {
      this.hasVisitedNotifications = true
    } else if (USER_PAGE_REGEX.test(this.currentPath)) {
      this.lastUserPath = this.currentPath
    }

    let renderedViews = new Set()
    const renderView = (path) => {
      if (renderedViews.has(path)) {
        return ''
      }
      renderedViews.add(path)
      const isCurrentView = this.currentPath === path
      const id = isCurrentView ? 'view' : undefined
      const cls = isCurrentView ? 'block' : 'hidden'
      switch (path) {
        case '/':
        case '/index':
        case '/index.html':
        case '/inbox':
        case '/search':
        case '/activity':
          return html`<app-main-view id=${id} class=${cls} current-path=${path}></app-main-view>`
        case '/notifications':
          return html`<app-notifications-view id=${id} class=${cls} current-path=${path}></app-notifications-view>`
        case '/forgot-password':
          return html`<app-forgot-password-view id="view" current-path=${path}></app-forgot-password-view>`
        case '/communities':
          return html`<app-communities-view id="view" current-path=${path}></app-communities-view>`
        case '/account':
          return html`<app-account-view id="view" current-path=${path}></app-account-view>`
        case '/signup':
          return html`<app-signup-view id="view" current-path=${path}></app-signup-view>`
      }
      if (TOPIC_PATH_REGEX.test(path)) {
        return html`<app-topic-view id="view" current-path=${path}></app-topic-view>`
      }
      if (PAGE_PATH_REGEX.test(path)) {
        return html`<app-page-view id="view" current-path=${path}></app-page-view>`
      }
      if (POST_PATH_REGEX.test(path)) {
        return html`<app-post-view id="view" current-path=${path}></app-post-view>`
      }
      if (COMMENT_PATH_REGEX.test(path)) {
        return html`<app-post-view id="view" current-path=${path}></app-post-view>`
      }
      if (USER_PATH_REGEX.test(path)) {
        return html`<app-user-view id=${id} class=${cls} current-path=${path}></app-user-view>`
      }
      return html`
        <div class="bg-gray-100 min-h-screen wide">
          <app-header></app-header>
          <div class="text-center py-48">
            <h2 class="text-5xl text-gray-600 font-semibold mb-4">404 Not Found</h2>
            <div class="text-lg text-gray-600 mb-4">No page exists at this URL.</div>
            <div class="text-lg text-gray-600">
              <a class="text-blue-600 hov:hover:underline" href="/" title="Back to home">
                <span class="fas fa-angle-left fa-fw"></span> Home</div>
              </a>
            </div>
          </div>
        </div>
      `
    }

    return html`
      ${this.hasVisitedHome ? renderView('/') : ''}
      ${this.hasVisitedNotifications ? renderView('/notifications') : ''}
      ${this.lastUserPath ? renderView(this.lastUserPath) : ''}
      ${renderView(this.currentPath)}
    `
  }

  // events
  // =

  onGlobalClick (e) {
    if (e.defaultPrevented) {
      return
    }

    let anchor
    for (let el of e.composedPath()) {
      if (el.tagName === 'A') {
        anchor = el
      }
    }
    if (!anchor) return

    const href = anchor.getAttribute('href')
    if (href === null) return
    
    const url = new URL(href, window.location.origin)
    if (url.origin === window.location.origin) {
      e.preventDefault()
      this.navigateTo(url.pathname)
    }
  }

  onViewThread (e) {
    let [_, path] = e.detail.subject.dbUrl.split(DRIVE_KEY_REGEX)
    this.navigateTo(`/${e.detail.subject.authorId}${path}`)
  }

  onNavigateTo (e) {
    this.navigateTo(e.detail.url, e.detail.replace)
  }

  onHistoryPopstate (e) {
    emit(document, 'close-all-popups')
    this.currentPath = window.location.pathname
    this.setGestureNav()
    if (typeof e.state.scrollY === 'number') {
      this.scrollToAfterLoad(e.state.scrollY)
    }
  }

  onBeforeUnload (e) {
    if (this.pageHasChanges) {
      e.preventDefault()
      e.returnValue = ''
    }
  }

  async onDeletePost (e) {
    try {
      await session.ctzn.user.table('ctzn.network/post').delete(e.detail.post.key)
      toast.create('Post deleted')
      this.reloadView()
    } catch (e) {
      console.log(e)
      toast.create(e.toString(), 'error')
    }
  }

  async onModeratorRemovePost (e) {
    try {
      const post = e.detail.post
      await session.ctzn.db(post.value.community.userId).method(
        'ctzn.network/community-remove-content-method',
        {contentUrl: post.url}
      )
      toast.create('Post removed')
      this.reloadView()
    } catch (e) {
      console.log(e)
      toast.create(e.toString(), 'error')
    }
  }
}

customElements.define('app-root', CtznApp)