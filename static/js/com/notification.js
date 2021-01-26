import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { classMap } from '../../vendor/lit-element/lit-html/directives/class-map.js'
import { asyncReplace } from '../../vendor/lit-element/lit-html/directives/async-replace.js'
// import { SitesListPopup } from './popups/sites-list.js'
import css from '../../css/com/notification.css.js'
import { emit } from '../lib/dom.js'
import { extractSchemaId } from '../lib/strings.js'
import * as toast from './toast.js'
import './post.js'
import './user-list.js'

export class Notification extends LitElement {
  static get properties () {
    return {
      api: {type: Object},
      notification: {type: Object},
      profile: {type: Object},
      isUnread: {type: Boolean, attribute: 'is-unread'},
      isReplyOpen: {type: Boolean},
      viewContentOnClick: {type: Boolean, attribute: 'view-content-on-click'}
    }
  }

  static get styles () {
    return css
  }

  constructor () {
    super()
    this.api = undefined
    this.notification = undefined
    this.profile = undefined
    this.isUnread = false
    this.viewContentOnClick = false

    // helper state
    this.isMouseDown = false
    this.isMouseDragging = false
  }

  get schemaId () {
    if (!this.notification) return ''
  }

  get myVote () {
    if (this.notification?.votes.upvoterIds.includes(this.profile?.userId)) {
      return 1
    }
    if (this.notification?.votes.downvoterIds.includes(this.profile?.userId)) {
      return -1
    }
  }

  get upvoteCount () {
    return this.notification?.votes.upvoterIds.length
  }

  get downvoteCount () {
    return this.notification?.votes.downvoterIds.length
  }

  get commentCount () {
    if (typeof this.notification?.commentCount !== 'undefined') {
      return this.notification.commentCount
    }
    if (typeof this.notification?.replies !== 'undefined') {
      return this.notification.replies.length
    }
    return 0
  }

  // rendering
  // =

  render () {
    const note = this.notification
    const schemaId = extractSchemaId(note.itemUrl)
    const subjectSchemaId = extractSchemaId(note.item.subjectUrl)

    var icon
    var action = ''
    if (schemaId === 'ctzn.network/vote') {
      if (note.item.vote === 1) {
        action = 'upvoted'
        icon = 'fas fa-arrow-up'
      } else if (note.item.vote === -1) {
        action = 'downvoted'
        icon = 'fas fa-arrow-down'
      }
    } else if (schemaId === 'ctzn.network/comment') {
      action = 'replied to'
      icon = 'far fa-comment'
    } else if (schemaId === 'ctzn.network/follow') {
      action = 'followed'
      icon = 'fas fa-rss'
    }

    var target = ''
    if (subjectSchemaId === 'ctzn.network/post') {
      target = 'your post'
    } else if (subjectSchemaId === 'ctzn.network/comment') {
      target = 'your comment'
    } else if (!subjectSchemaId) {
      target = 'you'
    }

    return html`
      <link rel="stylesheet" href=${(new URL('../../css/fontawesome.css', import.meta.url)).toString()}>
      <div class="wrapper ${this.isUnread ? 'unread' : ''}" @click=${this.onClickWrapper}>
        ${schemaId === 'ctzn.network/comment' ? html`
          <div class="comment">
            ${asyncReplace(this.renderComment(this.api, this.profile, note.itemUrl, html`<span class="fas fa-reply"></span> ${action} ${target}`))}
          </div>
        ` : html`
          <div class="notification ${schemaId === 'ctzn.network/follow' ? 'padded' : ''}">
            <span class=${icon}></span>
            <a class="author" href="/${note.author.userId}" title=${note.author.userId}>
              <img src="/${note.author.userId}/avatar">
              ${note.author.userId}
            </a>
            ${action} ${target} &middot; ${relativeDate(note.createdAt)}
          </div>
          ${['ctzn.network/post', 'ctzn.network/comment'].includes(subjectSchemaId) ? html`
            <div class="subject">
              ${asyncReplace(this.renderSubject(this.api, this.profile, note.item.subjectUrl, subjectSchemaId))}
            </div>
          ` : ''}
          ${schemaId === 'ctzn.network/follow' ? html`
            <div class="user-card">
              <ctzn-user-list .api=${this.api} .profile=${this.profile} .ids=${[note.author.userId]}></ctzn-user-list>
            </div>
          ` : ''}
        `}
      </div>
    `
  }


  async *renderSubject (api, profile, url, schemaId) {
    yield html`Loading...`

    let record
    if (schemaId === 'ctzn.network/post') {
      record = await api.posts.get(url)
    } else {
      record = await api.comments.get(url)
    }

    yield html`
      <ctzn-post
        .api=${api}
        .post=${record}
        .profile=${profile}
        noborders
        nothumb
        nometa
        noctrls
      ></ctzn-post>
    `
  }

  async *renderComment (api, profile, url, context) {
    yield html`Loading...`

    let record = await api.comments.get(url)

    yield html`
      <ctzn-post
        .api=${api}
        .post=${record}
        .profile=${profile}
        .context=${context}
        noborders
      ></ctzn-post>
    `
  }

  // events
  // =

  async onClickWrapper (e) {
    e.preventDefault()

    const schemaId = extractSchemaId(this.notification.itemUrl)
    if (schemaId === 'ctzn.network/comment'){
      const subject = await this.api.comments.get(this.notification.itemUrl)
      emit(this, 'view-thread', {detail: {subject}})
    } else if (schemaId === 'ctzn.network/vote') {
      const subjectSchemaId = extractSchemaId(this.notification.item.subjectUrl)
      const subject = subjectSchemaId === 'ctzn.network/post'
        ? await this.api.posts.get(this.notification.item.subjectUrl)
        : await this.api.comments.get(this.notification.item.subjectUrl)
      emit(this, 'view-thread', {detail: {subject}})
    } else if (schemaId === 'ctzn.network/follow') {
      window.location = `/${this.notification.author.userId}`
    }
  }
}

customElements.define('ctzn-notification', Notification)

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