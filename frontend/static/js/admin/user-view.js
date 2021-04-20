import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { repeat } from '../../vendor/lit-element/lit-html/directives/repeat.js'
import * as session from '../lib/session.js'

class UserView extends LitElement {
  static get properties () {
    return {
      username: {type: String},
      account: {type: Array},
      currentError: {type: String}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.username = undefined
    this.account = undefined
    this.currentError = undefined
  }

  updated (changedProperties) {
    if (changedProperties.has('username')) {
      this.load()
    }
  }

  async load () {
    await session.setup()
    this.account = await session.api.server.getAccount(this.username)
    console.log(this.account)
  }

  render () {
    if (!this.account) {
      return html`<div>Loading...</div>`
    }
    return html`
      <div class="sticky top-0 z-10 flex items-center bg-pink-600 text-white sm:rounded px-3 py-2 mb-0.5 font-semibold">
        <a
          class="cursor-pointer mr-1"
          href="/admin/users"
        >
          <span class="fas fa-fw fa-arrow-left"></span>
        </a>
      </div>
      ${this.currentError ? html`
        <div class="bg-red-100 text-red-700 sm:rounded px-3 py-2 mb-1">
          <span class="fas fa-exclamation-triangle fa-fw"></span> ${this.currentError}
        </div>
      ` : ''}
      <div class="bg-white sm:rounded px-3 py-2 mb-1">
        <h2>
          <span class="text-2xl font-medium">${this.account.username}</span>
          <span class="text-lg font-medium">${this.account.type}</span>
        </h2>
        <div>
          <strong>Display Name:</strong>
          <span>${this.account.profile.displayName}</span>
        </div>
        <div>
          <strong>Description:</strong>
          <span>${this.account.profile.description}</span>
        </div>
        <div>
          <a
            class="text-blue-600 hover:underline cursor-pointer"
            href="/admin/hyperspace/db/${this.account.dkey}"
          >
            View database
          </a>
        </div>
      </div>
      ${this.account.members ? html`
        <div class="bg-white sm:rounded px-3 py-3 mb-1">
          <h3 class="font-semibold">Members (${this.account.members.length})</h3>
          <div class="rounded px-2 py-2 bg-gray-100">
            ${repeat(this.account.members, member => member.key, member => html`
              <div class="flex items-center justify-between bg-white rounded mb-0.5 px-2 py-1">
                <span>${member.key}</span>
                ${member.value.roles?.includes('admin') ? html`<strong>Admin</strong>` : ''}
              </a>
            `)}
          </div>
        </div>
      ` : ''}
      <div class="bg-white sm:rounded px-3 py-3 mb-1">
        ${this.account.type === 'community' ? html`
          <button
            class="px-2 py-1 rounded text-gray-600 text-sm hover:bg-red-100 hover:text-red-700"
            @click=${this.onAddAdmin}
          ><span class="fas fa-fw fa-user-plus"></span> Add admin</button>
          <button
            class="px-2 py-1 rounded text-gray-600 text-sm hover:bg-red-100 hover:text-red-700"
            @click=${this.onRemoveAdmin}
          ><span class="fas fa-fw fa-user-minus"></span> Remove admin</button>
        ` : ''}
        <button
          class="px-2 py-1 rounded text-gray-600 text-sm hover:bg-red-100 hover:text-red-700"
          @click=${this.onClickDeleteUser}
        ><span class="fas fa-fw fa-trash"></span> Delete ${this.account.type}</button>
      </div>
    `
  }

  // events
  // =

  async onClickDeleteUser (e) {
    this.currentError = undefined
    if (!confirm('Delete this user?')) {
      return
    }
    if (!confirm('Are you SURE you want to delete this user??')) {
      return
    }
    try {
      await session.api.server.removeUser(this.username)
      alert('User deleted')
    } catch (e) {
      this.currentError = e.toString()
    }
  }

  async onAddAdmin () {
    this.currentError = undefined
    let userId = prompt('UserID to add to admins')
    if (!userId) return
    try {
      await session.api.server.addCommunityAdmin(this.account.userId, userId)
    } catch (e) {
      this.currentError = e.toString()
    }
    await this.load()
  }

  async onRemoveAdmin () {
    this.currentError = undefined
    let userId = prompt('UserID to remove from admins')
    if (!userId) return
    try {
      await session.api.server.removeCommunityAdmin(this.account.userId, userId)
    } catch (e) {
      this.currentError = e.toString()
    }
    await this.load()
  }
}
customElements.define('app-user-view', UserView)