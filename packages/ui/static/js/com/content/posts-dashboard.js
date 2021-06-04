import { LitElement, html } from '../../../vendor/lit/lit.min.js'
import { repeat } from '../../../vendor/lit/directives/repeat.js'
import * as session from '../../lib/session.js'
import { emit } from '../../lib/dom.js'
import './post.js'

const CHECK_NEW_ITEMS_INTERVAL = 30e3

export class PostsDashboard extends LitElement {
  static get properties () {
    return {
      _view: {type: String, attribute: 'view'},
      userId: {type: String, attribute: 'user-id'},
      audience: {type: String},
      limit: {type: Number},
      results: {type: Array}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this._view = undefined
    this.userId = undefined
    this.audience = undefined
    this.limit = undefined
    this.results = undefined

    // ui state
    setInterval(() => this.load(), CHECK_NEW_ITEMS_INTERVAL)

    // query state
    this.activeQuery = undefined
    this.abortController = undefined
  }

  get view () {
    if (this._view === 'global') return 'ctzn.network/views/global-posts-feed'
    if (this._view === 'posts') return 'ctzn.network/views/posts'
    if (this._view === 'feed') return 'ctzn.network/views/feed'
    return this._view || 'ctzn.network/views/feed'
  }

  set view (v) {
    this._view = v
  }

  get isLoading () {
    return !!this.activeQuery
  }

  async load () {
    if (!this.view || (this.view === 'ctzn.network/views/posts' && !this.userId)) {
      return
    }
    if (this.activeQuery) {
      return this.activeQuery
    }
    return this.queueQuery()
  }

  updated (changedProperties) {
    if (typeof this.results === 'undefined') {
      this.load()
    } else if (changedProperties.has('_view') || changedProperties.has('userId')) {
      this.load()
    }
  }

  queueQuery () {
    if (!this.activeQuery) {
      this.activeQuery = this.query()
      this.requestUpdate()
    } else {
      this.activeQuery = this.activeQuery.catch(e => undefined).then(r => {
        this.activeQuery = undefined
        this.queueQuery()
      })
    }
    return this.activeQuery
  }

  async query () {
    emit(this, 'load-state-updated')

    let results
    if (this.view === 'ctzn.network/views/feed' || this.view === 'ctzn.network/views/global-posts-feed') {
      results = (await session.api.view.get(this.view, {audience: this.audience, limit: 15, reverse: true}))?.feed
    } else {
      results = (await session.api.view.get(this.view, {dbId: this.userId, audience: this.audience, limit: 15, reverse: true}))?.posts
    }
    this.results = results

    this.activeQuery = undefined
    emit(this, 'load-state-updated', {detail: {isEmpty: this.results.length === 0}})
  }

  // rendering
  // =

  render () {
    if (!this.results) {
      if (!this.isLoading) {
        return ''
      }
      return html`
        ${this.renderPlaceholderPost(0)}
        ${this.renderPlaceholderPost(1)}
        ${this.renderPlaceholderPost(2)}
        ${this.renderPlaceholderPost(3)}
        ${this.renderPlaceholderPost(4)}
      `
    }
    return html`
      ${repeat(this.results, result => result.dbUrl, (result, i) => this.renderResult(result, i))}
    `
  }
  
  renderResult (post, index) {
    return html`
      <app-post
        .post=${post}
        mode="default"
        class="block pt-1 lg:pt-1 pb-1 lg:pb-1"
      ></app-post>
    `
  }

  renderPlaceholderPost (index) {
    return html`
      <div class="placeholder block pt-1 lg:pt-4 pb-1 lg:pb-4">
        <div class="grid grid-post px-1 py-0.5">
          <div class="pl-2 pt-2">
            <div class="avatar block mt-1 w-11 h-11"></div>
          </div>
          <div class="block min-w-0">
            <div class="pr-2 py-2 min-w-0">
              <div class="pl-1 pr-2.5 truncate">
                <div class="bg-loading-gradient rounded h-20"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `
  }
}

customElements.define('app-posts-dashboard', PostsDashboard)