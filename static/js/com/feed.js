import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { repeat } from '../../vendor/lit-element/lit-html/directives/repeat.js'
import css from '../../css/com/feed.css.js'
import { emit } from '../lib/dom.js'
import './post.js'

export class Feed extends LitElement {
  static get properties () {
    return {
      api: {type: Object},
      profile: {type: Object},
      source: {type: String},
      pathQuery: {type: Array},
      showDateTitles: {type: Boolean, attribute: 'show-date-titles'},
      dateTitleRange: {type: String, attribute: 'date-title-range'},
      forceRenderMode: {type: String, attribute: 'force-render-mode'},
      recordClass: {type: String, attribute: 'record-class'},
      title: {type: String},
      sort: {type: String},
      limit: {type: Number},
      notifications: {type: Object},
      filter: {type: String},
      results: {type: Array},
      emptyMessage: {type: String, attribute: 'empty-message'},
      noMerge: {type: Boolean, attribute: 'no-merge'}
    }
  }

  static get styles () {
    return css
  }

  constructor () {
    super()
    this.api = undefined
    this.profile = undefined
    this.showDateTitles = false
    this.dateTitleRange = undefined
    this.forceRenderMode = undefined
    this.recordClass = ''
    this.title = undefined
    this.sort = 'ctime'
    this.limit = undefined
    this.filter = undefined
    this.notifications = undefined
    this.results = undefined
    this.emptyMessage = undefined
    this.noMerge = false

    // query state
    this.activeQuery = undefined
    this.abortController = undefined
  }

  get isLoading () {
    return !this.results || !!this.activeQuery
  }

  async load ({clearCurrent} = {clearCurrent: false}) {
    if (clearCurrent) this.results = undefined
    this.queueQuery()
  }

  updated (changedProperties) {
    if (!this.api) return
    if (typeof this.results === 'undefined') {
      if (!this.activeQuery) {
        this.queueQuery()
      }
    }
    if (changedProperties.has('filter') && changedProperties.get('filter') != this.filter) {
      this.queueQuery()
    } else if (changedProperties.has('pathQuery') && changedProperties.get('pathQuery') != this.pathQuery) {
      // NOTE ^ to correctly track this, the query arrays must be reused
      this.results = undefined // clear results while loading
      this.queueQuery()
    } else if (changedProperties.has('source') && !isArrayEq(this.source, changedProperties.get('source'))) {
      this.queueQuery()
    }
  }

  queueQuery () {
    if (!this.activeQuery) {
      this.activeQuery = this.query()
      this.requestUpdate()
    } else {
      if (this.abortController) this.abortController.abort()
      this.activeQuery = this.activeQuery.catch(e => undefined).then(r => {
        this.activeQuery = undefined
        this.queueQuery()
      })
    }
  }

  async query () {
    emit(this, 'load-state-updated')
    this.abortController = new AbortController()
    var results = []
    // because we collapse results, we need to run the query until the limit is fulfilled
    let lt = undefined
    do {
      let subresults = await this.api.posts.listUserFeed(this.source || 'pfrazee', {limit: this.limit, reverse: true, lt})
      if (subresults.length === 0) break
      
      lt = subresults[subresults.length - 1].key
      if (!this.noMerge) {
        subresults = subresults.reduce(reduceMultipleActions, [])
      }
      results = results.concat(subresults)
    } while (results.length < this.limit)
    console.log(results)
    this.results = results
    this.activeQuery = undefined
    emit(this, 'load-state-updated', {detail: {isEmpty: this.results.length === 0}})
  }

  // rendering
  // =

  render () {
    if (!this.results) {
      return html`
        ${this.title ? html`<h2  class="results-header"><span>${this.title}</span></h2>` : ''}
        <div class="results empty">
          <span class="spinner"></span>
        </div>
      `
    }
    if (!this.results.length) {
      if (!this.emptyMessage) return html``
      return html`
        <link rel="stylesheet" href=${(new URL('../../css/fontawesome.css', import.meta.url)).toString()}>
        ${this.title ? html`<h2  class="results-header"><span>${this.title}</span></h2>` : ''}
        <div class="results empty">
          <span>${this.emptyMessage}</div></span>
        </div>
      `
    }
    return html`
      <link rel="stylesheet" href=${(new URL('../../css/fontawesome.css', import.meta.url)).toString()}>
      ${this.title ? html`<h2  class="results-header"><span>${this.title}</span></h2>` : ''}
      ${this.renderResults()}
    `
  }

  renderResults () {
    this.lastResultNiceDate = undefined // used by renderDateTitle
    if (!this.filter) {
      return html`
        <div class="results">
          ${repeat(this.results, result => result.url, result => html`
            ${this.renderDateTitle(result)}
            ${this.renderNormalResult(result)}
          `)}
        </div>
      `
    }
    return html`
      <div class="results">
        ${repeat(this.results, result => result.url, result => this.renderSearchResult(result))}
      </div>
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
  
  renderNormalResult (post) {
    return html`
      <ctzn-post
        .api=${this.api}
        .post=${post}
        .profile=${this.profile}
        ?is-notification=${!!this.notifications}
        ?is-unread=${post.ctime > this.notifications?.unreadSince}
        class=${this.recordClass}
        show-context
      ></ctzn-post>
    `
  }

  renderSearchResult (result) {
    var renderMode = this.forceRenderMode || ({
      'comment': 'card',
      'microblogpost': 'card',
      'subscription': 'action',
    })[getRecordType(result)] || 'expanded-link'
    return html`
      <ctzn-record
        .record=${result}
        .profile=${this.profile}
        class=${this.recordClass}
        render-mode=${renderMode}
        search-terms=${this.filter}
        show-context
      ></ctzn-record>
    `
  }

  // events
  // =
}

customElements.define('ctzn-feed', Feed)

function isArrayEq (a, b) {
  if (!a && !!b) return false
  if (!!a && !b) return false
  return a.sort().toString() == b.sort().toString() 
}

const HOUR = 1e3 * 60 * 60
const DAY = HOUR * 24
function dateHeader (ts, range) {
  const endOfTodayMs = +((new Date).setHours(23,59,59,999))
  var diff = endOfTodayMs - ts
  if (diff < DAY) return 'Today'
  if (diff < DAY * 6) return (new Date(ts)).toLocaleDateString('default', { weekday: 'long' })
  if (range === 'month') return (new Date(ts)).toLocaleDateString('default', { month: 'short', year: 'numeric' })
  return (new Date(ts)).toLocaleDateString('default', { weekday: 'long', month: 'short', day: 'numeric' })
}

function reduceMultipleActions (acc, result) {
  acc.push(result)
  return acc

  // TODO
  let last = acc[acc.length - 1]
  if (last) {
    if (last.site.url === result.site.url && getRecordType(result) === 'subscription' && getRecordType(last) === 'subscription') {
      last.mergedItems = last.mergedItems || []
      last.mergedItems.push(result)
      return acc
    }
  }
  acc.push(result)
  return acc
}