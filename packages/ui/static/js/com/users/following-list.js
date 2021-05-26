import { LitElement, html } from '../../../vendor/lit/lit.min.js'
import * as session from '../../lib/session.js'
import './simple-user-list.js'

export class FollowingList extends LitElement {
  static get properties () {
    return {
      userId: {type: String, attribute: 'user-id'},
      following: {type: Array},
      sharedFollowers: {type: Array},
      isExpanded: {type: Boolean}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.view = undefined
    this.userId = undefined
    this.following = undefined
    this.isExpanded = false
  }

  updated (changedProperties) {
    if (changedProperties.has('userId') && this.userId !== changedProperties.get('userId')) {
      this.load()
    }
  }

  async load () {
    this.isExpanded = false
    this.following = undefined
    this.following = (await session.api.db(this.userId).table('ctzn.network/follow').list()).entries
  }

  // rendering
  // =

  render () {
    if (typeof this.following === 'undefined') {
      return html`
        <div class="px-5 py-3">
          <span class="text-lg font-medium mr-1">Following</span>
          <span class="spinner text-gray-500"></span>
        </div>
      `
    }
    return html`
      <div
        class="px-5 py-3 ${this.following?.length ? 'cursor-pointer is-toggleable' : ''}"
        @click=${this.following?.length ? this.onToggleExpanded : undefined}
      >
        <div class="flex items-center justify-between">
          <span>
            <span class="label mr-1">Following</span>
            <span class="count">${this.following?.length || '0'}</span>
          </span>
          ${this.following?.length ? html`
            <span class="fas fa-angle-${this.isExpanded ? 'up' : 'down'}"></span>
          ` : ''}
        </div>
      </div>
      ${this.isExpanded ? html`
        <app-simple-user-list .ids=${this.following?.map(f => f.value.subject.userId)} empty-message="${this.userId} is not following anybody."></app-simple-user-list>
      ` : ''}
    `
  }

  // events
  // =

  onToggleExpanded (e) {
    this.isExpanded = !this.isExpanded
  }
}

customElements.define('app-following-list', FollowingList)
