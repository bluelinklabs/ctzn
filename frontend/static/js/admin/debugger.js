import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { repeat } from '../../vendor/lit-element/lit-html/directives/repeat.js'
import * as session from '../lib/session.js'

const FETCH_INTERVAL = 10e3

class Debugger extends LitElement {
  static get properties () {
    return {
      isEnabled: {type: Boolean},
      currentView: {type: String},
      entries: {type: Array},
      counts: {type: Array},
      filter: {type: String}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.isEnabled = undefined
    this.currentView = 'log'
    this.entries = undefined
    this.counts = {}
    this.filter = ''
    this.fetchInterval = undefined
  }

  get filteredEntries () {
    if (!this.filter || !this.entries) return this.entries
    return this.entries.filter(entry => {
      for (let k in entry) {
        if (String(entry[k]).toLowerCase().includes(this.filter)) {
          return true
        }
      }
      return false
    })
  }

  get filteredCounts () {
    let countEntries = Object.entries(this.counts)
    if (!this.filter) return countEntries
    return countEntries.filter(([evt, count]) => evt.toLowerCase().includes(this.filter))
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
    this.isEnabled = await session.api.server.isDebuggerEnabled()
    if (this.currentView === 'log') {
      this.entries = await session.api.server.listDebugEvents({timespan: 'all'})
    } else if (this.currentView === 'counts') {
      this.counts = await session.api.server.countMultipleDebugEvents({timespan: 'month'})
    }
  }

  render () {
    return html`
      <div class="pb-2">
        <div class="flex items-center justify-between px-3 py-3">
          <h1 class="text-2xl font-semibold">Debugger</h1>
          <input
            class="border border-gray-300 rounded-full px-3 py-1"
            placeholder="Search"
            @keyup=${this.onSearchChange}
            @change=${this.onSearchChange}
          >
        </div>
        <div class="px-2 pb-2">
          <div>
            <button
              class="px-2 py-1 border border-pink-600 text-pink-600 hover:bg-pink-50 cursor-pointer rounded"
              @click=${this.onToggleDebugger}
            >
              ${this.isEnabled ? 'Stop logging' : 'Start logging'}
            </button>
            <button
              class="px-3 py-1 ml-1 text-gray-600 hover:text-pink-600 hover:bg-pink-50 cursor-pointer rounded"
              @click=${this.onClearLog}
            >
              Clear log
            </button>
          </div>
        </div>
        <div class="sticky top-0 z-10 row flex items-center border-b-2 border-pink-600 px-2 py-2 mb-0.5 bg-white">
          <span
            class="inline-block px-4 py-2 mr-1 rounded cursor-pointer ${this.currentView === 'log' ? 'bg-pink-50 text-pink-600' : ''} hover:bg-pink-50 hover:text-pink-600"
            @click=${e => this.setCurrentView('log')}
          >Log</span>
          <span
            class="inline-block px-4 py-2 mr-1 rounded cursor-pointer ${this.currentView === 'counts' ? 'bg-pink-50 text-pink-600' : ''} hover:bg-pink-50 hover:text-pink-600"
            @click=${e => this.setCurrentView('counts')}
          >Counts</span>
        </div>
        <div class="text-xs font-mono">
          ${this.currentView === 'log' ? html`
            ${repeat(this.filteredEntries || [], (entry, i) => i, entry =>  html`
              <div class="row truncate px-3 py-2 zebra-row zebra-row-hovers">
                <span>${entry.event}</span>
                <span class="text-gray-500">${describeEntry(entry)}</span>
              </a>
            `)}
          ` : ''}
          ${this.currentView === 'counts' ? html`
            ${repeat(this.filteredCounts || [], (entry, i) => i, entry =>  html`
              <div class="flex row truncate px-3 py-2 zebra-row zebra-row-hovers">
                <span style="flex: 0 0 60px">${entry[1]}</span>
                <span>${entry[0]}</span>
              </a>
            `)}
          ` : ''}
        </div>
      </div>
    `
  }

  // entries
  // =

  onSearchChange (e) {
    this.filter = e.currentTarget.value.trim().toLowerCase()
  }

  setCurrentView (view) {
    this.currentView = view
    this.load()
  }

  async onToggleDebugger (e) {
    if (this.isEnabled) {
      await session.api.server.setDebuggerEnabled(false)
    } else {
      await session.api.server.setDebuggerEnabled(true)
    }
    this.load()
  }

  async onClearLog () {
    await session.api.server.clearDebuggerLog()
    this.entries = []
    this.counts = {}
    // this.load()
  }
}
customElements.define('app-debugger', Debugger)

function describeEntry (entry) {
  var attrs = []
  for (let k in entry) {
    if (k === 'event' || k === 'ts') continue
    attrs.push(`${k}=${entry[k]}`)
  }
  attrs.push((new Date(entry.ts)).toLocaleTimeString())
  return attrs.join(' ')
}