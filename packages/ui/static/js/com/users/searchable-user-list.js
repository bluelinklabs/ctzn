import { LitElement, html } from '../../../vendor/lit/lit.min.js'
import { repeat } from '../../../vendor/lit/directives/repeat.js'
import { AVATAR_URL } from '../../lib/const.js'
import { emit } from '../../lib/dom.js'
import * as session from '../../lib/session.js'
import * as displayNames from '../../lib/display-names.js'

export class SearchableUserList extends LitElement {
  static get properties () {
    return {
      filter: {type: String},
      widgetMode: {type: Boolean, attribute: 'widget-mode'},
      highlightIndex: {type: Number}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.filter = ''
    this.widgetMode = false
    this.highlightIndex = 0
  }

  firstUpdated () {
    this.querySelector('input').focus()
  }

  updated (changedProperties) {
    if (changedProperties.has('filter')) {
      this.highlightIndex = Math.max(0, Math.min(this.highlightIndex, this.numResults - 1))
    }
  }

  moveSelectionUp () {
    this.highlightIndex = Math.max(this.highlightIndex - 1, 0)
    this.updateComplete.then(() => this.scrollToSelection())
  }

  moveSelectionDown () {
    this.highlightIndex = Math.min(this.highlightIndex + 1, this.numResults - 1)
    this.updateComplete.then(() => this.scrollToSelection())
  }

  navigateToSelection () {
    let el = this.querySelector(this.widgetMode ? '.current-selection' : '.result')
    if (!el || !el.getAttribute('href')) return
    emit(this, 'navigate-to', {detail: {url: el.getAttribute('href')}})
  }

  scrollToSelection () {
    const el = this.querySelector('.current-selection')
    const container = this.querySelector('#results-container')
    if (!el || !container) return
    const containerRect = container.getClientRects()[0]
    const elementRect = el.getClientRects()[0]
    const {offsetTop} = el
    const scrolledTop = el.getBoundingClientRect().top
    if (scrolledTop < 20) {
      container.scrollTo(0, offsetTop)
    } else if (scrolledTop > containerRect.bottom) {
      container.scrollTo(0, offsetTop - containerRect.height + elementRect.height)
    }
  }

  // rendering
  // =

  get hasFilter () {
    return !!this.filter
  }

  get numResults () {
    const me = this.getFilteredMe()
    const users = this.getFilteredUsers()
    const looksLikeDbKey = /^[0-9a-f]{64}$/.test(this.filter)
    return (!!me ? 1 : 0) + (looksLikeDbKey ? 1 : 0) + users?.length
  }

  testUserId (userId) {
    if (!this.filter) return true
    if (userId.toLowerCase().includes(this.filter)) return true
    if (displayNames.get(userId).toLowerCase().includes(this.filter)) return true
    return false
  }

  getFilteredMe () {
    const username = session.info.username
    return this.testUserId(username) ? username : undefined
  }

  getFilteredUsers () {
    return (session.myFollowing || []).filter(userId => this.testUserId(userId))
  }

  render () {
    const me = this.getFilteredMe()
    const users = this.getFilteredUsers()
    const looksLikeDbKey = /^[0-9a-f]{64}$/.test(this.filter)
    let itemIndex = 0
    const renderItem = (href, title, inner) => {
      let isHighlighted = (this.widgetMode && itemIndex++ === this.highlightIndex)
      return html`
        <a
          class="
            result flex items-center pl-2 pr-4 py-2 text-sm border-b border-gray-200 hov:hover:bg-gray-100
            ${isHighlighted ? 'current-selection bg-gray-100' : ''}
          "
          href=${href}
          title=${title}
          @mousedown=${this.onMousedownResult}
        >
          ${inner}
        </a>
      `
    }
    return html`
      <div class="
        flex items-center border-gray-300
        ${this.widgetMode
          ? 'border-b py-3 px-4 text-sm'
          : 'border-t border-b bg-gray-100 px-3 py-2'
        }
      ">
        <span class="fas fa-search text-sm text-gray-500 mr-3"></span>
        <input
          type="text"
          class="w-full bg-transparent"
          placeholder="Search"
          @keyup=${this.onKeyupFilter}
          @keydown=${this.onKeydownFilter}
          @blur=${e => emit(this, 'blur')}
        >
      </div>
      <div
        id="results-container"
        class="relative ${this.widgetMode ? 'overflow-y-auto' : ''}"
        style="${this.widgetMode ? 'max-height: 75vh' : ''}"
      >
        ${looksLikeDbKey ? html`
          ${renderItem(`/${this.filter}`, this.filter, html`
            <span class="bg-gray-100 fa-arrow-right fas mr-2 py-2 rounded text-center w-8"></span>
            Go to ${this.filter}
          `)}
        ` : ''}
        ${me ? html`
          ${renderItem(`/${me}`, me, html`
            <img class="w-8 h-8 object-cover rounded-md mr-2" src=${AVATAR_URL(me)} style="left: 10px; top: 6px">
            ${displayNames.render(me)}
          `)}
        ` : ''}
        ${users?.length ? html`
          <h3 class="font-bold px-2 py-2 text-xs border-b border-gray-200">
            Following
          </h3>
          ${repeat(users, f => f, userId => renderItem(`/${userId}`, userId, html`
            <img
              class="lazyload w-8 h-8 object-cover rounded-md mr-2"
              data-src=${AVATAR_URL(userId)}
            >
            <span class="truncate">${displayNames.render(userId)}</span>
          </a>
        `))}
        ` : ''}
      </div>
    `
  }

  // events
  // =

  onKeyupFilter (e) {
    this.filter = e.currentTarget.value.toLowerCase().trim()
  }

  onKeydownFilter (e) {
    if (e.code === 'Enter') {
      e.preventDefault()
      this.navigateToSelection()
      this.querySelector('input').blur()
    } else if (e.code === 'ArrowUp') {
      e.preventDefault()
      this.moveSelectionUp()
    } else if (e.code === 'ArrowDown') {
      e.preventDefault()
      this.moveSelectionDown()
    }
  }

  onMousedownResult (e) {
    const href = e.currentTarget.getAttribute('href')
    if (href) emit(this, 'navigate-to', {detail: {url: href}})
  }
}

customElements.define('app-searchable-user-list', SearchableUserList)
