import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import bytes from '../../vendor/bytes/index.js'
import * as session from '../lib/session.js'
import './bee-explorer.js'
import './hyperspace-log.js'

const FETCH_INTERVAL = 2e3

class HyperspaceViewDb extends LitElement {
  static get properties () {
    return {
      db: {type: Object},
      expandedSections: {type: Object}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.db = undefined
    this.dbKey = window.location.pathname.split('/').pop()
    this.expandedSections = {}
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
      <div class="border-t-2 border-pink-600 py-2 px-3 mb-1">
        <h2 class="pt-4 pb-2">
          ${db.userId ? html`
            <span class="text-3xl font-medium">${db.userId}</span>
            ${this.renderDbLabel(db)}
          ` : html`
            <span class="text-3xl font-medium">${this.renderDbLabel(db)}</span>
          `}
        </h2>
        <div class="pb-2 px-3 text-gray-600">
          <span class="py-1 mr-4">
            <span class="text-gray-500 fas fa-fw fa-eye${db.isPrivate ? '-slash' : ''} text-xs"></span>
            ${db.isPrivate ? 'Private' : 'Public'}
          </span>
          <span class="py-1 mr-4">
            ${db.writable ? html`
              <span class="text-gray-500 fas fa-fw fa-pen text-xs"></span>
            ` : html`
              <span class="text-gray-500 fa-stack text-xs">
                <i class="fas fa-pen fa-stack-1x"></i>
                <i class="fas fa-times fa-stack-1x text-red-700" style="left: 6px; top: 4px"></i>
              </span>
            `}
            ${db.writable ? 'Writable' : 'Read-only'}
          </span>
          <span class="py-1 mr-3">
            <span class="text-gray-500 fas fa-fw fa-hdd text-xs"></span>
            ${bytes(db.diskusage)}
          </span>
          <a
            class="
              py-1 mr-3 px-1 rounded cursor-pointer hover:bg-gray-100
              ${this.expandedSections.main === 'dbUrl' ? 'arrow-decor' : ''}
            "
            @click=${e => this.onToggleMainSection('dbUrl')}
          >
            <span class="text-gray-500 fas fa-fw fa-link text-xs"></span>
            DB Url
          </a>
          <a
            class="
              py-1 mr-3 px-1 rounded cursor-pointer hover:bg-gray-100
              ${this.expandedSections.main === 'dkey' ? 'arrow-decor' : ''}
            "
            @click=${e => this.onToggleMainSection('dkey')}
          >
            <span class="text-gray-500 fas fa-fw fa-key text-xs"></span>
            Discovery key
          </a>
          <a
            class="
              py-1 mr-3 px-1 rounded cursor-pointer hover:bg-gray-100
              ${this.expandedSections.main === 'peers' ? 'arrow-decor' : ''}
            "
            @click=${e => this.onToggleMainSection('peers')}
          >
            <span class="text-gray-500 fas fa-fw fa-share-alt text-xs"></span>
            ${db.peerCount} Peer${db.peerCount !== 1 ? 's' : ''}
          </a>
        </div>
        ${this.expandedSections.main === 'dbUrl' ? html`
          <div class="border border-gray-200 rounded p-2">
            <div class="font-mono bg-gray-100 rounded px-2 py-2 mt-1 text-sm cursor-text">hyper://${db.key}/</div>
          </div>
        ` : ''}
        ${this.expandedSections.main === 'dkey' ? html`
          <div class="border border-gray-200 rounded p-2">
            <div class="font-mono bg-gray-100 rounded px-2 py-2 mt-1 text-sm cursor-text">${db.dkey}</div>
          </div>
        ` : ''}
        ${this.expandedSections.main === 'peers' ? html`
          <div class="border border-gray-200 rounded p-2">
            <div class="font-mono bg-gray-100 rounded px-2 py-2 mt-1 text-sm cursor-text">${db.peers.map(p => p.remoteAddress).join(', ')}</div>
          </div>
        ` : ''}
        ${db.blobs ? html`
          <h3 class="font-semibold text-sm pb-2 mt-6">
            Blobs
          </h3>
          <div class="bg-gray-50 rounded pt-3 pb-1 px-4">
            <div class="text-gray-600 pb-2 text-sm">
              <span class="py-1 mr-4">
                <span class="text-gray-500 fas fa-fw fa-eye${db.blobs.isPrivate ? '-slash' : ''} text-xs"></span>
                ${db.blobs.isPrivate ? 'Private' : 'Public'}
              </span>
              <span class="py-1 mr-4">
                ${db.blobs.writable ? html`
                  <span class="text-gray-500 fas fa-fw fa-pen text-xs"></span>
                ` : html`
                  <span class="text-gray-500 fa-stack text-xs">
                    <i class="fas fa-pen fa-stack-1x"></i>
                    <i class="fas fa-times fa-stack-1x text-red-700" style="left: 6px; top: 4px"></i>
                  </span>
                `}
                ${db.blobs.writable ? 'Writable' : 'Read-only'}
              </span>
              <span class="py-1 mr-4">
                <span class="text-gray-500 fas fa-fw fa-hdd text-xs"></span>
                ${bytes(db.blobs.diskusage)}
              </span>
              <a
                class="
                  py-1 mr-3 px-1 rounded cursor-pointer hover:bg-gray-100
                  ${this.expandedSections.blobs === 'dbUrl' ? 'arrow-decor' : ''}
                "
                @click=${e => this.onToggleBlobsSection('dbUrl')}
              >
                <span class="text-gray-500 fas fa-fw fa-link text-xs"></span>
                DB Url
              </a>
              <a
                class="
                  py-1 mr-3 px-1 rounded cursor-pointer hover:bg-gray-100
                  ${this.expandedSections.blobs === 'dkey' ? 'arrow-decor' : ''}
                "
                @click=${e => this.onToggleBlobsSection('dkey')}
              >
                <span class="text-gray-500 fas fa-fw fa-key text-xs"></span>
                Discovery key
              </a>
              <a
                class="
                  py-1 mr-3 px-1 rounded cursor-pointer hover:bg-gray-100
                  ${this.expandedSections.blobs === 'peers' ? 'arrow-decor' : ''}
                "
                @click=${e => this.onToggleBlobsSection('peers')}
              >
                <span class="text-gray-500 fas fa-fw fa-share-alt text-xs"></span>
                ${db.blobs.peerCount} Peer${db.blobs.peerCount !== 1 ? 's' : ''}
              </a>
            </div>
            ${this.expandedSections.blobs === 'dbUrl' ? html`
              <div class="border border-gray-200 rounded p-2 bg-white">
                <div class="font-mono bg-gray-100 rounded px-2 py-2 mt-1 text-sm cursor-text">hyper://${db.blobs.key}/</div>
              </div>
            ` : ''}
            ${this.expandedSections.blobs === 'dkey' ? html`
              <div class="border border-gray-200 rounded p-2 bg-white">
                <div class="font-mono bg-gray-100 rounded px-2 py-2 mt-1 text-sm cursor-text">${db.blobs.dkey}</div>
              </div>
            ` : ''}
            ${this.expandedSections.blobs === 'peers' ? html`
              <div class="border border-gray-200 rounded p-2 bg-white">
                <div class="font-mono bg-gray-100 rounded px-2 py-2 mt-1 text-sm cursor-text">${db.blobs.peers.map(p => p.remoteAddress).join(', ')}</div>
              </div>
            ` : ''}
          </div>
        ` : ''}
        ${db.indexers?.length ? html`
          <details class="mt-3 rounded border border-gray-200 px-4 py-2 text-gray-700 cursor-pointer hover:bg-gray-50">
            <summary>Active indexers (${db.indexers?.length || 0})</summary>
            <div class="font-mono bg-gray-100 rounded px-2 py-2 mt-1 cursor-text">${db.indexers?.join(' ')}</div>
          </details>
        ` : ''}
        <h3 class="font-semibold text-sm pb-2 mt-3">Data explorer</h3>
        <div class="border border-gray-200 rounded px-2 pb-2">
          <app-bee-explorer dkey=${this.dbKey}></app-bee-explorer>
        </div>
        <h3 class="font-semibold text-sm pb-2 mt-3">Log</h3>
        <div class="border border-gray-200 rounded px-2 py-2">
          <app-hyperspace-log dkey=${this.dbKey}></app-hyperspace-log>
        </div>
      </div>
    `
  }

  renderDbLabel (db) {
    if (db.dbType?.startsWith('ctzn.network/')) {
      let name = db.dbType.split('/')[1]
      return name.replace(/(^|\-)(\w)/g, (match, $0, $1) => ' ' + $1.toUpperCase()).trim()
    }
    return db.dbType
  }

  // events
  // =

  onToggleMainSection (section) {
    if (this.expandedSections.main === section) {
      this.expandedSections.main = undefined
    } else {
      this.expandedSections.main = section
    }
    this.requestUpdate()
  }

  onToggleBlobsSection (section) {
    if (this.expandedSections.blobs === section) {
      this.expandedSections.blobs = undefined
    } else {
      this.expandedSections.blobs = section
    }
    this.requestUpdate()
  }
}
customElements.define('app-hyperspace-view-db', HyperspaceViewDb)