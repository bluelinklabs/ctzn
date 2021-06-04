import { LitElement, html } from '../../../vendor/lit/lit.min.js'
import { repeat } from '../../../vendor/lit/directives/repeat.js'
import { unsafeHTML } from '../../../vendor/lit/directives/unsafe-html.js'
import { AVATAR_URL, BLOB_URL } from '../../lib/const.js'
import * as session from '../../lib/session.js'
import { makeSafe, linkify } from '../../lib/strings.js'
import { emojify } from '../../lib/emojify.js'
import '../button.js'
import '../img-fallbacks.js'

export class UserList extends LitElement {
  static get properties () {
    return {
      ids: {type: Array},
      profiles: {type: Array}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.ids = undefined
    this.profiles = undefined
  }

  async load () {
    this.profiles = []
    for (let id of this.ids) {
      const profile = await session.api.getProfile(id)
      if (profile.error) {
        profile.dbKey = id
      }
      this.profiles.push(profile)
      this.requestUpdate()
      
      if (profile.error) {
        continue
      }

      const [followers, following] = await Promise.all([
        session.api.listFollowers(id).catch(e => undefined),
        session.api.db(id).table('ctzn.network/follow').list().catch(e => undefined)
      ])
      profile.isFollowingMe = session.isActive() && !!following?.entries.find(f => f.value.subject.dbKey === session.info.dbKey)
      profile.amIFollowing = session.isActive() && !!followers?.find(f => f === session.info.dbKey)
      this.requestUpdate()
    }
  }

  updated (changedProperties) {
    if (changedProperties.has('ids') && changedProperties.get('ids') != this.ids) {
      this.load()
    }
  }

  // rendering
  // =

  render () {
    if (!this.profiles) {
      return html`<span class="spinner"></span>`
    }
    return html`
      <link rel="stylesheet" href="/css/fontawesome.css">
      <div>
        ${repeat(this.profiles, profile => profile.dbKey, profile => {
          if (profile.error) {
            return html`
              <div class="user error">
                <div class="error-info">
                  <span class="fas fa-exclamation-circle"></span>
                  Failed to load profile
                </div>
                <div class="id">
                  <a class="user-id" href="/${profile.dbKey}" title=${profile.dbKey}>
                    ${profile.dbKey}
                  </a>
                </div>
                <div class="description">${profile.message}</div>
              </div>
            `
          }
          const dbKey = profile.dbKey
          return html`
            <div class="user relative">
              <div
                class="banner-container"
                style="height: 80px; background: linear-gradient(0deg, #3c4af6, #2663eb);"
              >
                <app-img-fallbacks>
                  <img
                    slot="img1"
                    style="display: block; object-fit: cover; width: 100%; height: 80px;"
                    src=${BLOB_URL(dbKey, 'ctzn.network/profile', 'self', 'banner')}
                  >
                  <div slot="img2"></div>
                </app-img-fallbacks>
              </div>
              <div class="absolute text-center w-full" style="top: 40px">
                <a href="/${dbKey}" title=${profile.value.displayName}>
                  <img
                    class="avatar inline-block object-cover"
                    src=${AVATAR_URL(dbKey)}
                    style="width: 60px; height: 60px"
                  >
                </a>
              </div>
              <div class="profile-info pt-8 pb-2 px-4 mt-1">
                <div class="text-center">
                  <div class="truncate leading-tight">
                    <a class="display-name" href="/${profile.dbKey}" title=${profile.value.displayName}>
                      ${unsafeHTML(emojify(makeSafe(profile.value.displayName)))}
                    </a>
                  </div>
                  <div class="mb-3">
                    <a class="user-id truncate" href="/${profile.dbKey}" title=${profile.value.displayName}>
                      @${profile.username || profile.dbKey.slice(0, 6)}
                    </a>
                  </div>
                  <div class="description mb-4 break-words">${unsafeHTML(linkify(emojify(makeSafe(profile.value.description))))}</div>
                </div>
                ${this.renderProfileControls(profile)}
              </div>
            </div>
          `
        })}
      </div>
    `
  }

  renderProfileControls (profile) {
    if (!session.isActive()) return ''
    return html`
      ${profile.dbKey === session?.info?.dbKey ? html`
        <div class="text-center"><span class="label py-0.5 px-2">This is you</span></div>
      ` : html`
        <div class="text-center">
          ${profile.amIFollowing ? html`
            <app-button transparent btn-class="rounded-full border border-gray-400 text-sm mb-2 py-1 shadow-none hov:hover:bg-gray-200" @click=${e => this.onClickUnfollow(e, profile)} label="Unfollow"></app-button>
          ` : html`
            <app-button transparent btn-class="rounded-full border border-blue-500 text-blue-600 text-sm mb-2 py-1 shadow-none hov:hover:bg-gray-200" @click=${e => this.onClickFollow(e, profile)} label="Follow"></app-button>
          `}
          ${profile.isFollowingMe ? html`
            <span class="label py-0.5 px-2">Follows you</span>
          ` : ''}
        </div>
      `}
    `
  }

  // events
  // =

  async onClickFollow (e, profile) {
    e.preventDefault()
    await session.api.user.table('ctzn.network/follow').create({
      subject: {dbKey: profile.dbKey}
    })
    profile.amIFollowing = true
    this.requestUpdate()
  }

  async onClickUnfollow (e, profile) {
    e.preventDefault()
    await session.api.user.table('ctzn.network/follow').delete(profile.dbKey)
    profile.amIFollowing = false
    this.requestUpdate()
  }
}

customElements.define('app-user-list', UserList)
