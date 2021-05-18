import { LitElement, html } from '../../vendor/lit/lit.min.js'
import { repeat } from '../../vendor/lit/directives/repeat.js'
import { unsafeHTML } from '../../vendor/lit/directives/unsafe-html.js'
import { AVATAR_URL, BLOB_URL } from '../lib/const.js'
import * as session from '../lib/session.js'
import { makeSafe, linkify } from '../lib/strings.js'
import { emojify } from '../lib/emojify.js'
import './button.js'
import './img-fallbacks.js'

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
      const profile = await session.ctzn.getProfile(id)
      if (profile.error) {
        profile.userId = id
      }
      this.profiles.push(profile)
      this.requestUpdate()
      
      if (profile.error) {
        continue
      }

      const [followers, following] = await Promise.all([
        session.ctzn.listFollowers(id).catch(e => undefined),
        session.ctzn.db(id).table('ctzn.network/follow').list().catch(e => undefined)
      ])
      profile.isFollowingMe = session.isActive() && !!following?.find(f => f.value.subject.userId === session.info.userId)
      profile.amIFollowing = session.isActive() && !!followers?.find(f => f === session.info.userId)
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
        ${repeat(this.profiles, profile => profile.userId, profile => {
          if (profile.error) {
            return html`
              <div class="profile error">
                <div class="error-info">
                  <span class="fas fa-exclamation-circle"></span>
                  Failed to load profile
                </div>
                <div class="id">
                  <a class="username" href="/${profile.userId}" title=${profile.userId}>
                    ${profile.userId}
                  </a>
                </div>
                <div class="description">${profile.message}</div>
              </div>
            `
          }
          const userId = (new URL(profile.url)).pathname.split('/')[1]
          return html`
            <div class="rounded relative border border-gray-200">
              <div
                class="rounded-t"
                style="height: 80px; background: linear-gradient(0deg, #3c4af6, #2663eb);"
              >
                <app-img-fallbacks>
                  <img
                    slot="img1"
                    class="rounded-t"
                    style="display: block; object-fit: cover; width: 100%; height: 80px;"
                    src=${BLOB_URL(userId, 'profile-banner')}
                  >
                  <div slot="img2"></div>
                </app-img-fallbacks>
              </div>
              <div class="absolute text-center w-full" style="top: 40px">
                <a href="/${userId}" title=${profile.value.displayName}>
                  <img
                    class="border-2 border-white inline-block object-cover rounded-xl shadow-md bg-white"
                    src=${AVATAR_URL(userId)}
                    style="width: 60px; height: 60px"
                  >
                </a>
              </div>
              <div class="pt-8 pb-2 px-4 bg-white rounded-lg mt-1">
                <div class="text-center">
                  <div class="font-medium text-lg truncate leading-tight">
                    <a href="/${profile.userId}" title=${profile.value.displayName}>
                      ${unsafeHTML(emojify(makeSafe(profile.value.displayName)))}
                    </a>
                  </div>
                  <div class="mb-3">
                    <a class="font-medium text-gray-500 text-sm truncate" href="/${profile.userId}" title=${profile.value.displayName}>
                      ${userId}
                    </a>
                  </div>
                  <div class="text-sm mb-4 break-words">${unsafeHTML(linkify(emojify(makeSafe(profile.value.description))))}</div>
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
      ${profile.userId === session?.info?.userId ? html`
        <div class="text-center"><span class="bg-gray-200 rounded text-sm text-gray-500 py-0.5 px-2">This is you</span></div>
      ` : html`
        <div class="text-center">
          ${profile.amIFollowing ? html`
            <app-button transparent btn-class="rounded-full border border-gray-400 text-sm mb-2 py-1 shadow-none hov:hover:bg-gray-200" @click=${e => this.onClickUnfollow(e, profile)} label="Unfollow"></app-button>
          ` : html`
            <app-button transparent btn-class="rounded-full border border-blue-500 text-blue-600 text-sm mb-2 py-1 shadow-none hov:hover:bg-gray-200" @click=${e => this.onClickFollow(e, profile)} label="Follow"></app-button>
          `}
          ${profile.isFollowingMe ? html`
            <span class="text-sm text-gray-500 py-0.5 px-2">Follows you</span>
          ` : ''}
        </div>
      `}
    `
  }

  // events
  // =

  async onClickFollow (e, profile) {
    e.preventDefault()
    await session.ctzn.user.table('ctzn.network/follow').create({
      subject: {userId: profile.userId, dbUrl: profile.dbUrl}
    })
    profile.amIFollowing = true
    this.requestUpdate()
  }

  async onClickUnfollow (e, profile) {
    e.preventDefault()
    await session.ctzn.user.table('ctzn.network/follow').delete(profile.userId)
    profile.amIFollowing = false
    this.requestUpdate()
  }
}

customElements.define('app-user-list', UserList)
