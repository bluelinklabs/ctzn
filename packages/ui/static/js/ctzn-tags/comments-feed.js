import { LitElement, html } from '../../vendor/lit/lit.min.js'
import { repeat } from '../../vendor/lit/directives/repeat.js'
import * as session from '../lib/session.js'
import { emit } from '../lib/dom.js'
import './comment-view.js'

const CHECK_NEW_ITEMS_INTERVAL = 30e3
let _cache = {
  id: undefined,
  results: undefined
}

export class CommentsFeed extends LitElement {
  static get properties () {
    return {
      userId: {type: String, attribute: 'user-id'},
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
    this.setAttribute('ctzn-elem', '1')
    this.userId = undefined
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

  get isLoading () {
    return !!this.activeQuery
  }

  get hasHitLimit () {
    return this.hasReachedEnd || (this.limit > 0 && this.results?.length >= this.limit)
  }

  setContextState (state) {
    if (state?.page?.userId) {
      if (!this.userId) {
        this.userId = state.page?.userId
      }
    }
  }

  get cacheId () {
    return `${this.userId}|${this.limit}`
  }

  async load ({clearCurrent} = {clearCurrent: false}) {
    if (!this.userId) {
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
    } else if (changedProperties.has('userId')) {
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

    const entries = await session.ctzn.db(this.userId).table("ctzn.network/comment").list({limit: 15, reverse: true, lt})
    results = results.concat(await Promise.all(entries.map(entry => (
      session.ctzn.getComment(this.userId, entry.key)
    ))))
    this.hasReachedEnd = entries.length === 0
    this.requestUpdate()
    if (this.limit > 0 && results.length > this.limit) {
      results = results.slice(0, this.limit)
    }
    console.log(results)

    if (!more && _cache?.id === this.cacheId && _cache?.results?.[0]?.url === results[0]?.url) {
      // stick with the cache but update the signal metrics
      for (let i = 0; i < results.length; i++) {
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

  }

  async checkNewItems () {
    if (!this.results || this.hasHitLimit) {
      return
    }
    const results = await session.ctzn.db(this.userId).table("ctzn.network/comment").list({limit: 1, reverse: true})
    this.hasNewItems = (results[0] && results[0].key !== this.results[0].key)
  }

  async pageLoadScrollTo (y) {
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
      window.scrollTo(0, y)
      if (numResults === this.results?.length || 0) {
        break
      }
    }

    setTimeout(() => {
      if (Math.abs(window.scrollY - y) > 10) {
        window.scrollTo(0, y)
      }
    }, 500)
  }

  requestResultUpdates () {
    let commentEls = this.querySelectorAll('ctzn-comment-view')
    for (let el of Array.from(commentEls)) {
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
        <div class="bg-gray-100 text-gray-500 py-44 text-center mb-5">
          <span class="spinner"></span>
        </div>
      `
    }
    if (!this.results.length) {
      return html`
        ${this.renderHasNewItems()}
        <div class="bg-gray-100 text-gray-500 py-44 text-center">
          <div class="fas fa-stream text-6xl text-gray-300 mb-8"></div>
            <div>This feed is empty.</div>
        </div>
      `
    }
    return html`
      ${this.renderHasNewItems()}
      ${this.renderResults()}
      ${this.results?.length && !this.hasHitLimit ? html`
        <div class="bottom-of-feed ${this.isLoadingMore ? 'bg-white' : ''} mb-10 py-4 sm:rounded text-center">
          <span class="spinner w-6 h-6 text-gray-500"></span>
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
        @click=${this.onClickViewNewComments}
      >
        New Comments <span class="fas fa-fw fa-angle-up"></span>
      </div>
    `
  }

  renderResults () {
    return html`
      ${repeat(this.results, result => result.url, (result, i) => this.renderResult(result, i))}
    `
  }
  
  renderResult (comment, index) {
    return html`
      <ctzn-comment-view
        class="block ${index === 0 ? '' : 'border-t border-gray-300'}"
        .comment=${comment}
        mode="default"
      ></ctzn-comment-view>
    `
  }

  // events
  // =

  onClickViewNewComments (e) {
    this.hasNewItems = false
    this.load()
    window.scrollTo(0, 0)
  }
}

customElements.define('ctzn-comments-feed', CommentsFeed)