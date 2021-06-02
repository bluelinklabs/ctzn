import { LitElement, html } from '../../vendor/lit/lit.min.js'
import * as toast from '../com/toast.js'
import * as contextMenu from '../com/context-menu.js'
import * as session from '../lib/session.js'
import * as contentFilters from '../lib/content-filters.js'
import { PostComposerPopup } from '../com/popups/post-composer.js'
import { PostsDashboardPopup } from '../com/popups/posts-dashboard.js'
import '../com/header.js'
import '../com/button.js'
import '../com/login.js'
import '../com/content/posts-feed.js'
import '../com/content/notifications-feed.js'
import '../com/content/post-composer.js'
import '../com/content/current-status.js'
import '../com/content/current-statuses-list.js'
import '../com/img-fallbacks.js'
import '../com/suggestions-sidebar.js'
import '../com/users/mini-profile.js'
import '../com/users/searchable-user-list.js'
import '../com/subnav.js'

class CtznMainView extends LitElement {
  static get properties () {
    return {
      currentPath: {type: String, attribute: 'current-path'},
      currentView: {type: String},
      searchQuery: {type: String},
      numUnreadNotifications: {type: Number},
      lastFeedFetch: {type: Number}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.searchQuery = ''
    this.numUnreadNotifications = 0
    this.lastFeedFetch = undefined

    const pathParts = (new URL(location)).pathname.split('/')
    this.currentView = pathParts[1] || 'feed'
  }

  async load () {
    document.title = `CTZN`
    if (!session.isActive()) {
      if (location.pathname !== '/') {
        window.location = '/'
      } else {
        document.body.classList.add('no-pad')
      }
      return this.requestUpdate()
    }
    const pathParts = (new URL(location)).pathname.split('/')
    this.currentView = pathParts[2] || 'feed'
    this.querySelector('app-current-status')?.load()
    this.querySelector('app-posts-feed')?.load()
  }

  async refresh () {
    await this.querySelector('app-current-status')?.load()
    await this.querySelector('app-posts-feed')?.load()
  }

  async pageLoadScrollTo (y) {
    await this.requestUpdate()
    this.querySelector('app-posts-feed')?.pageLoadScrollTo(y)
  }

  // rendering
  // =

  render () {
    return html`
      ${this.renderCurrentView()}
    `
  }

  renderCurrentView () {
    if (!session.isActive()) {
      return this.renderNoSession()
    }
    return this.renderWithSession()
  }

  renderNoSession () {
    return html`
      <div class="bg-gray-700 border-gray-200 fixed py-2 text-center text-gray-100 w-full" style="top: 0; left: 0">
        <span class="font-bold text-gray-50">Alpha Release</span>.
        This is a preview build of CTZN.
      </div>
      <div class="hidden lg:block" style="margin-top: 15vh">
        <div class="flex my-2 max-w-4xl mx-auto">
          <div class="flex-1 py-20 text-gray-800 text-lg">
            <h1 class="font-semibold mb-1 text-6xl tracking-widest">CTZN<span class="font-bold text-3xl text-gray-500 tracking-normal" data-tooltip="Alpha Version">α</span></h1>
            <div class="mb-6 text-gray-500 text-2xl tracking-tight">(Pronounced "Citizen")</div>
            <div class="mb-8 text-2xl">
              Build your community in a decentralized<br>social network.
            </div>
            <div class="mb-6 text-blue-600 hov:hover:underline">
              <a href="https://github.com/pfrazee/ctzn" title="Learn more about CTZN" target="_blank">
                <span class="fas fa-external-link-alt fa-fw"></span>
                Learn more about CTZN
              </a>
            </div>
          </div>
          <div class="w-96">
            <app-login class="block border border-gray-300 overflow-hidden rounded-2xl shadow-xl"></app-login>
          </div>
        </div>
      </div>
      <div class="block lg:hidden">
        <div class="max-w-lg mx-auto bg-white sm:border sm:border-gray-300 sm:my-8 sm:rounded-2xl sm:shadow-xl">
          <div class="text-center pt-20 pb-14 text-gray-800 text-lg border-b border-gray-300">
            <h1 class="font-semibold mb-1 text-6xl tracking-widest">CTZN<span class="font-bold text-3xl text-gray-500 tracking-normal">α</span></h1>
            <div class="mb-6 text-gray-500 text-2xl tracking-tight">(Pronounced "Citizen")</div>
            <div class="mb-6 text-xl px-4">
              Build your community in a decentralized social network.
            </div>
            <div class="mb-6 text-blue-600 hov:hover:underline">
              <a href="https://github.com/pfrazee/ctzn" title="Learn more about CTZN" target="_blank">
                Learn more about CTZN
              </a>
            </div>
          </div>
          <div>
            <app-login></app-login>
          </div>
        </div>
      </div>
    `
  }

  renderWithSession () {
    const SUBNAV_ITEMS = [
      {menu: true, mobileOnly: true, label: html`<span class="fas fa-bars"></span>`},
      {path: '/', label: 'Feed'},
      {
        path: '/notifications',
        label: html`
          ${this.numUnreadNotifications > 0 ? html`
            <span class="inline-block text-sm px-2 bg-blue-600 text-white rounded-full">${this.numUnreadNotifications}</span>
          ` : ''}
          Notifications
        `
      },
      {path: '/search', label: 'Search'}
    ]
    const leftNavItem = (id, path, icon, label) => html`
      <a href=${path} class="left-nav-item ${id === this.currentView ? 'selected' : ''} block px-3 py-1.5 cursor-pointer">
        <span class="mr-2 fa-fw ${icon}"></span>
        ${label}
      </a>
    `
    return html`
      <app-header
        current-path=${this.currentPath}
        @post-created=${e => this.load()}
        @unread-notifications-changed=${this.onUnreadNotificationsChanged}
      ></app-header>
      <main class="col3">
        <div>
          <div class="text-lg pt-1 sticky top-16">
            ${leftNavItem('feed', '/', 'far fa-comment-alt', 'Posts')}
            ${leftNavItem('statuses', '/p/statuses', 'far fa-clock', 'Statuses')}
            <hr class="my-3">
            <div class="px-4 text-sm"><span class="fas fa-fw fa-circle text-xs text-green-500"></span> 14 users online</div>
            <div class="px-4 text-sm"><span class="fas fa-fw fa-circle text-xs text-green-500"></span> 3 from the mesh</div>
            <div class="px-4 text-sm"><span class="fas fa-fw fa-share-alt text-xs text-gray-500"></span> 5 unique peers</div>
            <div class="px-4 text-sm"><span class="fas fa-fw fa-database text-xs text-gray-500"></span> 839MB saved</div>
          </div>
        </div>
        <div>
          <app-subnav
            mobile-only
            nav-cls=""
            .items=${SUBNAV_ITEMS}
            current-path=${this.currentPath}
          ></app-subnav>
          ${this.currentView === 'feed' ? html`
            <h2 class="content-header items-center text-2xl tracking-tight font-bold p-4 pr-5 hidden lg:flex">
              <span>What's new</span>
              <a class="ml-auto text-base cursor-pointer" data-tooltip="Dashboard Mode" @click=${this.onClickDashboardMode}>
                <span class="fas fa-th"></span>
              </a>
              <a class="ml-6 text-base cursor-pointer" data-tooltip="Filters" @click=${this.onClickFilterMenu}>
                <span class="fas fa-filter"></span>
              </a>
            </h2>
            ${this.renderMockComposer()}
            <app-posts-feed
              class="block"
              view="ctzn.network/views/feed"
              @publish-reply=${this.onPublishReply}
              @fetched-latest=${e => {this.lastFeedFetch = (new Date()).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}}
            ></app-posts-feed>
          ` : this.currentView === 'search' ? html`
            <div class="bg-white sm:border sm:border-t-0 border-gray-300">
              <div class="text-sm px-3 py-3 text-gray-500">
                <span class="fas fa-info mr-1 text-xs"></span>
                Search is limited to your follows.
              </div>
              <app-searchable-user-list></app-searchable-user-list>
            </div>
          ` : this.currentView === 'statuses' ? html`
            <app-current-statuses-list
            ></app-current-statuses-list>
          ` : ''}
        </div>
        ${this.renderRightSidebar()}
      </main>
    `
  }

  renderMockComposer () {
    return html`
      <div class="sm:border-l sm:border-r border-gray-300 px-3 py-3 lg:hidden" @click=${this.onClickCreatePost}>
        <div class="flex items-center">
          <div
            class="flex-1 mr-1 py-1 px-3 bg-gray-100 text-gray-600 text-base rounded cursor-text"
          >What's new?</div>
          <app-button
            transparent
            btn-class="text-sm px-2 py-1 sm:px-4"
            label="Add Image"
            icon="far fa-image"
            @click=${e => this.onClickCreatePost(e, {intent: 'image'})}
          ></app-button>
        </div>
      </div>
    `
  }

  renderRightSidebar () {
    return html`
      <nav>
        <app-mini-profile class="block mt-4" user-id=${session.info.username}></app-mini-profile>
        <app-current-status class="block mt-4" user-id=${session.info.username}></app-current-status>
        <app-suggestions-sidebar></app-suggestions-sidebar>
      </nav>
    `
  }

  // events
  // =

  onKeyupSearch (e) {
    if (e.code === 'Enter') {
      window.location = `/search?q=${e.currentTarget.value.toLowerCase()}`
    }
  }

  onClickClearSearch (e) {
    window.location = '/'
  }

  onPublishReply (e) {
    toast.create('Reply published', '', 10e3)
    this.load()
  }

  async onClickCreatePost (e, opts = {}) {
    e.preventDefault()
    e.stopPropagation()
    try {
      await PostComposerPopup.create(opts)
      toast.create('Post published', '', 10e3)
      this.load()
    } catch (e) {
      // ignore
      console.log(e)
    }
  }

  onClickDashboardMode (e) {
    e.preventDefault()
    e.stopPropagation()
    PostsDashboardPopup.create()
  }

  onClickFilterMenu (e) {
    e.preventDefault()
    e.stopPropagation()
    const item = id => ({
      icon: contentFilters.isFiltered(id) ? 'fas fa-toggle-off' : 'fas fa-toggle-on',
      label: html`${id}: <strong>${contentFilters.isFiltered(id) ? 'Hidden' : 'Allowed'}</strong>`,
      click: () => contentFilters.toggle(id)
    })
    let rect = e.currentTarget.getClientRects()[0]
    contextMenu.create({
      x: rect.right + 6,
      y: rect.bottom,
      right: true,
      noBorders: true,
      rounded: true,
      withTriangle: true,
      keepOpen: true,
      style: `padding: 4px 0 4px; font-size: 15px`,
      items: () => [
        html`<div class="section-header small light">Filters:</div>`,
        ...contentFilters.IDs.map(item)
      ]
    })
  }

  onUnreadNotificationsChanged (e) {
    this.numUnreadNotifications = e.detail.count
  }
}

customElements.define('app-main-view', CtznMainView)