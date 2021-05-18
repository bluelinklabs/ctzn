import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { repeat } from '../../vendor/lit-element/lit-html/directives/repeat.js'
import * as session from '../lib/session.js'

class BeeExplorer extends LitElement {
  static get properties () {
    return {
      dkey: {type: String},
      path: {type: Array},
      entries: {type: Array}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.dkey = undefined
    this.path = []
    this.entries = undefined
  }

  updated (changedProperties) {
    if (changedProperties.has('dkey') || changedProperties.has('path')) {
      this.load()
    }
  }

  async load () {
    try {
      await session.setup()
      console.log(this.dkey)
      this.entries = await session.api.server.beeShallowList(this.dkey, this.path)
      console.log(this.entries)
    } catch (e) {
      console.error(e)
    }
  }

  render () {
    if (!this.entries) {
      return html`<div>Loading...</div>`
    }
    return html`
      <div class="bg-white p-1 sm:rounded">
        <div class="flex items-center px-3 py-1 mb-0.5 font-semibold">
          ${this.renderCurrentPath()}
        </div>
        <div class="bg-gray-100 px-2 py-2 rounded tabular-nums">
          ${repeat(this.entries, entry => entry.path.join('/'), entry => html`
            <div class="bg-white sm:rounded px-3 py-2 mb-1 overflow-x-auto">
              <div
                class="cursor-pointer whitespace-pre hover:underline"
                @click=${e => this.onClickEntry(entry)}
              >${entry.path[entry.path.length - 1]}</div>
              ${entry.isExpanded ? html`
                <hr class="my-2">
                <div class="text-sm font-mono overflow-x-auto"><strong>Key:</strong> ${entry.path.join('/')}</div>
                <div class="text-sm font-mono overflow-x-auto whitespace-pre"><strong>Value:</strong> ${JSON.stringify(entry.value, null, 2)}</div>
              ` : html`
                <div class="text-xs text-gray-600 whitespace-nowrap">${JSON.stringify(entry.value)}</div>
              `}
            </div>
          `)}
        </div>
      </div>
    `
  }

  renderCurrentPath () {
    let acc = []
    let htmlParts = [html`
    <a
      class="mr-1 hover:underline cursor-pointer"
      @click=${e => this.onClickParent([])}
    >(root)</a>
  `]
    for (let segment of this.path) {
      acc.push(segment)
      let thisPath = acc.slice()
      htmlParts.push(html`
        <span class="mr-1">/</span>
        <a
          class="mr-1 hover:underline cursor-pointer"
          @click=${e => this.onClickParent(thisPath)}
        >${segment}</a>
      `)
    }
    return htmlParts
  }

  // events
  // =

  onClickEntry (entry) {
    if (entry.isContainer) {
      this.path = entry.path
    } else {
      entry.isExpanded = !entry.isExpanded
      this.requestUpdate()
    }
  }

  onClickParent (path) {
    this.path = path
  }
}
customElements.define('app-bee-explorer', BeeExplorer)