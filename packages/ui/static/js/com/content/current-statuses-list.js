import { LitElement, html } from '../../../vendor/lit/lit.min.js'
import { repeat } from '../../../vendor/lit/directives/repeat.js'
import * as session from '../../lib/session.js'
import './current-status.js'
import '../users/mini-profile.js'

const ICONS = {
  currentStatus: 'far fa-clock',
  listeningTo: 'fas fa-headphones-alt',
  watching: 'fas fa-tv'
}

export class CurrentStatusesList extends LitElement {
  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.onSecondaryStateChange = () => this.requestUpdate()
  }

  connectedCallback () {
    super.connectedCallback()
    session.onSecondaryState(this.onSecondaryStateChange)
  }

  disconnectedCallback () {
    super.connectedCallback()
    session.unOnSecondaryState(this.onSecondaryStateChange)
  }

  // rendering
  // =

  render () {
    return html`
      ${session.isActive() ? html`
        <app-current-statuses-list-item class="block my-2" user-id=${session.info.username}></app-current-statuses-list-item>
      ` : ''}
      ${repeat(session.myFollowing || [], f => f, f => html`
        <app-current-statuses-list-item class="block my-2" user-id=${f}></app-current-statuses-list-item>
      `)}
    `
  }

  // events
  // =
}

customElements.define('app-current-statuses-list', CurrentStatusesList)

export class CurrentStatusesListItem extends LitElement {
  static get properties () {
    return {
      isLoading: {type: Boolean},
      userId: {type: String, attribute: 'user-id'},
      currentStatus: {type: Object}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.isLoading = true
    this.userId = undefined
    this.currentStatus = undefined
  }

  updated (changedProperties) {
    if (changedProperties.has('userId') && this.userId !== changedProperties.get('userId')) {
      this.load()
    }
  }

  async load () {
    this.isLoading = true
    this.currentStatus = undefined
    this.currentStatus = (await session.api.db(this.userId).table('ctzn.network/current-status').get('self'))?.value
    this.isLoading = false
  }

  get hasNone () {
    for (let id of ['currentStatus', 'listeningTo', 'watching']) {
      if (this.currentStatus?.[id]?.text && !this.hasExpired(id)) {
        return false
      }
    }
    return true
  }

  hasExpired (id) {
    return this.currentStatus?.[id]?.expiresAt && (new Date(this.currentStatus[id].expiresAt)) < new Date()
  }

  // rendering
  // =

  render () {
    if (this.isLoading) {
      return html`
        <div class="bg-loading-gradient h-48 mx-1"></div>
      `
    }
    if (this.hasNone) return ''
    return html`
      <app-mini-profile user-id=${this.userId}></app-mini-profile>
      ${this.renderSection('currentStatus', 'Current status')}
      ${this.renderSection('listeningTo', 'Listening to')}
      ${this.renderSection('watching', 'Watching')}
    `
  }

  renderSection (id, label) {
    if (!this.currentStatus?.[id]?.text) return ''
    if (this.hasExpired(id)) return ''
    return html`
      <div class="section">
        <div class="label text-sm"><span class="text-xs fa-fw ${ICONS[id]}"></span> ${label}</div>
        <div class="text text-base">
          ${this.currentStatus?.[id]?.text ? this.currentStatus[id].text : ''}
        </div>
      </div>
    `
  }
}

customElements.define('app-current-statuses-list-item', CurrentStatusesListItem)
