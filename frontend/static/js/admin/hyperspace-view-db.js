import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import bytes from '../../vendor/bytes/index.js'
import * as session from '../lib/session.js'
import './bee-explorer.js'
import './hyperspace-log.js'

const FETCH_INTERVAL = 2e3

class HyperspaceViewDb extends LitElement {
  static get properties () {
    return {
      db: {type: Object}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.db = undefined
    this.dbKey = window.location.pathname.split('/').pop()
    this.fetchInterval = undefined
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
    const isFirst = !this.db
    this.db = await session.api.server.getDatabaseInfo(this.dbKey)
    if (isFirst) console.log(this.db)
  }

  render () {
    if (!this.db) {
      return html`<div>Loading...</div>`
    }
    const db = this.db
    return html`
      <div class="sticky top-0 z-10 flex items-center bg-pink-600 text-white sm:rounded px-3 py-2 mb-0.5 font-semibold">
        <a
          class="cursor-pointer mr-1"
          href="/admin/hyperspace"
        >
          <span class="fas fa-fw fa-arrow-left"></span>
        </a>
      </div>
      <div class="bg-white sm:rounded px-3 py-2 mb-1">
        <h2>
          ${db.userId ? html`
            <span class="text-2xl font-medium">${db.userId}</span>
            ${this.renderDbLabel(db)}
          ` : html`
            <span class="text-2xl font-medium">${this.renderDbLabel(db)}</span>
          `}
        </h2>
        <div>
          ${db.isPrivate ? 'Private database' : 'Public database'}
          -
          ${db.writable ? 'Writable' : 'Read-only'}
          -
          Disk usage: ${bytes(db.diskusage)}
        </div>
        <details>
          <summary>Key (click to reveal)</summary>
          <span class="font-mono">${db.key}</span>
        </details>
        <details>
          <summary>Discovery Key (click to reveal)</summary>
          <span class="font-mono">${db.dkey}</span>
        </details>
        <div>
          <strong class="font-semibold">Peers (${db.peerCount})${db.peerCount > 0 ? ':' : ''}</strong>
          <span class="font-mono">${db.peers.map(p => p.remoteAddress).join(', ')}</span>
        </div>
      </div>
      ${db.blobs ? html`
        <div class="bg-white sm:rounded px-3 py-2 mb-1">
          <div class="text-lg font-semibold">Blobs</div>
          <div>
            ${db.blobs.isPrivate ? 'Private database' : 'Public database'}
            -
            ${db.blobs.writable ? 'Writable' : 'Read-only'}
            -
            Disk usage: ${bytes(db.blobs.diskusage)}
          </div>
          <details>
            <summary>Key (click to reveal)</summary>
            <span class="font-mono">${db.blobs.key}</span>
          </details>
          <details>
            <summary>Discovery Key (click to reveal)</summary>
            <span class="font-mono">${db.blobs.dkey}</span>
          </details>
          <div>
            <strong class="font-semibold">Peers (${db.blobs.peerCount})${db.peerCount > 0 ? ':' : ''}</strong>
            <span class="font-mono">${db.blobs.peers.map(p => p.remoteAddress).join(', ')}</span>
          </div>
        </div>
      ` : ''}
      ${db.indexers?.length ? html`
        <div class="bg-white sm:rounded px-3 py-2 mb-1">
          <div class="font-semibold">Active indexers</div>
          <div class="font-mono">
            ${db.indexers.join(' ')}
          </div>
        </div>
      ` : ''}
      <h3 class="font-semibold text-sm py-2">Data explorer</h3>
      <app-bee-explorer dkey=${this.dbKey}></app-bee-explorer>
      <h3 class="font-semibold text-sm py-2">Log</h3>
      <app-hyperspace-log dkey=${this.dbKey}></app-hyperspace-log>
    `
  }

  renderDbLabel (db) {
    if (db.dbType?.startsWith('ctzn.network/')) {
      let name = db.dbType.split('/')[1]
      return name.replace(/(^|\-)(\w)/g, (match, $0, $1) => ' ' + $1.toUpperCase()).trim()
    }
    return db.dbType
  }
}
customElements.define('app-hyperspace-view-db', HyperspaceViewDb)