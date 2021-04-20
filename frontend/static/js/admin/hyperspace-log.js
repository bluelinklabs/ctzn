import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { repeat } from '../../vendor/lit-element/lit-html/directives/repeat.js'
import * as session from '../lib/session.js'
import bytes from '../../vendor/bytes/index.js'

const FETCH_INTERVAL = 2e3

class HyperspaceLog extends LitElement {
  static get properties () {
    return {
      dkey: {type: String},
      entries: {type: Array}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.dkey = undefined
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
      this.entries = await session.api.server.queryHyperspaceLog({dkey: this.dkey})
    } catch (e) {
      console.error(e)
    }
  }

  render () {
    if (!this.entries) {
      return html`<div>Loading...</div>`
    }
    return html`
      <div class="bg-white p-1 font-mono text-sm sm:rounded">
        ${repeat(this.entries, (entry, i) => i, entry => html`
          <div class="row flex items-center border-b border-gray-200 py-0.5 hover:bg-gray-50">
            <div>
              <a href="/admin/hyperspace/db/${entry.dkey}" class="cursor-pointer hover:underline">
                ${entry.dkey.slice(0, 6)}..${entry.dkey.slice(-2)}
              </a>
            </div>
            <div>${entry.event}</div>
            <div>${this.renderEntryDetails(entry)}</div>
            <div>${this.renderEntryTs(entry)}</div>
          </div>
        `)}
      </div>
    `
  }

  renderEntryDetails (entry) {
    switch (entry.event) {
      case 'peer-open': return entry.peer.remoteAddress
      case 'peer-remove': return entry.peer.remoteAddress
      case 'upload': return `Block ${entry.seq}, size ${bytes(entry.byteLength)}`
      case 'download': return `Block ${entry.seq}, size ${bytes(entry.byteLength)}`
      case 'wait': return `Block ${entry.seq}`
      case 'append': return `Block ${entry.length}, size ${bytes(entry.byteLength)}`
      default: return ''
    }
  }

  renderEntryTs (entry) {
    return (new Date(entry.ts)).toLocaleTimeString()
  }

  // events
  // =
}
customElements.define('app-hyperspace-log', HyperspaceLog)