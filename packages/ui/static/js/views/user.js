import { LitElement, html } from '../../vendor/lit/lit.min.js'
import { unsafeHTML } from '../../vendor/lit/directives/unsafe-html.js'
import { repeat } from '../../vendor/lit/directives/repeat.js'
import { ComposerPopup } from '../com/popups/composer.js'
import { ViewMediaPopup } from '../com/popups/view-media.js'
import { GeneralPopup } from '../com/popups/general.js'
import * as contextMenu from '../com/context-menu.js'
import * as toast from '../com/toast.js'
import {
  AVATAR_URL,
  BLOB_URL,
  FIXED_COMMUNITY_PROFILE_SECTIONS,
  FIXED_CITIZEN_PROFILE_SECTIONS
} from '../lib/const.js'
import * as session from '../lib/session.js'
import * as gestures from '../lib/gestures.js'
import { pluralize, makeSafe, linkify } from '../lib/strings.js'
import { emit } from '../lib/dom.js'
import { emojify } from '../lib/emojify.js'
import '../com/header.js'
import '../com/button.js'
import '../com/img-fallbacks.js'
import '../ctzn-tags/posts-feed.js'
import '../com/simple-user-list.js'
import '../com/members-list.js'
import '../com/dbmethod-result-feed.js'
import '../com/subnav.js'
import '../com/custom-html.js'
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
      memberships: {type: Array},
      members: {type: Array},
      communityConfig: {type: Object},
      roles: {type: Array},
      isUserInvited: {type: Boolean},
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

    const pathParts = (new URL(location)).pathname.split('/')
    this.userId = pathParts[1]
    this.currentView = pathParts[2] || undefined
    document.title = `Loading... | CTZN`
  }

  reset () {
    this.isProfileLoading = false
    this.userProfile = undefined
    this._sections = []
    this.followers = undefined
    this.following = undefined
    this.members = undefined
    this.sharedFollowers = []
    this.sharedCommunities = []
    this.followedMembers = []
    this.communityConfig = undefined
    this.roles = undefined
    this.isUserInvited = undefined
    this.isEmpty = false
    this.showMiniRightNavProfile = false
  }


  get isMe () {
    return session.info?.userId === this.userId
  }

  get isCitizen () {
    return this.userProfile?.dbType === 'ctzn.network/public-citizen-db'
  }

  get isCommunity () {
    return this.userProfile?.dbType === 'ctzn.network/public-community-db'
  }

  get amIFollowing () {
    return !!session.myFollowing?.find?.(id => id === this.userId)
  }

  get isFollowingMe () {
    return !!this.following?.find?.(f => f.value.subject.userId === session.info?.userId)
  }

  get amIAMember () {
    return !!this.members?.find?.(m => m.value.user.userId === session.info?.userId)
  }

  get isMembershipClosed () {
    return this.communityConfig?.joinMode === 'closed'
  }

  get userUrl () {
    return `${(new URL(location)).origin}/${this.userId}`
  }

  get sections () {
    return this._sections
  }

  set sections (v) {
    this._sections = v
    this.setGesturesNav()
  }

  get currentSection () {
    return this.sections.find(section => section.id === this.currentView)
  }

  get subnavItems () {
    return [
      {back: true, label: html`<span class="fas fa-angle-left"></span>`, mobileOnly: true},
      ...this.sections.map(section => ({
        label: section.label || section.id,
        path: `/${this.userId}/${section.id}`
      })),
      {
        path: `/${this.userId}/settings`,
        label: html`<span class="fas fa-cog"></span>`,
        thin: true,
        rightAlign: true
      }
    ]
  }

  hasPermission (permId) {
    let memberRecord = this.members?.find?.(m => m.value.user.userId === session.info.userId)
    if (!memberRecord) return false
    if (!memberRecord.value.roles?.length) return false
    if (memberRecord.value.roles.includes('admin')) {
      return true
    }
    for (let roleId of memberRecord.value.roles) {
      let roleRecord = this.roles.find(r => r.value.roleId === roleId)
      if (roleRecord && !!roleRecord.value.permissions?.find(p => p.permId === permId)) {
        return true
      }
    }
    return false
  }

  setGesturesNav () {
    gestures.setCurrentNav([
      {back: true},
      ...this._sections.map(s => `/${this.userId}/${s.id}`),
      `/${this.userId}/settings`
    ])
  }

  async load ({force} = {force: false}) {
    const urlp = new URL(location)
    const pathParts = urlp.pathname.split('/')
    this.userId = pathParts[1]
    this.currentView = pathParts[2]

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
    if (force || this.userId !== this.userProfile?.userId) {
      this.reset()
      this.isProfileLoading = true
      this.userProfile = await session.ctzn.getProfile(this.userId).catch(e => ({error: true, message: e.toString()}))
      if (this.userProfile.error) {
        document.title = `Not Found | CTZN`
        return this.requestUpdate()
      }
      document.title = `${this.userProfile?.value.displayName || this.userId} | CTZN`
      if (this.isCitizen) {
        this.sections = FIXED_CITIZEN_PROFILE_SECTIONS.concat(
          this.userProfile?.value?.sections?.length
            ? this.userProfile.value.sections
            : []
        ).reduce(dedupSectionsReducer, [])
        const [followers, following, memberships] = await Promise.all([
          session.ctzn.listFollowers(this.userId),
          session.ctzn.db(this.userId).table('ctzn.network/follow').list(),
          session.ctzn.db(this.userId).table('ctzn.network/community-membership').list()
        ])
        this.followers = followers
        if (session.isActive() && !this.isMe) {
          this.sharedFollowers = intersect(session.myFollowing, followers)
        }
        this.following = following
        this.memberships = memberships
        if (session.isActive() && !this.isMe) {
          this.sharedCommunities = intersect(
            session.myCommunities.map(c => c.userId),
            memberships.map(m => m.value.community.userId)
          )
        }
        console.log({userProfile: this.userProfile, followers, following, memberships})
      } else if (this.isCommunity) {
        this.sections = FIXED_COMMUNITY_PROFILE_SECTIONS.concat(
          this.userProfile?.value?.sections?.length
            ? this.userProfile.value.sections
            : []
        ).reduce(dedupSectionsReducer, [])
        const [communityConfigEntry, members, roles] = await Promise.all([
          session.ctzn.db(this.userId).table('ctzn.network/community-config').get('self').catch(e => undefined),
          listAllMembers(this.userId),
          session.ctzn.db(this.userId).table('ctzn.network/community-role').list().catch(e => [])
        ])
        this.communityConfig = communityConfigEntry?.value
        this.members = members
        if (session.isActive() && !this.isMe) {
          this.followedMembers = intersect(
            session.myFollowing,
            members.map(m => m.value.user.userId)
          )
        }
        this.roles = roles
        console.log({userProfile: this.userProfile, members, roles})

        if (session.isActive() && !this.amIFollowing && this.isMembershipClosed) {
          let inviteEntry = await session.ctzn.db(this.userId)
            .table('ctzn.network/community-invite')
            .get(session.info.userId)
            .catch(e => undefined)
          this.isUserInvited = !!inviteEntry?.value
        }
      }
      this.isProfileLoading = false
    }

    if (!this.currentView) {
      emit(this, 'navigate-to', {detail: {url: `/${this.userId}/${this.sections[0].id}`, replace: true}})
    }

    this.querySelector('ctzn-posts-feed')?.load()
    this.querySelector('ctzn-comments-feed')?.load()
    this.querySelector('ctzn-dbresults-feed-feed')?.load()
    this.querySelector('ctzn-dbmethods-feed')?.load()

    const rightNavProfileEl = this.querySelector('#right-nav-profile')
    if (!this.miniProfileObserver && rightNavProfileEl) {
      this.miniProfileObserver = new IntersectionObserver((entries) => {
        this.showMiniRightNavProfile = !entries[0]?.isIntersecting
      }, {threshold: 0.0, rootMargin: '-80px 0px 0px 0px'})
      this.miniProfileObserver.observe(rightNavProfileEl)
    }
  }

  async refresh () {
    await this.querySelector('ctzn-posts-feed')?.load()
    await this.querySelector('ctzn-comments-feed')?.load()
    await this.querySelector('ctzn-dbresults-feed-feed')?.load()
    await this.querySelector('ctzn-dbmethods-feed')?.load()
  }

  get isLoading () {
    let queryViewEls = Array.from(this.querySelectorAll('ctzn-posts-feed'))
    return this.isProfileLoading || !!queryViewEls.find(el => el.isLoading)
  }

  async pageLoadScrollTo (y) {
    await this.requestUpdate()
    const feed = this.querySelector('ctzn-posts-feed')
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
    const nMembers = this.members?.length || 0
    const nFollowers = this.followers?.length || 0
    const nCommunities = this.memberships?.length || 0

    if (this.userProfile?.error) {
      return this.renderError()
    }

    const canJoin = !this.isMembershipClosed || (this.isMembershipClosed && this.isUserInvited)

    return html`
      <app-header
        @post-created=${e => this.load()}
        .community=${this.isCommunity && this.amIAMember ? ({userId: this.userId, dbUrl: this.userProfile?.dbUrl}) : undefined}
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
                <span
                  class="ml-1 bg-gray-50 font-semibold px-2 py-1 rounded text-gray-500 hov:hover:bg-gray-100 cursor-pointer"
                  @click=${this.onClickViewCommunities}
                >
                  <span class="fas fa-fw fa-users"></span>
                  ${nCommunities} ${nCommunities === 1 ? 'Community' : 'Communities'}
                </span>
              </div>
            ` : ''}
            ${this.isCommunity ? html`
              <div class="bg-white text-center pb-4">
                <span
                  class="bg-gray-50 font-bold px-2 py-1 rounded text-gray-500 hov:hover:bg-gray-100 cursor-pointer"
                  @click=${this.onClickViewMembers}
                >
                  <span class="fas fa-users"></span>
                  ${nMembers} ${pluralize(nMembers, 'Member')}
                </span>
                ${this.isMembershipClosed ? html`
                  <span class="font-semibold ml-3 py-1 rounded text-gray-600">Invite only</span>
                ` : ''}
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
                  label="Follow ${this.userProfile?.value.displayName || this.userId}"
                  ?spinner=${this.isProcessingSocialAction}
                  ?disabled=${this.isProcessingSocialAction}
                  primary
                ></app-button>
              </div>
            ` : ''}
            ${!this.isProfileLoading && session.isActive() && this.isCommunity && this.amIAMember === false && canJoin ? html`
              <div class="bg-white text-center pb-4 px-4">
                <app-button
                  btn-class="font-semibold py-1 text-base block w-full rounded-lg sm:px-10 sm:inline sm:w-auto sm:rounded-full"
                  @click=${this.onClickJoin}
                  label="Join community"
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
              <a href="/${this.userId}" title=${this.userProfile?.value.displayName}>
                <img
                  class="border-2 border-white inline-block object-cover rounded-3xl shadow-md bg-white"
                  src=${AVATAR_URL(this.userId)}
                  style="width: 130px; height: 130px"
                  @click=${this.onClickAvatar}
                >
              </a>
            </div>
            <div class="rounded bg-white px-2 pt-20 pb-4 mb-2 break-words">
              <h2 class="text-2xl font-semibold">
                <a
                  class="inline-block"
                  href="/${this.userId}"
                  title=${this.userProfile?.value.displayName}
                >
                  ${unsafeHTML(emojify(makeSafe(this.userProfile?.value.displayName), 'w-6', '0'))}
                </a>
              </h2>
              <h2 class="text-gray-600 font-semibold mb-4">
                <a href="/${this.userId}" title="${this.userId}">
                  ${this.userId}
                </a>
              </h2>
              ${this.userProfile?.value.description ? html`
                <div class="pb-4">${unsafeHTML(linkify(emojify(makeSafe(this.userProfile?.value.description))))}</div>
              ` : ''}
              ${this.isCitizen ? html`
                <div class="pb-2">
                  <span
                    class="font-semibold text-gray-500 hov:hover:underline cursor-pointer"
                    @click=${this.onClickViewFollowers}
                  >
                    <span class="fas fa-fw fa-user"></span>
                    ${nFollowers} ${pluralize(nFollowers, 'Follower')}
                  </span>
                </div>
                <div class="pb-2">
                  <span
                    class="font-semibold text-gray-500 hov:hover:underline cursor-pointer"
                    @click=${this.onClickViewCommunities}
                  >
                    <span class="fas fa-fw fa-users"></span>
                    ${nCommunities} ${nCommunities === 1 ? 'Community' : 'Communities'}
                  </span>
                </div>
              ` : ''}
              ${this.isCommunity ? html`
                <div class="pb-2">
                  <span
                    class="font-semibold text-gray-500 hov:hover:underline cursor-pointer"
                    @click=${this.onClickViewMembers}
                  >
                    <span class="fas fa-users"></span>
                    ${nMembers} ${pluralize(nMembers, 'Member')}
                  </span>
                  ${this.isMembershipClosed ? html`
                    <span class="font-semibold ml-3 py-1 rounded text-gray-600">Invite only</span>
                  ` : ''}
                </div>
              ` : ''}
              ${!this.isProfileLoading && session.isActive() && !this.isMe && this.isCitizen && this.amIFollowing === false ? html`
                <div class="pb-2">
                  <app-button
                    btn-class="font-semibold py-1 text-base block w-full rounded-lg"
                    @click=${this.onClickFollow}
                    label="Follow ${this.userProfile?.value.displayName || this.userId}"
                    ?spinner=${this.isProcessingSocialAction}
                    ?disabled=${this.isProcessingSocialAction}
                    primary
                  ></app-button>
                </div>
              ` : ''}
              ${!this.isProfileLoading && session.isActive() && this.isCommunity && this.amIAMember === false && canJoin ? html`
                <div class="pt-2 pb-2">
                  <app-button
                    btn-class="font-semibold py-1 text-base block w-full rounded-lg"
                    @click=${this.onClickJoin}
                    label="Join community"
                    ?spinner=${this.isProcessingSocialAction}
                    ?disabled=${this.isProcessingSocialAction}
                    primary
                  ></app-button>
                </div>
              ` : ''}
            </div>
          </div>
          <div class="sticky" style="top: 130px">
            <div
              class="absolute ${this.showMiniRightNavProfile ? '' : 'pointer-events-none'}"
              style="
                top: -60px;
                opacity: ${this.showMiniRightNavProfile ? '1' : '0'};
                transition: opacity 0.1s;
              "
            >
              <div class="flex items-center">
                <a href="/${this.userId}" title=${this.userProfile?.value.displayName}>
                  <img
                    class="inline-block object-cover rounded-md mr-2"
                    src=${AVATAR_URL(this.userId)}
                    style="width: 40px; height: 40px"
                    @click=${this.onClickAvatar}
                  >
                </a>
                <h2 class="text-xl font-semibold flex-1 truncate">
                  <a
                    class="inline-block"
                    href="/${this.userId}"
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
                    block px-3 py-1.5 mb-1 cursor-pointer border-l-2 font-medium hover:bg-blue-50 hover:border-blue-600
                    ${item.path === this.currentPath ? 'border-blue-600 text-blue-700 bg-blue-50' : 'border-gray-200 text-gray-700'}
                    ${i === 0 ? 'rounded-tr' : ''}
                    ${i === this.subnavItems.length - 1 ? 'rounded-br' : ''}
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
                src=${BLOB_URL(this.userId, 'profile-banner')}
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
                src=${BLOB_URL(this.userId, 'profile-banner')}
              >
              <div slot="img2"></div>
            </app-img-fallbacks>
          </div>
          <div class="absolute text-center w-full" style="top: 130px">
            <a href="/${this.userId}" title=${this.userProfile?.value.displayName}>
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
                href="/${this.userId}"
                title=${this.userProfile?.value.displayName}
                style="max-width: 320px"
              >
                ${unsafeHTML(emojify(makeSafe(this.userProfile?.value.displayName)))}
              </a>
            </h2>
            <h2 class="text-gray-500 font-semibold">
              <a href="/${this.userId}" title="${this.userId}">
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
            ${session.info.userId === this.userId ? html`
              <app-button
                btn-class="font-medium px-5 py-1 rounded-full text-base text-white"
                href="/${this.userId}/settings"
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
    if (this.isCommunity) {
      const canJoin = !this.isMembershipClosed || (this.isMembershipClosed && this.isUserInvited)
      return html`
        <div>
          ${session.isActive() ? html`
            ${this.amIAMember === true ? html`
              <app-button
                btn-class="font-medium px-5 py-1 rounded-full text-base text-white"
                @click=${this.onClickCreatePost}
                label="Create Post"
                transparent
                btn-style=${btnStyle}
              ></app-button>
            ` : this.amIAMember === false && canJoin ? html`
              <app-button
                btn-class="font-semibold px-5 py-1 rounded-full text-base text-white"
                @click=${this.onClickJoin}
                label="Join"
                ?spinner=${this.isProcessingSocialAction}
                ?disabled=${this.isProcessingSocialAction}
                transparent
                btn-style=${btnStyle}
              ></app-button>
            ` : ``}
            <app-button
              btn-class="font-semibold px-3 py-1 rounded-full text-base text-white"
              @click=${(e) => this.onClickControlsMenu(e)}
              icon="fas fa-fw fa-ellipsis-h"
              transparent
              btn-style=${btnStyle}
            ></app-button>
          ` : ''}
        </div>
      `
    }
  }

  renderCurrentView () {
    if (this.currentView === 'settings') {
      return html`
        <app-edit-profile
          user-id=${this.userId}
          .profile=${this.userProfile}
          @profile-updated=${this.onProfileUpdated}
        ></app-edit-profile>
      `
    } else if (this.currentSection) {
      return html`
        <app-custom-html
          context="profile"
          .contextState=${{page: {userId: this.userId}}}
          .userId=${this.userId}
          .blobName="ui:profile:${this.currentSection.id}"
          .html=${this.currentSection.html}
        ></app-custom-html>
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
    ViewMediaPopup.create({url: AVATAR_URL(this.userId)})
  }

  async onClickFollow (e) {
    this.isProcessingSocialAction = true
    try {
      await session.ctzn.user.table('ctzn.network/follow').create({
        subject: {userId: this.userId, dbUrl: this.userProfile.dbUrl}
      })
      await session.loadSecondaryState()
      this.followers = await session.ctzn.listFollowers(this.userId)
    } catch (e) {
      console.log(e)
      toast.create('There was an error while trying to follow this user', 'error')
    }
    this.isProcessingSocialAction = false
  }

  async onClickUnfollow (e) {
    this.isProcessingSocialAction = true
    try {
      await session.ctzn.user.table('ctzn.network/follow').delete(this.userId)
      await session.loadSecondaryState()
      this.followers = await session.ctzn.listFollowers(this.userId)
    } catch (e) {
      console.log(e)
      toast.create('There was an error while trying to unfollow this user', 'error')
    }
    this.isProcessingSocialAction = false
  }

  async onClickJoin (e) {
    this.isProcessingSocialAction = true
    try {
      await session.api.communities.join(this.userId)
      await session.loadSecondaryState()
      this.members = await listAllMembers(this.userId)
    } catch (e) {
      console.log(e)
      toast.create(e.toString(), 'error')
    }
    this.isProcessingSocialAction = false
  }

  async onClickLeave (e) {
    this.isProcessingSocialAction = true
    try {
      await session.api.communities.leave(this.userId)
      await session.loadSecondaryState()
      this.members = await listAllMembers(this.userId)
    } catch (e) {
      console.log(e)
      toast.create(e.toString(), 'error')
    }
    this.isProcessingSocialAction = false
  }

  async onClickCreatePost (e) {
    e.preventDefault()
    e.stopPropagation()
    try {
      await ComposerPopup.create({
        community: {userId: this.userId, dbUrl: this.userProfile?.dbUrl}
      })
      toast.create('Post published', '', 10e3)
      this.querySelector('ctzn-posts-feed').load()
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
        <ctzn-followers-list
          user-id=${this.userId}
          .renderOpts=${{expandedOnly: true}}
        ></ctzn-followers-list>
      `
    })
  }

  onClickViewCommunities (e) {
    e.preventDefault()
    e.stopPropagation()
    GeneralPopup.create({
      render: () => html`
        <ctzn-community-memberships-list
          user-id=${this.userId}
          .renderOpts=${{expandedOnly: true}}
        ></ctzn-community-memberships-list>
      `
    })
  }

  onClickViewMembers (e) {
    e.preventDefault()
    e.stopPropagation()
    GeneralPopup.create({
      render: () => html`
        <ctzn-community-members-list
          user-id=${this.userId}
          .renderOpts=${{expandedOnly: true}}
        ></ctzn-community-members-list>
      `
    })
  }

  onClickViewAuditLog () {
    GeneralPopup.create({
      bodyClass: 'px-0 pt-4 lg:pb-4 pb-24',
      render: () => html`
        <h2 class="border-b border-gray-300 px-4 pb-2 font-semibold text-3xl">Audit log</h2>
        <app-dbmethod-result-feed
          user-id=${this.userId}
        ></app-dbmethod-result-feed>
      `
    })
  }

  onClickControlsMenu (e) {
    e.preventDefault()
    e.stopPropagation()

    const setView = (view) => {
      emit(this, 'navigate-to', {detail: {url: `/${this.userId}/${view}`}})
    }

    let items = []
    if (this.isCommunity) {
      if (this.hasPermission('ctzn.network/perm-community-edit-profile')) {
        items.push({
          label: 'Edit profile',
          click: () => setView('settings')
        })
        items.push('-')
      }
      items.push({label: 'Audit log', click: () => this.onClickViewAuditLog()})
      if (this.amIAMember) {
        items.push('-')
        items.push({label: 'Leave community', click: () => this.onClickLeave()})
      }
    }
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
}

customElements.define('app-user-view', CtznUser)

async function listAllMembers (userId) {
  let members = []
  let gt = undefined
  for (let i = 0; i < 1000; i++) {
    let m = await session.ctzn.db(userId).table('ctzn.network/community-member').list({gt, limit: 100})
    members = m.length ? members.concat(m) : members
    if (m.length < 100) break
    gt = m[m.length - 1].key
  }
  return members
}

function intersect (a, b) {
  var arr = []
  for (let av of a) {
    if (b.includes(av)) {
      arr.push(av)
    }
  }
  return arr
}

function dedupSectionsReducer (acc, section) {
  if (!acc.find(section2 => section2.id === section.id)) {
    acc.push(section)
  }
  return acc
}