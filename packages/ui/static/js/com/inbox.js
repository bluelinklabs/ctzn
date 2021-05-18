import { LitElement, html } from '../../vendor/lit/lit.min.js'
import { repeat } from '../../vendor/lit/directives/repeat.js'
import { emit } from '../lib/dom.js'
import { AVATAR_URL } from '../lib/const.js'
import { extractSchemaId } from '../lib/strings.js'
import * as session from '../lib/session.js'
import { relativeDate } from '../lib/time.js'
import * as displayNames from '../lib/display-names.js'
import './notification.js'

let _cache = undefined

export class Inbox extends LitElement {
  static get properties () {
    return {
      showDateTitles: {type: Boolean, attribute: 'show-date-titles'},
      dateTitleRange: {type: String, attribute: 'date-title-range'},
      title: {type: String},
      sort: {type: String},
      limit: {type: Number},
      results: {type: Array},
      isLoadingMore: {type: Boolean}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.showDateTitles = false
    this.dateTitleRange = undefined
    this.title = undefined
    this.sort = 'ctime'
    this.limit = 50//undefined
    this.results = undefined
    this.isLoadingMore = false

    // ui state
    this.loadMoreObserver = undefined

    // query state
    this.activeQuery = undefined
  }

  disconnectedCallback () {
    super.disconnectedCallback()
    if (this.loadMoreObserver) {
      this.loadMoreObserver.disconnect()
    }
  }

  get isLoading () {
    return !this.results || !!this.activeQuery
  }

  getSelectionState () {
    if (!this.results?.length) return 'none'
    let anySelected = false
    for (let res of this.results) {
      if (res.isSelected) {
        anySelected = true
      } else {
        if (anySelected) return 'some'
      }
    }
    return anySelected ? 'all' : 'none'
  }

  async load ({clearCurrent} = {clearCurrent: false}) {
    if (!session.isActive()) {
      session.onChange(() => this.load({clearCurrent}), {once: true})
      return
    }
    if (clearCurrent) {
      this.results = undefined
    } else if (_cache) {
      // use cached results
      this.results = _cache
      /* dont await */ this.queueQuery() // queue up a load to make sure we're getting latest
      return
    }
    return this.queueQuery()
  }

  updated () {
    if (typeof this.results === 'undefined') {
      if (!this.activeQuery) {
        this.load()
      }
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
      this.activeQuery = this.activeQuery.catch(e => undefined).then(r => {
        this.activeQuery = undefined
        this.queueQuery()
      })
    }
    return this.activeQuery
  }

  async query ({more} = {more: false}) {
    emit(this, 'load-state-updated')
    let results = more ? (this.results || []) : []
    this.isLoadingMore = more

    let lt = undefined
    if (more && results?.length) {
      let last = results[results.length - 1]
      lt = last.key
    }
    do {
      let subresults = (await session.ctzn.view('ctzn.network/notifications-view', {lt}))?.notifications
      if (subresults.length === 0) break
      
      lt = subresults[subresults.length - 1].key
      results = results.concat(subresults)

      // filter to replies and apply dedup, results may sometimes have duplicates
      results = results.filter((entry, index) => {
        if (!entry.item?.text) return false
        return results.findIndex(entry2 => entry2.itemUrl === entry.itemUrl) === index
      })
    } while (results.length < this.limit)

    console.log(results)
    if (more || _cache?.[0].itemUrl !== results[0]?.itemUrl) {
      this.results = results
      _cache = results
    }
    if (!results?.length && !this.results) {
      this.results = []
    }
    this.isLoadingMore = false
    this.activeQuery = undefined
    emit(this, 'load-state-updated', {detail: {isEmpty: this.results.length === 0}})
  }

  async loadNew (num) {
    if (!this.results) {
      return
    }
    let results = []
    while (num) {
      let subresults = (await session.ctzn.view('ctzn.network/notifications-view', {limit: num}))?.notifications
      if (!subresults?.length) break

      let n = subresults.length
      subresults = subresults.filter(r => r.itemUrl !== this.results?.[0]?.itemUrl)
      results = results.concat(subresults)
      if (n > subresults.length) break // ran into an item we already have

      num -= subresults.length
    }
    if (results?.length) {
      this.results = results.concat(results)
    }
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

  // rendering
  // =

  render () {
    if (!this.results) {
      return html`
        ${this.title ? html`<h2  class="results-header"><span>${this.title}</span></h2>` : ''}
        ${this.renderPlaceholderResult(0)}
        ${this.renderPlaceholderResult(1)}
        ${this.renderPlaceholderResult(2)}
        ${this.renderPlaceholderResult(3)}
        ${this.renderPlaceholderResult(4)}
      `
    }
    if (!this.results.length) {
      return html`
        <div class="bg-gray-100 text-gray-500 py-44 text-center border-b sm:border border-gray-300">
          <div class="fas fa-inbox text-6xl text-gray-300 mb-8"></div>
          <div>Your inbox is empty!</div>
        </div>
      `
    }
    return html`
      <link rel="stylesheet" href="/css/fontawesome.css">
      ${this.title ? html`<h2  class="results-header"><span>${this.title}</span></h2>` : ''}
      ${this.renderResults()}
      ${this.results?.length ? html`
        <div class="bottom-of-feed ${this.isLoadingMore ? 'bg-white' : ''} mb-10 py-4 sm:rounded text-center">
          ${this.isLoadingMore ? html`<span class="spinner w-6 h-6 text-gray-500"></span>` : ''}
        </div>
      ` : ''}
    `
  }

  renderResults () {
    const selectionState = this.getSelectionState()
    const selectAllIcon = (
      selectionState === 'all'
        ? 'fas fa-check-square'
        : selectionState === 'some'
          ? 'fas fa-minus-square'
          : 'far fa-square'
    )
    this.lastResultNiceDate = undefined // used by renderDateTitle
    return html`
      <div
        class="border-b sm:border border-gray-300 flex items-center px-2 py-2 sticky white-glass z-10 top-inbox-toolbar"
      >
        <app-button
          transparent
          btn-class="px-3 py-1 text-sm"
          icon=${selectAllIcon}
          @click=${this.onClickSelectAll}
        ></app-button>
        <app-button
          transparent
          class="ml-2"
          btn-class="px-3 py-1 text-sm"
          label="Mark Read"
          ?disabled=${selectionState === 'none'}
        ></app-button>
        <app-button
          transparent
          class="ml-2"
          btn-class="px-3 py-1 text-sm"
          label="Mark Unread"
          ?disabled=${selectionState === 'none'}
        ></app-button>
      </div>
      <div class="border-b sm:border sm:border-t-0 border-gray-300 text-center py-2 px-2">
        <div class="font-semibold"><span class="fas fa-flask mr-2"></span> Experimental Feature</div>
        <div class="text-sm">This is a proof-of-concept. It currently contains replies to your posts.</div>
      </div>
      ${repeat(this.results, result => result.url, (result, i) => html`
        ${this.renderDateTitle(result)}
        ${this.renderResult(result, i)}
      `)}
    `
  }

  renderDateTitle (result) {
    if (!this.showDateTitles) return ''
    var resultNiceDate = dateHeader(result.ctime, this.dateTitleRange)
    if (this.lastResultNiceDate === resultNiceDate) return ''
    this.lastResultNiceDate = resultNiceDate
    return html`
      <h2 class="results-header"><span>${resultNiceDate}</span></h2>
    `
  }
  
  renderResult (result, index) {
    const schemaId = extractSchemaId(result.itemUrl)
    if (schemaId !== 'ctzn.network/comment' && schemaId !== 'ctzn.network/follow' && schemaId !== 'ctzn.network/reaction') {
      return ''
    }
    const isUnread = false
    const blendedCreatedAt = new Date(result.blendedCreatedAt)
    return html`
      <div
        class="
          flex items-center border-b sm:border sm:border-t-0 text-sm cursor-pointer
          ${result.isSelected
            ? 'bg-blue-100 text-black border-blue-300 hov:hover:bg-blue-200'
            : isUnread
              ? 'bg-white border-gray-300 hov:hover:bg-gray-50'
              : 'bg-gray-100 text-gray-600 border-gray-300 hov:hover:bg-gray-200'
          }
        "
        @click=${e => this.onClickResult(e, result)}
      >
        <div class="py-2 px-3 text-gray-600" @click=${e => this.onToggleSelected(e, result)}>
          <span class="${result.isSelected ? 'fas fa-check-square' : 'far fa-square'}"></span>
        </div>
        <div class="py-2 pr-2">
          <img
            class="w-6 h-6 rounded-full object-cover"
            src=${AVATAR_URL(result.author.userId)}
          >
        </div>
        <div class="sm:flex flex-1 truncate py-2 pl-1 pr-3">
          <div class="font-semibold truncate" style="flex: 0 0 140px">
            ${displayNames.render(result.author.userId)}
          </div>
          <div class="flex-1 truncate">
            ${result.item.text}
          </div>
        </div>
        <div class="py-2 pr-3 sm:ml-0 ml-auto">
          ${relativeDate(blendedCreatedAt)}
        </div>
      </div>
    `
  }

  renderPlaceholderResult (index) {
    return html`
      <div class="block py-1 sm:border border-b border-gray-300 ${index !== 0 ? 'sm:border-t-0' : ''}">
        <div class="grid grid-post px-1 py-0.5">
          <div class="pl-2">
            <div class="block object-cover rounded-full mt-1 w-4 h-4 bg-gray-100"></div>
          </div>
          <div class="block bg-white min-w-0">
            <div class="pr-2 py-2 min-w-0">
              <div class="pl-1 pr-2.5 text-gray-600 truncate">
                <div class="bg-loading-gradient rounded h-4"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `
  }

  // events
  // =

  onClickResult (e, result) {
    emit(this, 'view-thread', {detail: {subject: {dbUrl: result.itemUrl, authorId: result.author.userId}}})
  }

  onToggleSelected (e, result) {
    e.preventDefault()
    e.stopPropagation()
    result.isSelected = !result.isSelected
    this.requestUpdate()
  }

  onClickSelectAll (e) {
    const selectionState = this.getSelectionState()
    for (let result of this.results) {
      if (selectionState === 'none') {
        result.isSelected = true
      } else {
        result.isSelected = false
      }
    }
    this.requestUpdate()
  }
}

customElements.define('app-inbox', Inbox)
