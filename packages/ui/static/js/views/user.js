import { LitElement, html } from '../../vendor/lit/lit.min.js'
import { unsafeHTML } from '../../vendor/lit/directives/unsafe-html.js'
import { repeat } from '../../vendor/lit/directives/repeat.js'
import { PostComposerPopup } from '../com/popups/post-composer.js'
import { ViewMediaPopup } from '../com/popups/view-media.js'
import { GeneralPopup } from '../com/popups/general.js'
import * as contextMenu from '../com/context-menu.js'
import * as toast from '../com/toast.js'
import {
  AVATAR_URL,
  BLOB_URL,
  USER_URL
} from '../lib/const.js'
import * as session from '../lib/session.js'
import * as gestures from '../lib/gestures.js'
import { pluralize, makeSafe, linkify, isHyperUrl, isHyperKey, toNiceDomain } from '../lib/strings.js'
import { emit } from '../lib/dom.js'
import { emojify } from '../lib/emojify.js'
import { writeToClipboard } from '../lib/clipboard.js'
import '../com/header.js'
import '../com/button.js'
import '../com/img-fallbacks.js'
import '../com/content/posts-feed.js'
import '../com/content/current-status.js'
import '../com/users/followers-list.js'
import '../com/users/following-list.js'
import '../com/subnav.js'
import '../com/edit-profile.js'

class CtznUser extends LitElement {
  static get properties () {
    return {
      currentPath: {type: String, attribute: 'current-path'},
      isProfileLoading: {type: Boolean},
      userProfile: {type: Object},
      currentView: {type: String},
      followers: {type: Array},
      following: {type: Array},
      isEmpty: {type: Boolean},
      isProcessingSocialAction: {type: Boolean},
      showMiniRightNavProfile: {type: Boolean}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.reset()
    this.currentView = undefined
    this.isProcessingSocialAction = false // joining, leaving, following, unfollowing

    // ui helper state
    this.lastScrolledToUserId = undefined
    this.miniProfileObserver = undefined
    this.readInfoFromPath()
    document.title = `Loading... | CTZN`
  }

  reset () {
    this.isProfileLoading = false
    this.userProfile = undefined
    this.followers = undefined
    this.following = undefined
    this.sharedFollowers = []
    this.isEmpty = false
    this.showMiniRightNavProfile = false
  }

  readInfoFromPath () {
    const parts = (new URL(window.location)).pathname.split('/')
    this.userId = parts[1]
    this.niceUserId = isHyperUrl(this.userId) ? toNiceDomain(this.userId) : this.userId
    this.currentView = parts[2] || undefined
  }

  get isMe () {
    return session.info?.dbKey === this.userProfile?.dbKey
  }

  get isCitizen () {
    return this.userProfile?.dbType === 'ctzn.network/public-citizen-db'
  }

  get amIFollowing () {
    return !!session.myFollowing?.find?.(dbKey => dbKey === this.userProfile?.dbKey)
  }

  get isFollowingMe () {
    return !!this.following?.find?.(f => f.value.subject.dbKey === session.info?.dbKey)
  }

  get subnavItems () {
    return [
      {back: true, label: html`<span class="fas fa-angle-left"></span>`, mobileOnly: true},
      {label: 'Feed', path: `${USER_URL(this.userId)}/feed`},
      {label: 'About', path: `${USER_URL(this.userId)}/about`},
      {
        path: `${USER_URL(this.userId)}/settings`,
        label: html`<span class="fas fa-cog"></span>`,
        thin: true,
        rightAlign: true
      }
    ]
  }

  setGesturesNav () {
    gestures.setCurrentNav([
      {back: true},
      `${USER_URL(this.userId)}/feed`,
      `${USER_URL(this.userId)}/about`,      
      `${USER_URL(this.userId)}/settings`
    ])
  }

  async load ({force} = {force: false}) {
    this.readInfoFromPath()

    // 1. If opening a profile for the first time (change of lastScrolledToUserId) go to top
    // 2. If we're scrolled beneath the header, jump to just below the header
    if (this.lastScrolledToUserId && this.lastScrolledToUserId === this.userId) {
      const el = this.querySelector(`#scroll-target`)
      if (el) {
        let top = el.getBoundingClientRect().top
        if (top < 0) {
          const isDesktop = window.innerWidth >= 1024
          window.scrollTo({top: window.scrollY + top - (isDesktop ? 140 : 0)})
        }
      }
    } else {
      window.scrollTo({top: 0})
    }
    this.lastScrolledToUserId = this.userId

    // profile change?
    if (force || (this.userId !== this.userProfile?.username && this.userId !== this.userProfile?.dbKey)) {
      this.reset()
      this.isProfileLoading = true
      this.userProfile = await session.api.getProfile(this.userId).catch(e => ({error: true, message: e.toString()}))
      if (this.userProfile.error) {
        console.log('User profile not found for', this.userId)
        document.title = `Not Found | CTZN`
        return this.requestUpdate()
      }
      document.title = `${this.userProfile?.value.displayName || this.niceUserId} | CTZN`
      if (this.isCitizen) {
        const [followers, following] = await Promise.all([
          session.api.listFollowers(this.userId),
          session.api.db(this.userId).table('ctzn.network/follow').list()
        ])
        this.followers = followers
        if (session.isActive() && !this.isMe) {
          this.sharedFollowers = intersect(session.myFollowing, followers)
        }
        this.following = following
        console.log({userProfile: this.userProfile, followers, following})
      }
      this.isProfileLoading = false
    }

    if (!this.currentView) {
      let userId = this.userProfile?.username || this.userId
      emit(this, 'navigate-to', {detail: {url: `${USER_URL(userId)}/feed`, replace: true}})
    } else if (this.userProfile?.username && isHyperKey(this.userId)) {
      emit(this, 'navigate-to', {detail: {url: `${USER_URL(this.userProfile.username)}/${this.currentView}`, replace: true}})
    }

    this.querySelector('app-posts-feed')?.load()
    this.querySelector('app-comments-feed')?.load()

    const rightNavProfileEl = this.querySelector('#right-nav-profile')
    if (!this.miniProfileObserver && rightNavProfileEl) {
      this.miniProfileObserver = new IntersectionObserver((entries) => {
        this.showMiniRightNavProfile = !entries[0]?.isIntersecting
      }, {threshold: 0.0, rootMargin: '-80px 0px 0px 0px'})
      this.miniProfileObserver.observe(rightNavProfileEl)
    }
  }

  async refresh () {
    await this.querySelector('app-posts-feed')?.load()
    await this.querySelector('app-comments-feed')?.load()
  }

  get isLoading () {
    let queryViewEls = Array.from(this.querySelectorAll('app-posts-feed'))
    return this.isProfileLoading || !!queryViewEls.find(el => el.isLoading)
  }

  async pageLoadScrollTo (y) {
    await this.requestUpdate()
    const feed = this.querySelector('app-posts-feed')
    if (feed) {
      feed.pageLoadScrollTo(y)
    } else {
      window.scrollTo(0, y)
    }
  }

  disconnectedCallback (...args) {
    super.disconnectedCallback(...args)
    if (this.miniProfileObserver) {
      this.miniProfileObserver.disconnect()
    }
  }

  // rendering
  // =

  render () {
    const nFollowers = this.followers?.length || 0

    if (this.userProfile?.error) {
      return this.renderError()
    }

    return html`
      <app-header
        @post-created=${e => this.load()}
      ></app-header>
      <div class="controls-menu-container"></div>
      ${this.renderDesktopHeader()}
      ${this.renderMobileHeader()}
      <main class="col2">
        <div>
          <div class="widescreen-hidden sm:border-l sm:border-r border-gray-300">
            ${this.isCitizen ? html`
              <div class="bg-white text-center pb-4">
                <span
                  class="bg-gray-50 font-semibold px-2 py-1 rounded text-gray-500 hov:hover:bg-gray-100 cursor-pointer"
                  @click=${this.onClickViewFollowers}
                >
                  <span class="fas fa-fw fa-user"></span>
                  ${nFollowers} ${pluralize(nFollowers, 'Follower')}
                </span>
              </div>
            ` : ''}
            ${this.userProfile?.value.description ? html`
              <div class="text-center pb-4 px-4 sm:px-7 bg-white">${unsafeHTML(linkify(emojify(makeSafe(this.userProfile?.value.description))))}</div>
            ` : ''}
            ${!this.isProfileLoading && session.isActive() && !this.isMe && this.isCitizen && this.amIFollowing === false ? html`
              <div class="bg-white text-center pb-4 px-4">
                <app-button
                  btn-class="font-semibold py-1 text-base block w-full rounded-lg sm:px-10 sm:inline sm:w-auto sm:rounded-full"
                  @click=${this.onClickFollow}
                  label="Follow ${this.userProfile?.value.displayName || this.niceUserId}"
                  ?spinner=${this.isProcessingSocialAction}
                  ?disabled=${this.isProcessingSocialAction}
                  primary
                ></app-button>
              </div>
            ` : ''}
          </div>
          <div id="scroll-target"></div>
          <div class="min-h-screen">
            <app-subnav
              mobile-only
              .items=${this.subnavItems}
              current-path=${this.currentPath}
            ></app-subnav>
            ${this.renderCurrentView()}
          </div>
        </div>
        <div>
          <div id="right-nav-profile" class="relative">
            <div class="absolute" style="top: -70px; right: 75px;">
              <a href="${USER_URL(this.userId)}" title=${this.userProfile?.value.displayName}>
                <img
                  class="avatar inline-block object-cover"
                  src=${AVATAR_URL(this.userId)}
                  style="width: 130px; height: 130px"
                  @click=${this.onClickAvatar}
                >
              </a>
            </div>
            <div class="px-2 pt-20 pb-4 mb-2 break-words">
              <h2 class="display-name">
                <a
                  class="inline-block"
                  href="${USER_URL(this.userId)}"
                  title=${this.userProfile?.value.displayName}
                >
                  ${unsafeHTML(emojify(makeSafe(this.userProfile?.value.displayName), 'w-6', '0'))}
                </a>
              </h2>
              <h2 class="userid mb-4">
                <a href="${USER_URL(this.userId)}" title="${this.niceUserId}">
                  @${this.niceUserId}
                </a>
              </h2>
              ${this.userProfile?.value.description ? html`
                <div class="description pb-4">${unsafeHTML(linkify(emojify(makeSafe(this.userProfile?.value.description))))}</div>
              ` : ''}
              ${this.isCitizen ? html`
                <div class="pb-2">
                  <span
                    class="profile-stat hov:hover:underline cursor-pointer"
                    @click=${this.onClickViewFollowers}
                  >
                    <span class="fas fa-fw fa-user"></span>
                    ${nFollowers} ${pluralize(nFollowers, 'Follower')}
                  </span>
                </div>
              ` : ''}
              ${!this.isProfileLoading && session.isActive() && !this.isMe && this.isCitizen && this.amIFollowing === false ? html`
                <div class="pb-2">
                  <app-button
                    btn-class="font-semibold py-1 text-base block w-full rounded-lg"
                    @click=${this.onClickFollow}
                    label="Follow ${this.userProfile?.value.displayName || this.niceUserId}"
                    ?spinner=${this.isProcessingSocialAction}
                    ?disabled=${this.isProcessingSocialAction}
                    primary
                  ></app-button>
                </div>
              ` : ''}
            </div>
          </div>
          <div class="mini-right-nav-profile sticky" style="top: 130px">
            <div
              class="absolute ${this.showMiniRightNavProfile ? '' : 'pointer-events-none'}"
              style="
                top: -60px;
                opacity: ${this.showMiniRightNavProfile ? '1' : '0'};
                transition: opacity 0.1s;
              "
            >
              <div class="flex items-center">
                <a href="${USER_URL(this.userId)}" title=${this.userProfile?.value.displayName}>
                  <img
                    class="avatar inline-block object-cover mr-2"
                    src=${AVATAR_URL(this.userId)}
                    style="width: 40px; height: 40px"
                    @click=${this.onClickAvatar}
                  >
                </a>
                <h2 class="display-name flex-1 truncate">
                  <a
                    class="inline-block"
                    href="${USER_URL(this.userId)}"
                    title=${this.userProfile?.value.displayName}
                  >
                    ${unsafeHTML(emojify(makeSafe(this.userProfile?.value.displayName), 'w-6', '0'))}
                  </a>
                </h2>
              </div>
            </div>
            ${repeat(this.subnavItems, (item, i) => {
              if (item.mobileOnly) return ''
              return html`
                <a
                  class="
                    right-nav-item block px-3 py-1.5 mb-1 cursor-pointer
                    ${item.path === this.currentPath ? 'is-selected' : ''}
                  "
                  href="${item.path}"
                >
                  ${item.label}
                </a>
              `
            })}
          </div>
        </div>
      </main>
    `
  }

  renderError () {
    return html`
      <app-header></app-header>
      <div class="bg-gray-100">
        <main class="min-h-screen">
          <div class="text-center py-48">
            <h2 class="text-5xl text-gray-600 font-semibold mb-4">404 Not Found</h2>
            <div class="text-lg text-gray-600 mb-4">We couldn't find ${this.userId}</div>
            <div class="text-lg text-gray-600">
              <a class="text-blue-600 hov:hover:underline" href="/" title="Back to home">
                <span class="fas fa-angle-left fa-fw"></span> Home</div>
              </a>
            </div>
          </div>
        </main>
    </div>
    `
  }

  renderDesktopHeader () {
    return html`
      <main class="widescreen-only fullwidth mb-2" style="padding: 0">
        <div class="relative">
          <div class="absolute" style="top: 8px; left: 10px">
            <app-button
              btn-class="px-3 py-1 rounded-full text-base text-white"
              href="/"
              icon="fas fa-angle-left"
              transparent
              btn-style="background: rgba(0,0,0,.5); backdrop-filter: blur(5px) contrast(0.9); -webkit-backdrop-filter: blur(5px) contrast(0.9); "
            ></app-button>
          </div>
          <div class="absolute" style="top: 8px; right: 10px">
            ${this.renderProfileControls()}
          </div>
          <div
            class="bg-blue-600"
            style="height: 400px"
          >
            <app-img-fallbacks id=${this.userId}>
              <img
                slot="img1"
                style="display: block; object-fit: cover; width: 100%; height: 400px;"
                src=${BLOB_URL(this.userId, 'ctzn.network/profile', 'self', 'banner')}
              >
              <div slot="img2"></div>
            </app-img-fallbacks>
          </div>
          <div
            class="absolute w-full pointer-events-none"
            style="top: 80%; left: 0; height: 20%; background: linear-gradient(to top, rgba(0,0,0,0.15), rgba(0,0,0,0.05) 30%, rgba(0,0,0,0));"
          ></div>
        </div>
      </main>
    `
  }

  renderMobileHeader () {
    return html`
      <main class="widescreen-hidden" style="padding: 0">
        <div class="relative sm:border-l sm:border-r border-gray-300">
          <div class="absolute" style="top: 8px; left: 10px">
            <app-button
              btn-class="px-3 py-1 rounded-full text-base text-white"
              href="/"
              icon="fas fa-angle-left"
              transparent
              btn-style="background: rgba(0,0,0,.5); backdrop-filter: blur(5px) contrast(0.9); -webkit-backdrop-filter: blur(5px) contrast(0.9); "
            ></app-button>
          </div>
          <div class="absolute" style="top: 8px; right: 10px">
            ${this.renderProfileControls()}
          </div>
          <div
            style="height: 200px; background: linear-gradient(0deg, #3c4af6, #2663eb);"
          >
            <app-img-fallbacks>
              <img
                slot="img1"
                style="display: block; object-fit: cover; width: 100%; height: 200px;"
                src=${BLOB_URL(this.userId, 'ctzn.network/profile', 'self', 'banner')}
              >
              <div slot="img2"></div>
            </app-img-fallbacks>
          </div>
          <div class="absolute text-center w-full" style="top: 130px">
            <a href="${USER_URL(this.userId)}" title=${this.userProfile?.value.displayName}>
              <img
                class="border-4 border-white inline-block object-cover rounded-3xl shadow-md bg-white"
                src=${AVATAR_URL(this.userId)}
                style="width: 130px; height: 130px"
                @click=${this.onClickAvatar}
              >
            </a>
          </div>
          <div class="text-center pt-20 pb-4 px-4 bg-white">
            <h2 class="text-3xl font-semibold">
              <a
                class="inline-block"
                href="${USER_URL(this.userId)}"
                title=${this.userProfile?.value.displayName}
                style="max-width: 320px"
              >
                ${unsafeHTML(emojify(makeSafe(this.userProfile?.value.displayName)))}
              </a>
            </h2>
            <h2 class="text-gray-500 font-semibold">
              <a href="${USER_URL(this.userId)}" title="${this.userId}">
                ${this.userId}
              </a>
            </h2>
          </div>
        </div>
      </main>
    `
  }

  renderProfileControls () {
    if (this.isProfileLoading) return html``
    const btnStyle = `background: rgba(0,0,0,.5); backdrop-filter: blur(5px) contrast(0.9); -webkit-backdrop-filter: blur(5px) contrast(0.9);`
    if (this.isCitizen) {
      return html`
        <div>
          ${session.isActive() ? html`
            ${this.isMe ? html`
              <app-button
                btn-class="font-medium px-5 py-1 rounded-full text-base text-white"
                href="${USER_URL(this.userId)}/settings"
                label="Edit profile"
                transparent
                btn-style=${btnStyle}
              ></app-button>
            ` : html`
              ${this.amIFollowing === true ? html`
                <app-button
                  btn-class="font-medium px-5 py-1 rounded-full text-base text-white"
                  @click=${this.onClickUnfollow}
                  label="Unfollow"
                  ?spinner=${this.isProcessingSocialAction}
                  ?disabled=${this.isProcessingSocialAction}
                  transparent
                  btn-style=${btnStyle}
                ></app-button>
              ` : this.amIFollowing === false ? html`
                <app-button
                  btn-class="font-medium px-6 py-1 rounded-full text-base text-white"
                  @click=${this.onClickFollow}
                  label="Follow"
                  ?spinner=${this.isProcessingSocialAction}
                  ?disabled=${this.isProcessingSocialAction}
                  transparent
                  btn-style=${btnStyle}
                ></app-button>
              ` : ``}
            `}
          ` : ''}
        </div>
      `
    }
  }

  renderCurrentView () {
    if (this.currentView === 'about') {
      return html`
        <div class="info-block mb-2 px-4 py-3">
          <h2 class="font-semibold text-lg">Communities <span class="text-base ml-1">${this.userProfile?.value?.communities.length || 0}</span></h2>
          <div class="communities-list">
            ${repeat(this.userProfile?.value?.communities || [], c => c, c => html`
              <a class="community" href="/p/explore/community/${encodeURIComponent(c)}">
                ${c}
                <span class="link fas fa-${session.myCommunities?.includes?.(c) ? 'minus' : 'plus'}" @click=${e => this.onToggleCommunity(e, c)}></span>
              </a>
            `)}
            ${this.isMe ? html`
              <span class="link community" @click=${this.onClickNewCommunity}>New Community</span>
            ` : ''}
          </div>
        </div>
        <app-followers-list
          class="block mb-2"
          user-id=${this.userId}
        ></app-followers-list>
        <app-following-list
          class="block mb-2"
          user-id=${this.userId}
        ></app-following-list>
        <div class="info-block mb-2 px-4 py-3">
          <div class="mb-1 text-sm font-medium">Database Key (for the nerds):</div>
          <div class="dbkey flex items-center">
            <div class="dbkey-text flex-1 overflow-auto py-2 px-3">${this.userProfile?.dbKey}</div>
            <div class="py-2 px-3">
              <a class="cursor-pointer" @click=${this.onClickCopyDbKey}><span class="far fa-clipboard"></span></a>
            </div>
          </div>
        </div>
      `
    } else if (this.currentView === 'settings') {
      return html`
        <app-edit-profile
          db-key=${this.userProfile?.dbKey}
          .profile=${this.userProfile}
          @profile-updated=${this.onProfileUpdated}
        ></app-edit-profile>
      `
    } else {
      return html`
        <app-current-status class="block mb-1" user-id=${this.userId}></app-current-status>
        <app-posts-feed
          class="block"
          user-id=${this.userId}
          view="ctzn.network/views/posts"
        ></app-posts-feed>
      `
    }
  }

  // events
  // =

  onProfileUpdated (e) {
    this.load({force: true})
  }

  onClickAvatar (e) {
    e.preventDefault()
    ViewMediaPopup.create({item: {type: 'image', url: AVATAR_URL(this.userId)}})
  }

  async onClickFollow (e) {
    this.isProcessingSocialAction = true
    try {
      await session.api.user.table('ctzn.network/follow').create({
        subject: {userId: this.userId, dbKey: this.userProfile.dbKey}
      })
      await session.loadSecondaryState()
      this.followers = await session.api.listFollowers(this.userId)
    } catch (e) {
      console.log(e)
      toast.create('There was an error while trying to follow this user', 'error')
    }
    this.isProcessingSocialAction = false
  }

  async onClickUnfollow (e) {
    this.isProcessingSocialAction = true
    try {
      await session.api.user.table('ctzn.network/follow').delete(this.userId)
      await session.loadSecondaryState()
      this.followers = await session.api.listFollowers(this.userId)
    } catch (e) {
      console.log(e)
      toast.create('There was an error while trying to unfollow this user', 'error')
    }
    this.isProcessingSocialAction = false
  }


  async onClickCreatePost (e) {
    e.preventDefault()
    e.stopPropagation()
    try {
      await PostComposerPopup.create()
      toast.create('Post published', '', 10e3)
      this.querySelector('app-posts-feed').load()
    } catch (e) {
      // ignore
      console.log(e)
    }
  }

  onClickViewFollowers (e) {
    e.preventDefault()
    e.stopPropagation()
    GeneralPopup.create({
      render: () => html`
        <app-followers-list
          user-id=${this.userId}
          .renderOpts=${{expandedOnly: true}}
        ></app-followers-list>
      `
    })
  }

  onClickControlsMenu (e) {
    e.preventDefault()
    e.stopPropagation()

    const setView = (view) => {
      emit(this, 'navigate-to', {detail: {url: `${USER_URL(this.userId)}/${view}`}})
    }

    let items = []
    const parent = this.querySelector('.controls-menu-container')
    const rect = parent.getClientRects()[0]
    contextMenu.create({
      parent,
      x: rect.width - 10,
      y: 50,
      right: true,
      roomy: true,
      noBorders: true,
      style: `padding: 4px 0; font-size: 16px; font-weight: 500; min-width: 140px`,
      items
    })
  }

  onClickCopyDbKey (e) {
    writeToClipboard(this.userProfile.dbKey)
    toast.create('Copied to clipboard')
  }

  async onClickNewCommunity (e) {
    e.preventDefault()
    e.stopPropagation()

    const res = await GeneralPopup.create({
      maxWidth: '400px',
      render () {
        const onCancel = e => this.onReject()
        const onAdd = e => {    
          const value = this.querySelector('input').value
          this.dispatchEvent(new CustomEvent('resolve', {detail: {value}}))
        }
        const onKeydownInput = e => {
          if (e.code === 'Enter' || e.code === 'NumpadEnter') onAdd()
        }
        return html`
          <div class="font-semibold p-1">New community name:</div>
          <input
            class="block border border-gray-300 box-border mb-2 px-3 py-2 rounded w-full"
            @keydown=${onKeydownInput}
          >
          <div class="flex justify-between">
            <app-button btn-class="py-1" label="Cancel" @click=${onCancel}></app-button>
            <app-button btn-class="py-1" primary label="Add" @click=${onAdd}></app-button>
          </div>
        `
      },
      firstUpdated () {
        this.querySelector('input')?.focus()
      }
    }).catch(e => undefined)

    if (!session.myCommunities?.includes?.(res.value)) {
      session.myCommunities.push(res.value)
      this.userProfile.value.communities = session.myCommunities.slice()
      await session.modifyProfile(v => Object.assign(v, {communities: session.myCommunities}))
      this.requestUpdate()
    }
  }

  async onToggleCommunity (e, name) {
    e.preventDefault()
    e.stopPropagation()
    if (!session.myCommunities.includes(name)) {
      session.myCommunities.push(name)
    } else {
      session.myCommunities.splice(session.myCommunities.indexOf(name), 1)
    }
    await session.modifyProfile(v => Object.assign(v, {communities: session.myCommunities}))
    this.requestUpdate()
  }
}

customElements.define('app-user-view', CtznUser)

function intersect (a, b) {
  var arr = []
  for (let av of a) {
    if (b.includes(av)) {
      arr.push(av)
    }
  }
  return arr
}
