import {LitElement, html} from '../../vendor/lit/lit.min.js'
import * as session from '../lib/session.js'
import * as notifications from '../lib/notifications.js'
import { emit } from '../lib/dom.js'
import * as theme from '../lib/theme.js'
import { PostComposerPopup } from './popups/post-composer.js'
import * as contextMenu from './context-menu.js'
import * as toast from './toast.js'
import './button.js'
import './users/searchable-user-list.js'

// lib/notifications uses caching to only talk to the server every 30s
const CHECK_NOTIFICATIONS_INTERVAL = 5e3

export class Header extends LitElement {
  static get properties () {
    return {
      currentPath: {type: String, attribute: 'current-path'},
      isSearchFocused: {type: Boolean},
      isMenuOpen: {type: Boolean},
      unreadNotificationsCount: {type: Number}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.currentPath = location.pathname
    this.isSearchFocused = false
    this.isMenuOpen = false
    this.unreadNotificationsCount = 0
    document.body.addEventListener('open-main-menu', e => {
      this.isMenuOpen = true
    })
    setInterval(this.checkNotifications.bind(this), CHECK_NOTIFICATIONS_INTERVAL)
    session.onChange(() => this.requestUpdate())
  }

  firstUpdated () {
    this.checkNotifications()
  }

  async checkNotifications () {
    if (!session.isActive()) return
    let oldCount = this.unreadNotificationsCount
    this.unreadNotificationsCount = await notifications.countUnread()
    if (oldCount !== this.unreadNotificationsCount) {
      emit(this, 'unread-notifications-changed', {detail: {count: this.unreadNotificationsCount}})
    }
  }

  getHeaderNavClass (str) {
    const state = str === this.currentPath ? 'is-selected' : ''
    return `nav-item ${state}`
  }

  getMenuNavClass (str) {
    const additions = str === this.currentPath ? 'text-blue-600' : 'text-gray-700 hov:hover:text-blue-600'
    return `pl-3 pr-4 py-3 rounded font-medium ${additions}`
  }

  render () {
    if (!session.isActive()) {
      return this.renderLoggedOut()
    }
    let info = session.api.session.info
    return html`
      <div class="desktop-header hidden lg:block sticky top-0 z-20">
        <div class="desktop-header-inner flex items-center leading-none">
          <a href="/" class=${this.getHeaderNavClass('/')} @click=${this.onClickLink}>
            <span class="fas fa-fw navicon fa-home"></span>
            Home
          </a>
          <a href="/notifications" class="relative ${this.getHeaderNavClass('/notifications')}" @click=${this.onClickLink}>
            ${this.unreadNotificationsCount > 0 ? html`
              <span class="absolute bg-blue-500 font-medium leading-none px-1.5 py-0.5 rounded-2xl text-white text-xs" style="top: 5px; left: 32px">${this.unreadNotificationsCount}</span>
            ` : ''}
            <span class="fas fa-fw navicon fa-bell"></span>
            Notifications
          </a>
          <div class="relative flex-1 ml-2 mr-4 h-8" @click=${e => { this.isSearchFocused = true }}>
            ${this.isSearchFocused ? html`
              <app-searchable-user-list
                class="search-container block absolute z-20 overflow-x-hidden"
                style="top: -6px; left: -1px; right: -1px"
                widget-mode
                @blur=${this.onBlurSearch}
              ></app-searchable-user-list>
            ` : html`
              <div class="search-placeholder flex items-center">
                <span class="search-placeholder-icon fas fa-fw fa-search mr-2"></span>
                <span class="search-placeholder-text">Search</span>
              </div>
            `}
          </div>
          <app-button
            primary
            class="ml-auto mr-2"
            btn-class="text-base sm:text-sm font-semibold w-full py-1 rounded-full"
            label="Create Post"
            @click=${this.onClickCreatePost}
          ></app-button>
          <a
            class="${this.getHeaderNavClass(`/${info.username}`)}"
            href="/${info.username}"
            title="My Profile"
            @click=${this.onClickLink}
          >
            <span class="fas fa-fw navicon fa-user"></span>
            My Profile
          </a>
          <a class=${this.getHeaderNavClass()} @click=${this.onClickAccountMenu}>
            <span class="fas fa-fw fa-caret-down"></span>
          </a>
        </div>
      </div>
      <!-- <div class="rainbow-gradient" style="height: 1px"></div> -->
      <div class="menu ${this.isMenuOpen ? 'open transition-enabled' : 'closed'} flex flex-col leading-none font-medium bg-white">
        <div class="px-4 pt-2.5 pb-1">
          <div class="font-bold text-3xl text-gray-800">
            CTZN
            <span class="text-lg text-gray-500 tracking-tight">alpha</span>
          </div>
        </div>
        <div class="flex flex-col px-2">
          <a href="/" class=${this.getMenuNavClass('/')} @click=${this.onClickLink}>
            <span class="fas mr-2 fa-fw navicon fa-home"></span>
            Home
          </a>
          <a href="/notifications" class="relative ${this.getMenuNavClass('/notifications')}" @click=${this.onClickLink}>
            ${this.unreadNotificationsCount > 0 ? html`
              <span class="absolute bg-blue-500 font-medium leading-none px-1.5 py-0.5 rounded-2xl text-white text-xs" style="top: 5px; left: 22px">${this.unreadNotificationsCount}</span>
            ` : ''}
            <span class="fas mr-2 fa-fw navicon fa-bell"></span>
            Notifications
          </a>
          <a
            class="${this.getMenuNavClass(`/${info.username}`)}"
            href="/${info.username}"
            title="My Profile"
            @click=${this.onClickLink}
          >
            <span class="fas mr-2 fa-fw navicon fa-user"></span>
            Profile
          </a>
        </div>
        <div class="py-3 px-4">
          <app-button
            primary
            btn-class="text-base sm:text-sm font-semibold w-full mb-2"
            label="Create Post"
            @click=${this.onClickCreatePost}
          ></app-button>
        </div>
        <div class="px-2">
          <div class="pb-16 sm:pb-6 flex flex-col">
            <a class=${this.getMenuNavClass('/account')} href="/account" @click=${this.onClickLink}><span class="fas fa-fw fa-cog mr-1.5"></span> Account</a>
            <a class=${this.getMenuNavClass()} href="#" @click=${this.onLogOut}>
              <span class="fas fa-fw fa-sign-out-alt mr-1.5"></span> Log out
            </a>
          </div>
        </div>
      </div>
      ${this.isMenuOpen ? html`
        <div
          class="fixed top-0 left-0 w-full h-full z-40" style="background: rgba(0, 0, 0, 0.5)"
          @click=${this.onClickMenuOverlay}
        ></div>
      ` : ''}
    `
  }

  renderLoggedOut () {
    return html`
      <header>
        <div class="logged-out-prompt bg-white border-b border-gray-300">
          <div class="block sm:flex pt-4 sm:pt-2 pb-2 sm:pb-4">
            <div class="px-4 sm:px-0 flex-1">
              <div class="font-bold text-3xl text-gray-800">
                CTZN
                <span class="text-lg text-gray-500 tracking-tight">alpha</span>
              </div>
              <div class="text-sm pb-2 text-gray-600">
                (pronounced "Citizen")
              </div>
              <div class="">
                An open-alpha decentralized social network.
                <a
                  class="text-blue-600 py-1 hov:hover:underline cursor-pointer"
                  href="https://www.youtube.com/channel/UCSkcL4my2wgDRFvjQOJzrlg"
                  target="_blank"
                >Follow the development livestreams every weekday on YouTube</a>.
              </div>
            </div>
            <div class="">
              <a class="inline-block px-3 py-3 font-semibold rounded hov:hover:bg-gray-100" href="/" @click=${this.onClickLink}><span class="fas fa-fw fa-sign-in-alt mr-1.5"></span> Log in</a>
              <a class="inline-block px-3 py-3 font-semibold rounded hov:hover:bg-gray-100" href="/signup" @click=${this.onClickLink}><span class="fas fa-fw fa-user-plus mr-1.5"></span> Sign up</a>
            </div>
          </div>
        </div>
      </header>
    `
  }

  // events
  // =

  onClickLink (e) {
    this.isMenuOpen = false
  }

  onClickMenuOverlay (e) {
    this.isMenuOpen = false
  }

  onFocusSearch (e) {
    this.isSearchFocused = true
  }

  onBlurSearch (e) {
    this.isSearchFocused = false
  }

  async onClickCreatePost (e) {
    e.preventDefault()
    e.stopPropagation()
    this.isMenuOpen = false
    try {
      await PostComposerPopup.create()
      toast.create('Post published', '', 10e3)
      emit(this, 'post-created')
    } catch (e) {
      // ignore
      console.log(e)
    }
  }

  onClickAccountMenu (e) {
    e.preventDefault()
    e.stopPropagation()
    let rect = e.currentTarget.getClientRects()[0]
    contextMenu.create({
      x: rect.right - 4,
      y: rect.bottom,
      right: true,
      noBorders: true,
      rounded: true,
      withTriangle: true,
      style: `padding: 4px 0 4px; font-size: 15px`,
      items: [
      {
        icon: theme.get() === 'vanilla' ? 'far fa-check-circle' : 'far fa-circle',
        label: 'Light',
        click: () => theme.set('vanilla')
      },
      {
        icon: theme.get() === 'vanilladark' ? 'far fa-check-circle' : 'far fa-circle',
        label: 'Dark',
        click: () => theme.set('vanilladark')
      },
      '-',
      {
        icon: 'fas fa-cog',
        label: 'Account',
        click: () => { window.location = `/account` }
      }, {
        icon: 'fas fa-sign-out-alt',
        label: 'Log Out',
        click: () => this.onLogOut()
      }]
    })
  }

  async onLogOut () {
    await session.api.session.logout()
    location.reload()
  }
}

customElements.define('app-header', Header)
