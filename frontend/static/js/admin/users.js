import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { repeat } from '../../vendor/lit-element/lit-html/directives/repeat.js'
import * as session from '../lib/session.js'

const FETCH_INTERVAL = 10e3
const USER_TYPE_ORDERING = [
  'community',
  'citizen'
]

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
      if (a.type === b.type) return (a.userId || '').localeCompare(b.userId)
      let aI = USER_TYPE_ORDERING.indexOf(a.type)
      if (aI === -1) aI = USER_TYPE_ORDERING.length
      let bI = USER_TYPE_ORDERING.indexOf(b.type)
      if (bI === -1) bI = USER_TYPE_ORDERING.length
      return aI - bI
    })
    console.log(this.accounts)
  }

  render () {
    if (!this.accounts) {
      return html`
        <div class="px-3 py-3">
          <h1 class="text-2xl font-semibold">Users</h1>
        </div>
        <div>Loading...</div>
      `
    }
    let lastType = undefined
    const TYPE_MAP = {community: 'Communities', citizen: 'Citizens'}
    return html`
      <div class="pb-8">
        <div class="flex items-center justify-between px-3 py-3">
          <h1 class="text-2xl font-semibold">Users</h1>
          <input
            class="border border-gray-300 rounded-full px-3 py-1"
            placeholder="Search"
            @keyup=${this.onSearchChange}
            @change=${this.onSearchChange}
          >
        </div>
        <div class="sticky top-0 z-10 row flex items-center border-b-2 border-pink-600 bg-white px-3 py-2 mb-0.5 font-semibold">
          <div class="truncate">User ID</div>
          <div class="truncate">Display Name</div>
          <div class="truncate">Type</div>
        </div>
        ${repeat(this.filteredAccounts, account => account.userId, account => {
          const res = html`
            ${account.type !== lastType ? html`
              <div class="pt-3 pb-1 px-1 border-b border-gray-300 text-base font-medium">${TYPE_MAP[account.type]}</div>
            ` : ''}
            <a
              class="row flex items-center px-3 py-2 cursor-pointer zebra-row zebra-row-hovers"
              href="/admin/users/view/${account.username}"
            >
              <div class="truncate">${account.username}</div>
              <div class="truncate">${account.displayName}</div>
              <div class="truncate">${account.type}</div>
            </a>
          `
          lastType = account.type
          return res
        })}
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