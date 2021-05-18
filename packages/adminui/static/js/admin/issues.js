import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { repeat } from '../../vendor/lit-element/lit-html/directives/repeat.js'
import * as session from '../lib/session.js'

const FETCH_INTERVAL = 10e3

class Issues extends LitElement {
  static get properties () {
    return {
      issues: {type: Array},
      filter: {type: String}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.issues = undefined
    this.filter = ''
    this.fetchInterval = undefined
  }

  get filteredIssues () {
    if (!this.filter || !this.issues) return this.issues
    return this.issues.filter(issue => {
      return !!issue.entries.find(entry => (
        entry.cause.toLowerCase().includes(this.filter)
        || entry.description.toLowerCase().includes(this.filter)
        || entry.error.toLowerCase().includes(this.filter)
      ))
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
    this.issues = await session.api.server.listIssues()
    document.body.querySelector('#issue-count').textContent = String(this.issues.length)
    console.log(this.issues)
  }

  render () {
    if (!this.issues) {
      return html`
        <div class="px-3 py-3">
          <h1 class="text-2xl font-semibold">Issues</h1>
        </div>
        <div>Loading...</div>
      `
    }
    return html`
      <div class="pb-2">
        <div class="flex items-center justify-between px-3 py-3">
          <h1 class="text-2xl font-semibold">Issues</h1>
          <input
            class="border border-gray-300 rounded-full px-3 py-1"
            placeholder="Search"
            @keyup=${this.onSearchChange}
            @change=${this.onSearchChange}
          >
        </div>
        <div class="sticky top-0 z-10 row flex items-center border-b-2 border-pink-600 bg-white px-3 py-2 mb-0.5 font-semibold">
          <div class="truncate">Issue</div>
          <div class="truncate">Repetitions</div>
        </div>
        ${repeat(this.filteredIssues, issue => issue.id, issue =>  html`
          <a
            class="row flex items-center px-3 py-2 cursor-pointer zebra-row zebra-row-hovers"
            href="/admin/issues/view/${issue.id}"
          >
            <div class="truncate">${issue.entries[0].description}</div>
            <div class="truncate">${issue.entries?.length}</div>
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
customElements.define('app-issues', Issues)