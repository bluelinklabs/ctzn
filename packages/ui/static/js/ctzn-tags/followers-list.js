import { LitElement, html } from '../../vendor/lit/lit.min.js'
import { repeat } from '../../vendor/lit/directives/repeat.js'
import { intersect } from '../lib/functions.js'
import * as session from '../lib/session.js'
import { AVATAR_URL } from '../lib/const.js'
import '../com/simple-user-list.js'

export class FollowersList extends LitElement {
  static get properties () {
    return {
      userId: {type: String, attribute: 'user-id'},
      followers: {type: Array},
      sharedFollowers: {type: Array},
      isExpanded: {type: Boolean},
      renderOpts: {type: Boolean}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.setAttribute('ctzn-elem', '1')
    this.view = undefined
    this.userId = undefined
    this.followers = undefined
    this.sharedFollowers = undefined
    this.isExpanded = false
    this.renderOpts = {expandedOnly: false}
  }

  get showExpanded () {
    return this.isExpanded || this.renderOpts?.expandedOnly
  }

  get canToggleExpanded () {
    return !this.renderOpts?.expandedOnly && this.followers?.length
  }

  setContextState (state) {
    if (state?.page?.userId) {
      if (!this.userId) {
        this.userId = state.page.userId
      }
    }
  }

  updated (changedProperties) {
    if (changedProperties.has('userId') && this.userId !== changedProperties.get('userId')) {
      this.load()
    }
  }

  async load () {
    this.isExpanded = false
    this.followers = undefined
    this.sharedFollowers = undefined

    this.followers = await session.ctzn.listFollowers(this.userId)
    if (session.isActive() && this.userId !== session.info.userId) {
      this.sharedFollowers = intersect(session.myFollowing, this.followers)
    }
  }

  // rendering
  // =

  render () {
    if (typeof this.followers === 'undefined') {
      return html`
        <div class="bg-white sm:rounded px-5 py-3">
          <span class="text-lg font-medium mr-1">Followers</span>
          <span class="spinner text-gray-500"></span>
        </div>
      `
    }
    return html`
      <div class="bg-white sm:rounded">
        <div
          class="px-5 py-3 sm:rounded ${this.canToggleExpanded ? 'cursor-pointer hov:hover:text-blue-600' : ''}"
          @click=${this.canToggleExpanded ? this.onToggleExpanded : undefined}
        >
          <div class="flex items-center justify-between">
            <span>
              <span class="text-lg font-medium mr-1">Followers</span>
              <span class="text-gray-500 font-bold">${this.followers?.length || '0'}</span>
            </span>
            ${this.canToggleExpanded ? html`
              <span class="fas fa-angle-${this.showExpanded ? 'up' : 'down'}"></span>
            ` : ''}
          </div>
          ${this.sharedFollowers?.length ? html`
            <div class="pt-1 flex items-center text-gray-500">
              <span class="mr-2">Shared:</span>
              ${repeat(this.sharedFollowers.slice(0, 7), (userId, i) => html`
                <span data-tooltip=${userId}>
                  <img src=${AVATAR_URL(userId)} class="inline-block rounded-md w-7 h-7 mr-1">
                </span>
              `)}
              ${this.sharedFollowers.length > 7 ? html`<span class="font-semibold ml-1">+${this.sharedFollowers.length - 7}` : ''}
            </div>
          ` : ''}
        </div>
        ${this.showExpanded ? html`
          <app-simple-user-list .ids=${this.followers} empty-message="${this.userId} has no followers."></app-simple-user-list>
        ` : ''}
      </div>
    `
  }

  // events
  // =

  onToggleExpanded (e) {
    this.isExpanded = !this.isExpanded
  }
}

customElements.define('ctzn-followers-list', FollowersList)
