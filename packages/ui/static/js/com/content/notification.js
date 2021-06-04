import { LitElement, html } from '../../../vendor/lit/lit.min.js'
import { unsafeHTML } from '../../../vendor/lit/directives/unsafe-html.js'
import { asyncReplace } from '../../../vendor/lit/directives/async-replace.js'
import { repeat } from '../../../vendor/lit/directives/repeat.js'
import * as session from '../../lib/session.js'
import { AVATAR_URL } from '../../lib/const.js'
import { emit } from '../../lib/dom.js'
import { extractSchemaId, makeSafe, pluralize } from '../../lib/strings.js'
import { emojify } from '../../lib/emojify.js'
import * as displayNames from '../../lib/display-names.js'
import './post.js'

const _itemCache = {}

export class Notification extends LitElement {
  static get properties () {
    return {
      notification: {type: Object},
      isUnread: {type: Boolean, attribute: 'is-unread'},
      isReplyOpen: {type: Boolean},
      viewContentOnClick: {type: Boolean, attribute: 'view-content-on-click'}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.notification = undefined
    this.isUnread = false
    this.viewContentOnClick = false

    // helper state
    this.isMouseDown = false
    this.isMouseDragging = false
  }

  get schemaId () {
    if (!this.notification) return ''
  }

  get replyCount () {
    if (typeof this.notification?.replyCount !== 'undefined') {
      return this.notification.replyCount
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

    if (!note.item) {
      console.warn('Malformed notification, skipping render', note)
      return ''
    }

    let subject
    let subjectSchemaId
    let replyCommentInfo

    let otherAuthors
    if (note.mergedNotes?.length) {
      let others = new Set(note.mergedNotes.map(n => n?.author?.dbKey).filter(Boolean))
      others.delete(note.author.dbKey)
      if (others.size > 0) otherAuthors = Array.from(others)
    }

    var icon
    var action = ''
    if (schemaId === 'ctzn.network/comment') {
      replyCommentInfo = {
        dbUrl: note.itemUrl
      }
      if (note.item.reply?.parent && note.item.reply?.parent.dbUrl.startsWith(session.info.dbUrl)) {
        subject = note.item.reply.parent
      } else {
        subject = note.item.reply.root
      }
      action = 'replied to'
      icon = 'fas fa-reply'
    } else if (schemaId === 'ctzn.network/follow') {
      subject = note.item.subject
      action = 'followed'
      icon = 'fas fa-user-plus'
    } else if (schemaId === 'ctzn.network/post') {
      subject = note.item.source
      action = 'reposted'
      icon = 'fas fa-retweet'
    } else if (schemaId === 'ctzn.network/reaction') {
      subject = note.item.subject
      action = 'reacted to'
      icon = 'fas fa-heart'
    } else if (schemaId === 'ctzn.network/vote') {
      subject = note.item.subject
      if (note.item.vote === 1) {
        action = 'upvoted'
        icon = 'fas fa-arrow-up'
      } else if (note.item.vote === -1) {
        action = 'downvoted'
        icon = 'fas fa-arrow-down'
      }
    } else {
      return ''
    }

    subjectSchemaId = subject ? extractSchemaId(subject.dbUrl): undefined
    var target = ''
    if (['ctzn.network/post', 'ctzn.network/comment'].includes(subjectSchemaId)) {
      target = `your ${subjectSchemaId === 'ctzn.network/post' ? 'post' : 'comment'}`
    } else if (!subjectSchemaId) {
      target = 'you'
    }
    
    return html`
      <div class="wrapper ${this.isUnread ? 'is-unread' : ''} flex cursor-pointer" @click=${this.onClickWrapper}>
        <div class="icon-wrapper w-12 text-center pt-4 pl-2 leading-9">
          <span class="icon ${icon}"></span>
        </div>
        <div class="flex-1 min-w-0">
          <div class="avatars flex items-center pt-4 px-3 pb-2">
            <a href="/${note.author.dbKey}">
              <img class="avatar w-8 h-8 object-cover mr-2" src=${AVATAR_URL(note.author.dbKey)}>
            </a>
            ${otherAuthors?.length ? html`
              ${repeat(otherAuthors.slice(0, 5), dbKey => html`
                <a href="/${dbKey}">
                  <img class="avatar w-8 h-8 object-cover mr-2" src=${AVATAR_URL(dbKey)}>
                </a>
              `)}
              ${otherAuthors.length > 5 ? html`
                <span class="more-authors ml-1">+${otherAuthors.length - 5}</span>
              ` : ''}
            ` : ''}
          </div>
          <div class="notification-metadata pl-3 pr-4 pb-2">
            <a class="display-name" href="/${note.author.dbKey}">
              ${displayNames.render(note.author.dbKey)}
            </a>
            ${otherAuthors ? html`and ${otherAuthors.length} ${pluralize(otherAuthors.length, 'other')}` : ''}
            ${action} ${target} &middot; ${relativeDate(note.blendedCreatedAt)}
          </div>
          ${schemaId === 'ctzn.network/comment' ? html`
            <div class="pb-5">
              <div class="comment-wrapper ml-3 mr-6 px-4 py-4">
                ${asyncReplace(this.renderReplyComment(replyCommentInfo))}
              </div>
            </div>
          ` : (schemaId === 'ctzn.network/post' || schemaId === 'ctzn.network/reaction' || schemaId === 'ctzn.network/vote') ? html`
            ${schemaId === 'ctzn.network/reaction' ? this.renderReactions() : ''}
            <div class="subject-wrapper pl-3 pr-6 pb-4">
              ${asyncReplace(this.renderSubject())}
            </div>
          ` : html`
            <div class="pb-2"></div>
          `}
        </div>
      </div>
    `
  }

  async *renderSubject () {
    const {dbUrl} = (this.notification.item.subject || this.notification.item.source)
    
    if (!_itemCache[dbUrl]) {
      yield html`Loading...`
    }

    const schemaId = extractSchemaId(dbUrl)
    let record
    if (schemaId === 'ctzn.network/post') {
      record = _itemCache[dbUrl] ? _itemCache[dbUrl] : await session.api.getPost(dbUrl)
      _itemCache[dbUrl] = record
      yield html`
        <app-post
          .post=${record}
          mode="content-only"
          .renderOpts=${{noclick: true}}
        ></app-post>
      `
    } else if (schemaId === 'ctzn.network/comment') {
      record = _itemCache[dbUrl] ? _itemCache[dbUrl] : await session.api.getComment(dbUrl)
      _itemCache[dbUrl] = record
      yield html`
        <app-post
          .post=${record}
          mode="content-only"
          .renderOpts=${{noclick: true}}
        ></app-post>
      `
    }
  }

  async *renderReplyComment (commentInfo) {
    if (!_itemCache[commentInfo.dbUrl]) {
      yield html`Loading...`
    }

    let record = _itemCache[commentInfo.dbUrl] ? _itemCache[commentInfo.dbUrl] : await session.api.getComment(commentInfo.dbUrl)
    _itemCache[commentInfo.dbUrl] = record
    yield html`
      <app-post
        .post=${record}
        mode="content-only"
        .renderOpts=${{noclick: true}}
      ></app-post>
    `
  }

  renderReactions () {
    const note = this.notification
    let reactions = {}
    reactions[note.item.reaction] = 1
    if (note.mergedNotes) {
      for (let note2 of note.mergedNotes) {
        if (note2.item?.reaction) {
          reactions[note2.item.reaction] = (reactions[note2.item.reaction] || 0) + 1
        }
      }
    }
    return html`
      <div class="pl-3 pb-3 pr-6">
        ${repeat(Object.entries(reactions), ([reaction, count]) => html`
          <span class="reaction inline-block px-1.5 py-0.5">
            ${unsafeHTML(emojify(makeSafe(reaction)))}
            <sup>${count}</sup>
          </span>
        `)}
      </div>
    `
  }

  // events
  // =

  async onClickWrapper (e) {
    for (let el of e.composedPath()) {
      if (el.tagName === 'A') return
    }
    e.preventDefault()

    let schemaId = extractSchemaId(this.notification.itemUrl)
    if (schemaId === 'ctzn.network/post'){
      const subject = await session.api.getPost(this.notification.itemUrl)
      emit(this, 'view-thread', {detail: {subject: {dbUrl: subject.dbUrl}}})
    } else if (schemaId === 'ctzn.network/comment') {
      const subject = await session.api.getComment(this.notification.itemUrl)
      emit(this, 'view-thread', {detail: {subject: {dbUrl: subject.dbUrl}}})
    } else if (schemaId === 'ctzn.network/follow') {
      window.location = `/${this.notification.author.dbKey}`
    } else if (schemaId === 'ctzn.network/reaction') {
      emit(this, 'view-thread', {detail: {subject: {dbUrl: this.notification.item.subject.dbUrl}}})
    }
  }
}

customElements.define('app-notification', Notification)

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