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

  renderEntry (entry, i, noExpand = false) {
    const isSummary = entry.mergedEntries?.length && !noExpand
    const isExpanded = this.expandedEntries[i]
    return html`
      <div
        class="row flex items-center ${i !== 0 ? 'border-t' : ''} border-gray-200 pl-2 py-0.5 hover:bg-gray-50"
        @click=${e => this.onClickEntry(e, entry, i)}
      >
        <div>
          ${isSummary ? html`
            <span class="fas fa-caret-${isExpanded ? 'down' : 'right'}"></span>
            x${entry.mergedEntries.length + 1}
          ` : ''}
        </div>
        <div>
          ${entry.event}
        </div>
        <div>
          ${this.renderEntryDetails(entry, isSummary)}
        </div>
        <div>
          ${isSummary ? '' : html`
            <a href="/admin/hyperspace/db/${entry.dkey}" class="text-blue-600 cursor-pointer hover:underline">
              ${entry.dkey.slice(0, 6)}..${entry.dkey.slice(-2)}
            </a>
          `}
        </div>
        <div>${this.renderEntryTs(entry)}</div>
      </div>
      ${isExpanded ? html`
        <div class="border-l border-gray-200 ml-2">
          ${this.renderEntry(entry, undefined, true)}
          ${repeat(entry.mergedEntries, (entry2, j) => `${i}-${j}`, entry2 => this.renderEntry(entry2, undefined, true))}
        </div>
      ` : html``}
    `
  }

  renderEntryDetails (entry, isSummary) {
    switch (entry.event) {
      case 'peer-open': return entry.peer.remoteAddress
      case 'peer-remove': return entry.peer.remoteAddress
      case 'wait': return `block #${entry.seq}`
      case 'upload':
      case 'download':
      case 'append':
        if (isSummary) {
          return `${bytes(entry.accBytes)}, ${entry.mergedEntries?.length + 1} blocks`
        } else {
          const seq = typeof entry.seq === 'number' ? entry.seq : entry.length
          return `${bytes(entry.byteLength)}, block #${seq}`
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