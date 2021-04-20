import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { repeat } from '../../vendor/lit-element/lit-html/directives/repeat.js'
import * as session from '../lib/session.js'
import bytes from '../../vendor/bytes/index.js'

const FETCH_INTERVAL = 2e3

class HyperspaceLog extends LitElement {
  static get properties () {
    return {
      dkey: {type: String},
      entries: {type: Array},
      expandedEntries: {type: Object}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.dkey = undefined
    this.entries = undefined
    this.expandedEntries = {}
    this.fetchInterval = undefined
  }

  updated (changedProperties) {
    if (changedProperties.has('dkey')) {
      this.load()
    }
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
    try {
      await session.setup()
      let entries = await session.api.server.queryHyperspaceLog({dkey: this.dkey})
      this.entries = entries.reduce(reduceRelatedEntries, [])
    } catch (e) {
      console.error(e)
    }
  }

  render () {
    if (!this.entries) {
      return html`<div>Loading...</div>`
    }
    return html`
      <div class="bg-white font-mono text-sm sm:rounded">
        ${repeat(this.entries, (entry, i) => i, (entry, i) => this.renderEntry(entry, i))}
      </div>
    `
  }

  renderEntry (entry, i) {
    return html`
      <div
        class="row flex items-center border-b border-gray-200 pl-2 py-0.5 hover:bg-gray-50"
        @click=${e => this.onClickEntry(e, entry, i)}
      >
        <div>
          <a href="/admin/hyperspace/db/${entry.dkey}" class="text-blue-600 cursor-pointer hover:underline">
            ${entry.dkey.slice(0, 6)}..${entry.dkey.slice(-2)}
          </a>
        </div>
        <div>${entry.event}</div>
        <div>
          ${this.renderEntryDetails(entry, i)}
          ${entry.mergedEntries?.length ? html`
            <span class="bg-pink-200 text-pink-600 rounded px-1 cursor-pointer hover:bg-pink-300">
              x${entry.mergedEntries.length + 1} entries
            </span>
          ` : ''}
        </div>
        <div>${this.renderEntryTs(entry)}</div>
      </div>
      ${this.expandedEntries[i] ? html`
        <div class="border-l border-gray-200 ml-2">
          ${repeat(entry.mergedEntries, (entry2, j) => `${i}-${j}`, entry2 => this.renderEntry(entry2))}
        </div>
      ` : html``}
    `
  }

  renderEntryDetails (entry, i) {
    switch (entry.event) {
      case 'peer-open': return entry.peer.remoteAddress
      case 'peer-remove': return entry.peer.remoteAddress
      case 'wait': return `Block ${entry.seq}`
      case 'upload':
      case 'download':
      case 'append':
        if (entry.mergedEntries?.length && !this.expandedEntries[i]) {
          return `${entry.mergedEntries?.length + 1} blocks, ${bytes(entry.accBytes)} total`
        } else {
          const seq = typeof entry.seq === 'number' ? entry.seq : entry.length
          return `Block ${seq}, size ${bytes(entry.byteLength)}`
        }
      default: return ''
    }
  }

  renderEntryTs (entry) {
    return (new Date(entry.ts)).toLocaleTimeString()
  }

  // events
  // =

  onClickEntry (e, entry, i) {
    if (e.target.tagName === 'A') return
    if (entry.mergedEntries?.length){
      this.expandedEntries[i] = !this.expandedEntries[i]
      this.requestUpdate()
    }
  }
}
customElements.define('app-hyperspace-log', HyperspaceLog)

function reduceRelatedEntries (acc, entry) {
  let last = acc.length ? acc[acc.length - 1] : undefined
  if (!last || entry.event !== last.event) {
    acc.push(entry)
    return acc
  }
  if (entry.event === 'peer-open' || entry.event === 'peer-remove') {
    if (entry.peer.remoteAddress !== last.peer.remoteAddress) {
      acc.push(entry)
      return acc
    }
  }
  last.mergedEntries = last.mergedEntries || []
  last.mergedEntries.push(entry)
  if (last.event === 'upload' || last.event === 'download' || last.event === 'append') {
    last.accBytes = last.accBytes || last.byteLength
    last.accBytes += entry.byteLength
  }
  return acc
}