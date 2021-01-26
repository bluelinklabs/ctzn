import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { classMap } from '../../vendor/lit-element/lit-html/directives/class-map.js'
// import { SitesListPopup } from './popups/sites-list.js'
import css from '../../css/com/post.css.js'
import { emit } from '../lib/dom.js'
import * as toast from './toast.js'
import './composer.js'


export class Post extends LitElement {
  static get properties () {
    return {
      api: {type: Object},
      post: {type: Object},
      profile: {type: Object},
      context: {type: String},
      searchTerms: {type: String, attribute: 'search-terms'},
      isReplyOpen: {type: Boolean},
      nometa: {type: Boolean},
      noctrls: {type: Boolean},
      viewContentOnClick: {type: Boolean, attribute: 'view-content-on-click'}
    }
  }

  static get styles () {
    return css
  }

  constructor () {
    super()
    this.api = undefined
    this.post = undefined
    this.profile = undefined
    this.context = undefined
    this.searchTerms = undefined
    this.isReplyOpen = false
    this.nometa = false
    this.noctrls = false
    this.viewContentOnClick = false

    // helper state
    this.isMouseDown = false
    this.isMouseDragging = false
  }

  get myVote () {
    if (this.post?.votes.upvoterIds.includes(this.profile?.userId)) {
      return 1
    }
    if (this.post?.votes.downvoterIds.includes(this.profile?.userId)) {
      return -1
    }
  }

  get upvoteCount () {
    return this.post?.votes.upvoterIds.length
  }

  get downvoteCount () {
    return this.post?.votes.downvoterIds.length
  }

  get commentCount () {
    if (typeof this.post?.commentCount !== 'undefined') {
      return this.post.commentCount
    }
    if (typeof this.post?.replies !== 'undefined') {
      return this.post.replies.length
    }
    return 0
  }

  async reloadSignals () {
    this.post.votes = await this.api.votes.getVotesForSubject(this.post.url)
    this.requestUpdate()
  }

  // rendering
  // =

  render () {
    if (!this.post) {
      return html``
    }


    return html`
      <link rel="stylesheet" href=${(new URL('../../css/fontawesome.css', import.meta.url)).toString()}>
      <div
        class=${classMap({
          post: true,
          card: true
        })}
      >
        <a class="thumb" href=${this.post.author.url} title=${this.post.author.displayName} data-tooltip=${this.post.author.displayName}>
          <img class="favicon" src="/${this.post.author.userId}/avatar">
        </a>
        <span class="arrow"></span>
        <div
          class="container"
          @click=${e => { e.preventDefault(); e.stopPropagation() }}
          @mousedown=${this.onMousedownCard}
          @mouseup=${this.onMouseupCard}
          @mousemove=${this.onMousemoveCard}
        >
          ${this.nometa ? '' : html`<div class="header">
            <div class="origin">
              <a class="author displayname" href=${this.post.author.url} title=${this.post.author.displayName}>
                ${this.post.author.displayName}
              </a>
              <a class="author username" href=${this.post.author.url} title=${this.post.author.userId}>
                ${this.post.author.userId}
              </a>
            </div>
            <span>&middot;</span>
            <div class="date">
              <a href=${this.post.url} data-tooltip=${(new Date(this.post.value.createdAt)).toLocaleString()}>
                ${relativeDate(this.post.value.createdAt)}
              </a>
            </div>
          </div>`}
          ${this.context ? html`<div class="context">${this.context}</div>` : ''}
          <div class="content markdown">
            ${this.post.value.text ? (this.renderMatchText() || this.post.value.text) : ''}
          </div>
          ${this.noctrls ? '' : html`<div class="ctrls">
            ${this.renderVoteCtrl()}
            ${this.renderCommentsCtrl()}
          </div>`}
        </div>
      </div>
    `
  }

  renderVoteCtrl () {
    var myVote = this.myVote
    return html`
      <span class="vote-ctrl">
        <a class="up ${myVote === 1 ? 'pressed' : ''}" data-tooltip="Upvote" @click=${e => this.onToggleVote(e, 1)}>
          <span class="far fa-thumbs-up"></span>
          <span class="count">${this.upvoteCount}</span>
        </a>
        <a class="down ${myVote === -1 ? 'pressed' : ''}" data-tooltip="Downvote" @click=${e => this.onToggleVote(e, -1)}>
          <span class="far fa-thumbs-down"></span>
          <span class="count">${this.downvoteCount}</span>
        </a>
      </span>
    `
  }

  renderCommentsCtrl () {
    return html`
      <a class="comment-ctrl" @click=${this.onViewThread}>
        <span class="far fa-comment"></span>
        ${this.commentCount}
      </a>
    `
  }

  renderMatchText () {
    if (!this.searchTerms) return undefined
    let v = this.post.value.text
    if (!v) return undefined
    let re = new RegExp(`(${this.searchTerms.replace(/([\s]+)/g, '|')})`, 'gi')
    let text = v.replace(re, match => `<b>${match}</b>`)
    return text // TODO unsafeHTML
  }

  // events
  // =

  onClickReply (e) {
    e.preventDefault()
    this.isReplyOpen = true
  }

  onPublishReply (e) {
    e.preventDefault()
    e.stopPropagation()
    this.isReplyOpen = false
    emit(this, 'publish-reply')
  }

  onCancelReply (e) {
    this.isReplyOpen = false
  }

  onViewThread (e, record) {
    if (!this.viewContentOnClick && e.button === 0 && !e.metaKey && !e.ctrlKey) {
      e.preventDefault()
      e.stopPropagation()
      emit(this, 'view-thread', {detail: {subject: this.post}})
    }
  }

  onMousedownCard (e) {
    for (let el of e.path) {
      if (el.tagName === 'A' || el.tagName === 'CTZN-composer') return
    }
    this.isMouseDown = true
    this.isMouseDragging = false
  }

  onMousemoveCard (e) {
    if (this.isMouseDown) {
      this.isMouseDragging = true
    }
  }

  onMouseupCard (e) {
    if (!this.isMouseDown) return
    if (!this.isMouseDragging) {
      e.preventDefault()
      e.stopPropagation()
      emit(this, 'view-thread', {detail: {subject: this.post}})
    }
    this.isMouseDown = false
    this.isMouseDragging = false
  }

  onClickShowSites (e, results) {
    e.preventDefault()
    // TODO
    // SitesListPopup.create('Subscribed Sites', results.map(r => ({
    //   url: r.metadata.href,
    //   title: r.metadata.title || 'Untitled'
    // })))
  }

  async onToggleVote (e, value) {
    if (this.myVote && this.myVote === value) {
      await this.api.votes.del(this.post.url)
    } else {
      try {
        await this.api.votes.put({
          subjectUrl: this.post.url, 
          vote: value
        })
      } catch (e) {
        toast.create(e.message, 'error')
        console.error(e)
        return
      }
    }
    this.reloadSignals()
  }
}

customElements.define('ctzn-post', Post)

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