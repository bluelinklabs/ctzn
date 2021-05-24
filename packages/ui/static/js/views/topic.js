import { LitElement, html } from '../../vendor/lit/lit.min.js'
import { repeat } from '../../vendor/lit/directives/repeat.js'
import * as session from '../lib/session.js'
import '../com/header.js'
import '../com/button.js'
import '../com/subnav.js'

class CtznTopicView extends LitElement {
  static get properties () {
    return {
      currentPath: {type: String, attribute: 'current-path'},
      topic: {type: String},
      records: {type: Object},
      loadError: {type: Object}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.authorProfile = undefined
    this.topic = undefined
    this.records = undefined
    this.loadError = undefined
  }


  async load () {
    let pathname = window.location.pathname
    let [_, topic] = pathname.split('/').filter(Boolean)
    this.topic = topic
    document.title = `${this.topic} | CTZN`

    try {
      this.records = undefined
      const view = await session.api.view.get('ctzn.network/topic-records-view', this.topic)
      console.log(view)
      this.records = view.records
    } catch (e) {
      this.loadError = e
    }
  }

  async refresh () {
    await this.load()
  }

  updated (changedProperties) {
    if (changedProperties.get('currentPath')) {
      this.load()
    }
  }

  // rendering
  // =

  render () {
    return html`
      <app-header></app-header>
      <div>
        ${this.renderCurrentView()}
      </div>
    `
  }

  renderHeader () {
    if (!this.topic) {
      return ''
    }
    const SUBNAV_ITEMS = [
      {back: true, label: html`<span class="fas fa-angle-left"></span>`},
      {path: location.pathname, label: `Topic: ${this.topic}`}
    ]
    return html`
      <app-subnav
        mobile-only
        nav-cls=""
        .items=${SUBNAV_ITEMS}
        current-path=${location.pathname}
      ></app-subnav>
    `
  }

  renderCurrentView () {
    if (this.loadError) {
      return this.renderError()
    }
    if (!this.records) {
      return this.renderLoading()
    }
    return this.renderRecords()
  }

  renderError () {
    return html`
      <div class="text-gray-500 py-44 text-center my-5">
        <div class="fas fa-exclamation-triangle text-6xl text-gray-300 mb-8"></div>
        <div>There was an error while trying to load this topic.</div>
        <pre class="py-2">${this.loadError.toString()}</pre>
      </div>
    `
  }

  renderLoading () {
    return html`
      ${this.renderHeader()}
      <main>
        <div class="py-32 text-center text-gray-600">
          <span class="spinner h-7 w-7"></span>
        </div>
      </main>
    `
  }

  renderRecords () {
    return html`
      ${this.renderHeader()}
      <div class="bg-gray-50 mb-3">
        <main class="wide px-3 sm:px-0">
          <h1 class="font-bold pb-3 pt-2 text-4xl text-gray-700 tracking-tight">${this.topic.replace(/_/g, ' ')}</h1>
        </main>
      </div>
      <main class="wide col2 px-3 sm:px-0">
        <div>
          ${this.renderPosts()}
          ${this.renderPages()}
        </div>
        <div>
          ${this.renderProfiles()}
        </div>
      </main>
    `
  }

  renderPosts () {
    return html`
      <div class="mb-4">
        <h2 class="border-b border-gray-200 font-semibold mb-2 px-1 text-gray-600 text-sm">Posts</h2>
        ${repeat(this.records['ctzn.network/post'] || [], record => record.url, record => html`
          <ctzn-post-view
            class="block border border-gray-200 mb-2 rounded"
            .post=${record}
          ></ctzn-post-view>
        `)}
        <div>
          <app-button transparent label="New post about ${this.topic}"></app-button>
        </div>
      </div>
    `
  }

  renderPages () {
    return html`
      <div class="mb-4">
        <h2 class="border-b border-gray-200 font-semibold mb-2 px-1 text-gray-600 text-sm">Pages</h2>
        ${repeat(this.records['ctzn.network/page'] || [], record => record.url, record => html`
          TODO
        `)}
        <div>
          <app-button transparent label="New page about ${this.topic}"></app-button>
        </div>
      </div>
    `
  }

  renderProfiles () {
    return html`
      <div class="mb-4">
        <h2 class="border-b border-gray-200 font-semibold mb-2 px-1 text-gray-600 text-sm">Who is this?</h2>
        ${repeat(this.records['ctzn.network/profile'] || [], record => record.url, record => html`
          <app-user-list
            id=${record.author.userId}
            cols="1"
            .ids=${[record.author.userId]}
          ></app-user-list>
        `)}
      </div>
      <div class="mb-4">
        <h2 class="border-b border-gray-200 font-semibold mb-2 px-1 text-gray-600 text-sm">Related people</h2>
      </div>
      <div class="mb-4">
        <h2 class="border-b border-gray-200 font-semibold mb-2 px-1 text-gray-600 text-sm">Good sources on this topic</h2>
      </div>
    `
  }

  // events
  // =
}

customElements.define('app-topic-view', CtznTopicView)
