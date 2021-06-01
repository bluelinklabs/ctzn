import { LitElement, html } from '../../../vendor/lit/lit.min.js'
import { repeat } from '../../../vendor/lit/directives/repeat.js'
import * as session from '../../lib/session.js'
import { emit } from '../../lib/dom.js'
import './post.js'

const CHECK_NEW_ITEMS_INTERVAL = 30e3
let _cache = {
  id: undefined,
  results: undefined
}

export class PostsFeed extends LitElement {
  static get properties () {
    return {
      _view: {type: String, attribute: 'view'},
      userId: {type: String, attribute: 'user-id'},
      audience: {type: String},
      limit: {type: Number},
      results: {type: Array},
      hasNewItems: {type: Boolean},
      isLoadingMore: {type: Boolean},
      hasReachedEnd: {type: Boolean}
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
    this.hasNewItems = false
    this.isLoadingMore = false
    this.hasReachedEnd = false

    // ui state
    this.loadMoreObserver = undefined
    setInterval(() => this.checkNewItems(), CHECK_NEW_ITEMS_INTERVAL)

    // query state
    this.activeQuery = undefined
    this.abortController = undefined
  }

  disconnectedCallback () {
    super.disconnectedCallback()
    if (this.loadMoreObserver) {
      this.loadMoreObserver.disconnect()
    }
  }

  get view () {
    if (this._view === 'posts') return 'ctzn.network/views/posts'
    if (this._view === 'feed') return 'ctzn.network/views/feed'
    return this._view || 'ctzn.network/views/posts'
  }

  set view (v) {
    this._view = v
  }

  get isLoading () {
    return !!this.activeQuery
  }

  get hasHitLimit () {
    return this.hasReachedEnd || (this.limit > 0 && this.results?.length >= this.limit)
  }

  get cacheId () {
    return `${this.userId}|${this.audience}|${this.limit}|${this.view}`
  }

  async load ({clearCurrent} = {clearCurrent: false}) {
    if (!this.view || (this.view === 'ctzn.network/views/posts' && !this.userId)) {
      return
    }
    if (this.activeQuery) {
      return this.activeQuery
    }
    if (!session.isActive()) {
      session.onChange(() => this.load({clearCurrent}), {once: true})
    }
    if (clearCurrent) {
      this.results = undefined
    } else if (_cache.id === this.cacheId) {
      // use cached results
      this.results = _cache.results
      /* dont await */ this.queueQuery() // queue up a load to make sure we're getting latest
      return
    }
    return this.queueQuery()
  }

  updated (changedProperties) {
    if (typeof this.results === 'undefined') {
      if (!this.activeQuery) {
        this.load()
      }
    } else if (changedProperties.has('_view') || changedProperties.has('userId')) {
      this.load()
    }

    const botOfFeedEl = this.querySelector('.bottom-of-feed')
    if (!this.loadMoreObserver && botOfFeedEl) {
      this.loadMoreObserver = new IntersectionObserver((entries) => {
        if (entries[0]?.isIntersecting) {
          this.queueQuery({more: true})
        }
      }, {threshold: 1.0})
      this.loadMoreObserver.observe(botOfFeedEl)
    }
  }

  queueQuery ({more} = {more: false}) {
    if (!this.activeQuery) {
      this.activeQuery = this.query({more})
      this.requestUpdate()
    } else {
      if (more) return this.activeQuery
      if (this.abortController) this.abortController.abort()
      this.activeQuery = this.activeQuery.catch(e => undefined).then(r => {
        this.activeQuery = undefined
        this.queueQuery({more})
      })
    }
    return this.activeQuery
  }

  async query ({more} = {more: false}) {
    if (this.hasHitLimit) {
      return
    }

    emit(this, 'load-state-updated')
    this.abortController = new AbortController()
    this.isLoadingMore = more

    let results = more ? (this.results || []) : []
    let lt = more ? results[results?.length - 1]?.key : undefined
    const orgLen = results.length
    if (this.view === 'ctzn.network/views/feed') {
      results = results.concat((await session.api.view.get(this.view, {audience: this.audience, limit: 15, reverse: true, lt}))?.feed)
    } else {
      results = results.concat((await session.api.view.get(this.view, {dbId: this.userId, audience: this.audience, limit: 15, reverse: true, lt}))?.posts)
    }
    this.hasReachedEnd = orgLen === results.length || results.length < 15
    if (this.limit > 0 && results.length > this.limit) {
      results = results.slice(0, this.limit)
    }
    console.log(results)

    if (!more && this.results?.length && _cache?.id === this.cacheId && _cache?.results?.[0]?.dbUrl === results[0]?.dbUrl) {
      // stick with the cache but update the signal metrics
      for (let i = 0; i < results.length && i < this.results.length; i++) {
        this.results[i].reactions = _cache.results[i].reactions = results[i].reactions
        this.results[i].replyCount = _cache.results[i].replyCount = results[i].replyCount
      }
      this.requestResultUpdates()
    } else {
      this.results = results
      _cache = {id: this.cacheId, results}
    }

    this.activeQuery = undefined
    this.hasNewItems = false
    this.isLoadingMore = false
    emit(this, 'load-state-updated', {detail: {isEmpty: this.results.length === 0}})
    if (!more) {
      emit(this, 'fetched-latest')
    }
  }

  async checkNewItems () {
    if (!this.results || this.hasHitLimit) {
      return
    }
    let results
    if (this.view === 'ctzn.network/views/feed') {
      results = (await session.api.view.get(this.view, {audience: this.audience, limit: 1, reverse: true}))?.feed
    } else {
      results = (await session.api.view.get(this.view, {dbId: this.userId, audience: this.audience, limit: 1, reverse: true}))?.posts
    }
    emit(this, 'fetched-latest')
    this.hasNewItems = (results[0] && results[0].key !== this.results[0].key)
  }

  async pageLoadScrollTo (y) {
    await this.requestUpdate()
    window.scrollTo(0, y)
    await new Promise(r => setTimeout(r, 100))
    window.scrollTo(0, y)
    
    let first = true
    while (true) {
      if (Math.abs(window.scrollY - y) < 10) {
        break
      }

      let numResults = this.results?.length || 0
      if (first) {
        await this.load()
        first = false
      } else {
        await this.queueQuery({more: true})
      }
      await this.requestUpdate()
      await new Promise(r => setTimeout(r, 100))
      window.scrollTo(0, y)
      if (numResults === (this.results?.length || 0)) {
        break
      }
    }
  }

  requestResultUpdates () {
    let postEls = this.querySelectorAll('app-post')
    for (let el of Array.from(postEls)) {
      el.requestUpdate()
    }
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
    if (!this.results.length) {
      return html`
        ${this.renderHasNewItems()}
        <div class="empty py-44 text-center">
          <div class="fas fa-stream text-6xl mb-8"></div>
          ${this.view === 'ctzn.network/views/posts' || this.audience ? html`
            <div>This feed is empty.</div>
          ` : html`
            <div>Follow people to see what's new.</div>
          `}
        </div>
      `
    }
    return html`
      ${this.renderHasNewItems()}
      ${this.renderResults()}
      ${this.results?.length && !this.hasHitLimit ? html`
        <div class="bottom-of-feed ${this.isLoadingMore ? 'bg-white' : ''}">
          ${this.renderPlaceholderPost(-1)}
        </div>
      ` : ''}
    `
  }

  renderHasNewItems () {
    if (!this.hasNewItems) {
      return ''
    }
    return html`
      <div
        class="new-items-indicator bg-blue-50 border border-blue-500 cursor-pointer fixed font-semibold hov:hover:bg-blue-100 inline-block px-4 py-2 rounded-3xl shadow-md text-blue-800 text-sm z-30"
        @click=${this.onClickViewNewPosts}
      >
        New Posts <span class="fas fa-fw fa-angle-up"></span>
      </div>
    `
  }

  renderResults () {
    return html`
      ${repeat(this.results, result => result.dbUrl, (result, i) => this.renderResult(result, i))}
    `
  }
  
  renderResult (post, index) {
    return html`
      <app-post
        .post=${post}
        mode="default"
        class="${index === 0 ? 'is-first' : ''} block pt-1 lg:pt-1 pb-1 lg:pb-1"
      ></app-post>
    `
  }

  renderPlaceholderPost (index) {
    return html`
      <div class="placeholder ${index === 0 ? 'is-first' : ''} block pt-1 lg:pt-4 pb-1 lg:pb-4">
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

  // events
  // =

  onClickViewNewPosts (e) {
    this.hasNewItems = false
    this.load()
    window.scrollTo(0, 0)
  }
}

customElements.define('app-posts-feed', PostsFeed)