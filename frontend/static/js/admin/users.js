import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { repeat } from '../../vendor/lit-element/lit-html/directives/repeat.js'
import * as session from '../lib/session.js'

const FETCH_INTERVAL = 10e3

class Users extends LitElement {
  static get properties () {
    return {
      accounts: {type: Array},
      filter: {type: String}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.accounts = undefined
    this.filter = ''
    this.fetchInterval = undefined
  }

  get filteredAccounts () {
    if (!this.filter || !this.accounts) return this.accounts
    return this.accounts.filter(account => {
      return (
        account.username.toLowerCase().includes(this.filter)
        || account.displayName.toLowerCase().includes(this.filter)
      )
    })
  }

  connectedCallback () {
    super.connectedCallback()
    this.load()
    this.fetchInterval = setInterval(() => this.load(), FETCH_INTERVAL)
  }

  disconnectedCallback () {
    super.disconnectedCallback()
    clearInterval(this.fetchInterval)
  }

  async load () {
    await session.setup()
    this.accounts = await session.api.server.listAccounts()
    this.accounts.sort((a, b) => {
      return a.userId.toLowerCase().localeCompare(b.userId.toLowerCase())
    })
    console.log(this.accounts)
  }

  render () {
    if (!this.accounts) {
      return html`
        <div class="bg-white sm:rounded px-4 py-3 my-2">
          <h1 class="text-2xl font-semibold">Users</h1>
        </div>
        <div>Loading...</div>
      `
    }
    return html`
      <div class="pb-8">
        <div class="flex items-center justify-between bg-white sm:rounded px-4 py-3 my-2">
          <h1 class="text-2xl font-semibold">Users</h1>
          <input
            class="border border-gray-200 rounded-full px-3 py-1"
            placeholder="Search"
            @keyup=${this.onSearchChange}
            @change=${this.onSearchChange}
          >
        </div>
        <div class="sticky top-0 z-10 row flex items-center bg-pink-600 text-white sm:rounded px-3 py-2 mb-0.5 font-semibold">
          <div class="truncate">User ID</div>
          <div class="truncate">Display Name</div>
          <div class="truncate">Type</div>
        </div>
        ${repeat(this.filteredAccounts, account => account.userId, account =>  html`
          <a
            class="row flex items-center bg-white sm:rounded px-3 py-2 mb-0.5 hover:bg-gray-50 cursor-pointer"
            href="/admin/users/view/${account.username}"
          >
            <div class="truncate">${account.username}</div>
            <div class="truncate">${account.displayName}</div>
            <div class="truncate">${account.type}</div>
          </a>
        `)}
      </div>
    `
  }

  // events
  // =

  onSearchChange (e) {
    this.filter = e.currentTarget.value.trim().toLowerCase()
  }
}
customElements.define('app-users', Users)