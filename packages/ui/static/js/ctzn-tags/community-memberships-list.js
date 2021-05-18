import { LitElement, html } from '../../vendor/lit/lit.min.js'
import { repeat } from '../../vendor/lit/directives/repeat.js'
import { intersect } from '../lib/functions.js'
import * as session from '../lib/session.js'
import * as displayNames from '../lib/display-names.js'
import { AVATAR_URL } from '../lib/const.js'

export class CommunityMembershipsList extends LitElement {
  static get properties () {
    return {
      userId: {type: String, attribute: 'user-id'},
      memberships: {type: Array},
      sharedCommunities: {type: Array},
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
    this.memberships = undefined
    this.sharedCommunities = undefined
    this.isExpanded = false
    this.renderOpts = {expandedOnly: false}
  }

  get showExpanded () {
    return this.isExpanded || this.renderOpts?.expandedOnly
  }

  get canToggleExpanded () {
    return !this.renderOpts?.expandedOnly && this.memberships?.length
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
    this.memberships = undefined
    this.sharedCommunities = undefined

    this.memberships = await session.ctzn.db(this.userId).table('ctzn.network/community-membership').list()
    if (session.isActive() && this.userId !== session.info.userId) {
      this.sharedCommunities = intersect(
        session.myCommunities.map(c => c.userId),
        this.memberships.map(m => m.value.community.userId)
      )
    }
  }

  // rendering
  // =

  render () {
    if (typeof this.memberships === 'undefined') {
      return html`
        <div class="bg-white sm:rounded px-5 py-3">
          <span class="text-lg font-medium mr-1">Communities</span>
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
              <span class="text-lg font-medium mr-1">Communities</span>
              <span class="text-gray-500 font-bold">${this.memberships?.length || '0'}</span>
            </span>
            ${this.canToggleExpanded ? html`
              <span class="fas fa-angle-${this.isExpanded ? 'up' : 'down'}"></span>
            ` : ''}
          </div>
          ${this.sharedCommunities?.length ? html`
            <div class="pt-1 flex items-center text-gray-500">
              <span class="mr-2">Shared:</span>
              ${repeat(this.sharedCommunities.slice(0, 7), (userId, i) => html`
                <span data-tooltip=${userId}>
                  <img src=${AVATAR_URL(userId)} class="inline-block rounded-md w-7 h-7 mr-1">
                </span>
              `)}
              ${this.sharedCommunities.length > 7 ? html`<span class="font-semibold ml-1">+${this.sharedCommunities.length - 7}</span>` : ''}
            </div>
          ` : ''}
        </div>
        ${this.showExpanded ? html`
          ${repeat(this.memberships || [], (membership, i) => {
            const userId = membership.value.community.userId
            const [username, domain] = userId.split('@')
            return html`
              <div class="flex items-center px-2 py-2 border-t border-gray-200">
                <a class="ml-1 mr-3" href="/${userId}" title=${userId}>
                  <img class="block rounded-md w-10 h-10 object-cover shadow-sm" src=${AVATAR_URL(userId)}>
                </a>
                <div class="flex-1 min-w-0 truncate">
                  <a class="hov:hover:underline" href="/${userId}" title=${userId}>
                    <span class="font-medium">${displayNames.render(userId)}</span>
                  </a>
                  <span class="hidden sm:inline text-sm text-gray-500">${domain}</span>
                </div>
              </div>
            `
          })}
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

customElements.define('ctzn-community-memberships-list', CommunityMembershipsList)
