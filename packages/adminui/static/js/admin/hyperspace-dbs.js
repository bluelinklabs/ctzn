import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { repeat } from '../../vendor/lit-element/lit-html/directives/repeat.js'
import bytes from '../../vendor/bytes/index.js'
import * as session from '../lib/session.js'

const FETCH_INTERVAL = 2e3
const DB_TYPE_ORDERING = [
  'ctzn.network/private-server-db',
  'ctzn.network/public-server-db',
  'ctzn.network/public-community-db',
  'ctzn.network/public-citizen-db',
  'ctzn.network/private-community-db',
  'ctzn.network/private-citizen-db'
]

class HyperspaceDbs extends LitElement {
  static get properties () {
    return {
      databases: {type: Array}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.databases = undefined
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
    this.databases = await session.api.server.listDatabases()
    this.databases.sort((a, b) => {
      if (a.dbType === b.dbType) return (a.userId || '').localeCompare(b.userId)
      let aI = DB_TYPE_ORDERING.indexOf(a.dbType)
      if (aI === -1) aI = DB_TYPE_ORDERING.length
      let bI = DB_TYPE_ORDERING.indexOf(b.dbType)
      if (bI === -1) bI = DB_TYPE_ORDERING.length
      return aI - bI
    })
    console.log(this.databases)
  }

  render () {
    if (!this.databases) {
      return html`<div>Loading...</div>`
    }
    let lastDbType = undefined
    return html`
      <div class="pb-8">
        <div class="sticky top-0 z-10 row flex items-center border-b-2 border-pink-600 bg-white px-3 py-2 mb-0.5 font-semibold">
          <div class="truncate">Type</div>
          <div class="truncate">User ID</div>
          <div class="truncate">Peers</div>
          <div class="truncate">Writable?</div>
          <div class="truncate">Disk usage</div>
        </div>
        ${repeat(this.databases, db => db.key, db => {
          const res = html`
            ${db.dbType !== lastDbType ? html`
              <div class="pt-3 pb-1 px-1 text-base font-medium border-b border-gray-300">${this.renderDbType(db.dbType)}s</div>
            ` : ''}
            <a
              class="row flex items-center px-3 py-2 cursor-pointer zebra-row zebra-row-hovers"
              href="/admin/hyperspace/db/${db.dkey}"
            >
              <div class="truncate">${this.renderDbType(db.dbType)}</div>
              <div class="truncate">${db.userId}</div>
              <div class="truncate">${db.peerCount}</div>
              <div class="truncate"><span class="fas fa-${db.writable ? 'check' : 'times'}"></span></div>
              <div class="truncate">${bytes(db.diskusage + (db.blobs?.diskusage || 0))}</div>
            </a>
          `
          lastDbType = db.dbType
          return res
        })}
      </div>
    `
  }

  renderDbType (dbType) {
    if (dbType?.startsWith('ctzn.network/')) {
      let name = dbType.split('/')[1]
      return name.replace(/(^|\-)(\w)/g, (match, $0, $1) => ' ' + $1.toUpperCase()).trim()
    }
    return dbType
  }
}
customElements.define('app-hyperspace-dbs', HyperspaceDbs)