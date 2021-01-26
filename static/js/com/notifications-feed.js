import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { repeat } from '../../vendor/lit-element/lit-html/directives/repeat.js'
import css from '../../css/com/notifications-feed.css.js'
import { emit } from '../lib/dom.js'
import './notification.js'

export class NotificationsFeed extends LitElement {
  static get properties () {
    return {
      api: {type: Object},
      profile: {type: Object},
      showDateTitles: {type: Boolean, attribute: 'show-date-titles'},
      dateTitleRange: {type: String, attribute: 'date-title-range'},
      title: {type: String},
      sort: {type: String},
      limit: {type: Number},
      results: {type: Array}
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
    this.title = undefined
    this.sort = 'ctime'
    this.limit = undefined
    this.results = undefined

    // query state
    this.activeQuery = undefined
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
  }

  async query () {
    emit(this, 'load-state-updated')
    var results = []
    // because we collapse results, we need to run the query until the limit is fulfilled
    let lt = undefined
    do {
      let subresults = await this.api.notifications.list({limit: this.limit, reverse: true, lt})
      if (subresults.length === 0) break
      
      lt = String(Number(new Date(subresults[subresults.length - 1].createdAt)))
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
      return html``
    }
    return html`
      <link rel="stylesheet" href=${(new URL('../../css/fontawesome.css', import.meta.url)).toString()}>
      ${this.title ? html`<h2  class="results-header"><span>${this.title}</span></h2>` : ''}
      ${this.renderResults()}
    `
  }

  renderResults () {
    this.lastResultNiceDate = undefined // used by renderDateTitle
    return html`
      <div class="results">
        ${repeat(this.results, result => result.url, result => html`
          ${this.renderDateTitle(result)}
          ${this.renderNotification(result)}
        `)}
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
  
  renderNotification (notification) {
    return html`
      <ctzn-notification
        .api=${this.api}
        .notification=${notification}
        .profile=${this.profile}
        ?is-unread=${notification.ctime > this.notifications?.unreadSince}
      ></ctzn-notification>
    `
  }

  // events
  // =
}

customElements.define('ctzn-notifications-feed', NotificationsFeed)

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