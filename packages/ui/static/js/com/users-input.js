import { LitElement, html } from '../../vendor/lit/lit.min.js'
import { repeat } from '../../vendor/lit/directives/repeat.js'
import * as session from '../lib/session.js'
import * as displayNames from '../lib/display-names.js'
import { emit } from '../lib/dom.js'
import './button.js'
import {
  AVATAR_URL
} from '../lib/const.js'
export class UsersInput extends LitElement {
  static get properties () {
    return {
      value: {type: String},
      currentFilter: {type: String},
      currentSuggestionsSelection: {type: Number},
      users: {type: Array}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.value = ''
    this.currentFilter = ''
    this.currentSuggestionsSelection = undefined
    this.users = undefined
  }
  
  get filteredUsers () {
    return this.users.filter(userId => userId.includes(this.currentFilter))
  }

  setValue (value) {
    this.value = value
    emit(this, 'change-user', {detail: {value}})
  }

  // rendering
  // =

  render () {
    const c = this.currentSuggestionsSelection
    return html`
      <div class="bg-white">
        <input
          class="block bg-transparent w-full px-2 py-1 border border-gray-300 rounded-t"
          @keydown=${this.onKeydown}
          @keyup=${this.onKeyup}
          placeholder="Filter..."
        >
        <div class="overflow-y-auto grid grid-cols-2 border border-t-0 border-gray-300 rounded-b" style="max-height: 300px">
          ${repeat(this.filteredUsers, userId => userId, (userId, i) => html`
            <div
              class="
                flex items-center px-2 py-1.5 cursor-pointer
                ${this.value === userId ? 'bg-blue-600 text-white' : c === i ? 'bg-gray-100' : 'hov:hover:bg-gray-100'}
              "
              @click=${e => {this.setValue(userId)}}
            >
              <img
                class="h-12 mr-2 object-cover rounded-lg w-12"
                src=${AVATAR_URL(userId)}
              >
              <div class="min-w-0">
                <div class="truncate">${displayNames.render(userId)}</div>
                <div class="truncate text-xs ${this.value === userId ? 'text-blue-200' : 'text-gray-500'}">${userId}</div>
              </div>
            </div>
          `)}
        </div>
      </div>
    `
  }

  // events
  // =

  onKeydown (e) {
    if (e.code === 'ArrowUp') {
      if (typeof this.currentSuggestionsSelection === 'undefined') {
        this.currentSuggestionsSelection = 0
      }
      this.currentSuggestionsSelection = Math.max(0, this.currentSuggestionsSelection - 1)
    } else if (e.code === 'ArrowDown') {
      if (typeof this.currentSuggestionsSelection === 'undefined') {
        this.currentSuggestionsSelection = -1
      }
      this.currentSuggestionsSelection = Math.min(this.filteredUsers.length - 1, this.currentSuggestionsSelection + 1)
    } else if (e.code === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      this.setValue(this.filteredUsers[this.currentSuggestionsSelection])
      this.querySelector('input').blur()
    }
  }

  onKeyup (e) {
    this.currentFilter = e.currentTarget.value
  }
}

customElements.define('app-users-input', UsersInput)
