import { LitElement, html } from '../../vendor/lit/lit.min.js'
import { repeat } from '../../vendor/lit/directives/repeat.js'
import * as displayNames from '../lib/display-names.js'
import * as session from '../lib/session.js'
import { emit } from '../lib/dom.js'

const CHECK_NEW_ITEMS_INTERVAL = 30e3

export class DbmethodResultFeed extends LitElement {
  static get properties () {
    return {
      userId: {type: String, attribute: 'user-id'},
      results: {type: Array},
      emptyMessage: {type: String, attribute: 'empty-message'},
      hasNewItems: {type: Boolean}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.userId = undefined
    this.results = undefined
    this.emptyMessage = undefined
    this.hasNewItems = false

    // ui state
    this.loadMoreObserver = undefined
    setInterval(() => this.checkNewItems(), CHECK_NEW_ITEMS_INTERVAL)

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

  async load ({clearCurrent} = {clearCurrent: false}) {
    if (this.activeQuery) {
      return this.activeQuery
    }
    if (clearCurrent) {
      this.results = undefined
    }
    return this.queueQuery()
  }

  updated (changedProperties) {
    if (changedProperties.has('userId') && this.userId !== changedProperties.get('userId')) {
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
    emit(this, 'load-state-updated')
    this.abortController = new AbortController()
    let results = more ? (this.results || []) : []
    let lt = more ? results[results?.length - 1]?.key : undefined
    results = results.concat((await session.ctzn.view('ctzn.network/dbmethod-results-view', this.userId, {limit: this.limit, reverse: true, lt}))?.results)
    console.log(results)
    this.results = results
    this.activeQuery = undefined
    this.hasNewItems = false
    emit(this, 'load-state-updated', {detail: {isEmpty: this.results.length === 0}})
  }

  async checkNewItems () {
    if (!this.results) {
      return
    }
    let results = (await session.ctzn.view('ctzn.network/dbmethod-results-view', this.userId, {limit: 1, reverse: true}))?.results
    this.hasNewItems = (results[0] && results[0].key !== this.results[0]?.key)
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
        <div class="bg-gray-100 text-gray-500 py-44 text-center my-5">
          <span class="spinner"></span>
        </div>
      `
    }
    if (!this.results.length) {
      if (!this.emptyMessage) return html``
      return html`
        ${this.renderHasNewItems()}
        <div class="bg-gray-100 text-gray-500 py-44 text-center my-5">
          <div>${this.emptyMessage}</div>
        </div>
      `
    }
    return html`
      ${this.renderHasNewItems()}
      ${this.renderResults()}
      ${this.results?.length ? html`<div class="bottom-of-feed mb-10"></div>` : ''}
    `
  }

  renderHasNewItems () {
    if (!this.hasNewItems) {
      return ''
    }
    return html`
      <div
        class="new-items-indicator bg-blue-50 border border-blue-500 cursor-pointer fixed font-semibold hov:hover:bg-blue-100 inline-block px-4 py-2 rounded-3xl shadow-md text-blue-800 text-sm z-30"
        @click=${this.onClickViewNewCalls}
      >
        New Activity <span class="fas fa-fw fa-angle-up"></span>
      </div>
    `
  }

  renderResults () {
    this.lastResultNiceDate = undefined // used by renderDateTitle
    return html`
      ${repeat(this.results, result => result.url, result => html`
        ${this.renderResult(result)}
      `)}
    `
  }
  
  renderResult (result) {
    const authorId = result.value.call.authorId
    const call = result.call.value
    const isSuccess = result.value.code === 'success'
    return html`
      <div class="relative border-b border-gray-300 pl-10 pr-4 py-4 text-gray-700">
        <details>
          <summary>
            ${isSuccess ? html`
              <span class="absolute fas fa-fw fa-check-circle text-gray-500" style="top: 21px; left: 11px"></span>
            ` : html`
              <span class="absolute fas fa-fw fa-times-circle text-red-500" style="top: 21px; left: 11px"></span>
            `}
            <a
              class="text-${isSuccess ? 'gray' : 'red'}-800 bg-${isSuccess ? 'gray' : 'red'}-50 font-mono px-2 py-1 rounded hov:hover:underline text-sm"
              href="https://${call.method}"
              target="_blank"
            >${call.method}</a>
            <a
              href="/${authorId}"
              title=${authorId}
              class="text-sm text-blue-600 hov:hover:underline"
            >${displayNames.render(authorId)}</a>
            <span class="text-sm">${relativeDate(result.value.createdAt)}</span>
          </summary>
        ${call.args ? html`
            <div class="mt-2 text-gray-600 text-xs">Params</div>
            <div class="bg-gray-50 rounded p-2 text-sm text-gray-600 font-mono whitespace-pre overflow-x-auto">${JSON.stringify(call.args, null, 2)}</div>
        ` : ''}
        ${result.value.code !== 'success' || !!result.value.details ? html`
            <div class="mt-2 text-gray-600 text-xs">Result</div>
            <div class="bg-gray-50 rounded p-2 text-sm text-gray-600 font-mono whitespace-pre overflow-x-auto">${JSON.stringify({code: result.value.code, details: result.value.details}, null, 2)}</div>
        ` : ''}
        </details>
      </div>
    `
  }

  // events
  // =

  onClickViewNewCalls (e) {
    this.hasNewItems = false
    this.load()
    window.scrollTo(0, 0)
  }
}

customElements.define('app-dbmethod-result-feed', DbmethodResultFeed)

const MINUTE = 1e3 * 60
const HOUR = 1e3 * 60 * 60
const DAY = HOUR * 24

const rtf = new Intl.RelativeTimeFormat('en', {numeric: 'auto'})
function relativeDate (d) {
  const nowMs = Date.now()
  const endOfTodayMs = +((new Date).setHours(23,59,59,999))
  const dMs = +(new Date(d))
  let diff = nowMs - dMs
  let dayDiff = Math.floor((endOfTodayMs - dMs) / DAY)
  if (diff < (MINUTE * 5)) return 'just now'
  if (diff < HOUR) return rtf.format(Math.ceil(diff / MINUTE * -1), 'minute')
  if (dayDiff < 1) return rtf.format(Math.ceil(diff / HOUR * -1), 'hour')
  if (dayDiff <= 30) return rtf.format(dayDiff * -1, 'day')
  if (dayDiff <= 365) return rtf.format(Math.floor(dayDiff / 30) * -1, 'month')
  return rtf.format(Math.floor(dayDiff / 365) * -1, 'year')
}