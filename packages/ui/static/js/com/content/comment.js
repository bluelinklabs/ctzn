import { LitElement, html } from '../../../vendor/lit/lit.min.js'
import { unsafeHTML } from '../../../vendor/lit/directives/unsafe-html.js'
import { AVATAR_URL, COMMENT_URL, FULL_COMMENT_URL } from '../../lib/const.js'
import { writeToClipboard } from '../../lib/clipboard.js'
import { CommentComposerPopup } from '../popups/comment-composer.js'
import * as session from '../../lib/session.js'
import { emit } from '../../lib/dom.js'
import { makeSafe, linkify } from '../../lib/strings.js'
import { relativeDate } from '../../lib/time.js'
import { emojify } from '../../lib/emojify.js'
import * as displayNames from '../../lib/display-names.js'
import * as userIds from '../../lib/user-ids.js'
import * as contextMenu from '../context-menu.js'
import * as toast from '../toast.js'
import * as icons from '../icons.js'
import './comment-composer.js'

export class Comment extends LitElement {
  static get properties () {
    return {
      mode: {type: String}, // 'default', 'as-reply', or 'content-only'
      src: {type: String},
      comment: {type: Object},
      renderOpts: {type: Object},
      isReplyOpen: {type: Boolean},
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.comment = undefined
    this.mode = 'default'
    this.renderOpts = {noclick: false}
    this.isReplyOpen = false

    // helper state
    this.isMouseDown = false
    this.isMouseDragging = false
  }

  updated (changedProperties) {
    if (changedProperties.has('src') && this.src !== changedProperties.get('src')) {
      this.load()
    }
  }

  async load () {
    this.comment = undefined
    this.comment = await session.api.getComment(this.src).catch(e => ({error: true, message: e.toString()}))
  }

  get isMyComment () {
    if (!session.isActive() || !this.comment?.author.dbKey) {
      return false
    }
    return session.info?.dbKey === this.comment?.author.dbKey
  }

  get replyCount () {
    if (typeof this.comment?.replyCount !== 'undefined') {
      return this.comment.replyCount
    }
    if (typeof this.comment?.replies !== 'undefined') {
      return this.comment.replies.length
    }
    return 0
  }

  async reloadSignals () {
    this.requestUpdate()
  }

  // rendering
  // =

  render () {
    if (!this.comment) {
      return html``
    }

    if (this.comment.error) {
      return html`
        <div class="px-4 py-2 min-w-0 bg-gray-50">
          <div class="font-semibold text-gray-600">
            <span class="fas fa-fw fa-exclamation-circle"></span> Failed to load comment
          </div>
          ${this.comment.message ? html`
            <div class="text-gray-500 text-sm">
              ${this.comment.message}
            </div>
          ` : ''}
        </div>
      `
    }

    if (this.mode === 'content-only') {
      return this.renderContentOnly()
    } else {
      return this.renderAsReply()
    }
  }

  renderAsReply () {
    return html`
      <div
        class="as-reply-wrapper mb-0.5 ${this.renderOpts.noclick ? '' : 'cursor-pointer'}"
        @click=${this.onClickCard}
        @mousedown=${this.onMousedownCard}
        @mouseup=${this.onMouseupCard}
        @mousemove=${this.onMousemoveCard}
      >
        <div class="py-2 min-w-0">
          <div class="comment-metadata flex pr-2.5 items-center">
            <a class="block relative" href="/${this.comment.author.dbKey}" title=${this.comment.author.displayName}>
              <img class="avatar block w-4 h-4 object-cover mr-1" src=${AVATAR_URL(this.comment.author.dbKey)}>
            </a>
            <div class="whitespace-nowrap mr-1">
              <a class="hov:hover:underline" href="/${this.comment.author.dbKey}" title=${this.comment.author.displayName}>
                <span class="display-name">${displayNames.render(this.comment.author.dbKey)}</span>
              </a>
            </div>
            <span class="whitespace-nowrap">
              <a class="hov:hover:underline" href="/${this.comment.author.dbKey}" title=${this.comment.author.displayName}>
                <span class="userid">@${userIds.render(this.comment.author.dbKey)}</span>
              </a>
            </span>
            <span class="mx-1">&middot;</span>
            <a class="comment-date hov:hover:underline" href="${COMMENT_URL(this.comment)}" data-tooltip=${(new Date(this.comment.value.createdAt)).toLocaleString()}>
              ${relativeDate(this.comment.value.createdAt)}
            </a>
          </div>
          ${this.renderCommentText()}
          <div class="comment-actions pl-4">
            ${this.renderUpvoteButton()}
            ${this.renderDownvoteButton()}
            ${this.renderRepliesBtn()}
            <a
              class="cursor-pointer tooltip-right px-2 py-1 ml-2"
              @click=${this.onClickMenu}
            >
              <span class="fas fa-fw fa-ellipsis-h"></span>
            </a>
          </div>
          ${this.isReplyOpen ? html`
            <div class="comment-composer-wrapper py-2 px-2 my-2 mx-1">
              <app-comment-composer
                autofocus
                .subject=${this.comment.value.reply.root}
                .parent=${{dbUrl: this.comment.dbUrl}}
                placeholder="Write your reply. Remember to always be kind!"
                @publish=${this.onPublishReply}
                @cancel=${this.onCancelReply}
              ></app-comment-composer>
            </div>
          ` : ''}
        </div>
      </div>
    `
  }

  renderContentOnly () {
    return html`
      <div
        class="content-only-wrapper ${this.renderOpts.noclick ? '' : 'cursor-pointer'}"
        @click=${this.onClickCard}
        @mousedown=${this.onMousedownCard}
        @mouseup=${this.onMouseupCard}
        @mousemove=${this.onMousemoveCard}
      >
        ${this.renderCommentText()}
      </div>
    `
  }

  renderCommentText () {
    let cls
    let style
    if (this.mode === 'as-reply') {
      cls = 'whitespace-pre-wrap break-words pt-1 pb-1.5 pl-5 pr-2.5'
    } else {
      cls = 'whitespace-pre-wrap break-words mt-1 mb-1 ml-1 mr-2.5'
    }
    return html`
      <div
        class="comment-text ${cls}"
        style=${style}
        @click=${this.onClickText}
      >${unsafeHTML(emojify(linkify(makeSafe(this.comment.value.text))))}</div>`
  }

  renderRepliesBtn () {
    return html`
      <a
        class="reply px-2 py-1 cursor-pointer"
        @click=${this.onClickReply}
      >
        ${this.mode === 'default' ? html`
          <span class="far fa-comment"></span> ${this.replyCount}
        ` : html`
          <span class="fas fa-fw fa-reply"></span> Reply
        `}
      </a>
    `
  }

  renderUpvoteButton () {
    return html`
      <a
        class="upvote pl-2 pr-1 mr-2 py-1 cursor-pointer"
      >
        <span style="position: relative; top: -1px">
          ${icons.upArrow(16, 16, 45)}
        </span>
      </a>
    `
  }

  renderDownvoteButton () {
    return html`
      <a
        class="downvote pl-2 pr-1 mr-2 py-1 cursor-pointer"
      >
        ${icons.downArrow(16, 16, 45)}
      </a>
    `
  }

  // events
  // =

  onClickText (e) {
    for (let el of e.composedPath()) {
      if (el === this) break
      if (el.tagName === 'A' && el.getAttribute('href')) {
        // open in a new window
        window.open(el.getAttribute('href'))
        e.preventDefault()
        e.stopPropagation()
        return
      }
    }
  }

  onClickCard (e) {
    if (this.renderOpts.noclick) return
    for (let el of e.composedPath()) {
      if (el === this) break
      if (el.tagName === 'A' || el.tagName === 'IMG' || el.tagName === 'APP-COMMENT-COMPOSER') {
        return
      }
    }
    e.preventDefault()
    e.stopPropagation()
  }

  onMousedownCard (e) {
    if (this.renderOpts.noclick) return
    for (let el of e.composedPath()) {
      if (el === this) break
      if (el.tagName === 'A' || el.tagName === 'IMG' || el.tagName === 'APP-COMMENT-COMPOSER') {
        return
      }
    }
    this.isMouseDown = true
    this.isMouseDragging = false
  }

  onMousemoveCard (e) {
    if (this.renderOpts.noclick) return
    if (this.isMouseDown) {
      this.isMouseDragging = true
    }
  }

  onMouseupCard (e) {
    if (this.renderOpts.noclick) return
    if (!this.isMouseDown) return
    if (!this.isMouseDragging) {
      e.preventDefault()
      e.stopPropagation()
      emit(this, 'view-thread', {detail: {subject: {dbUrl: this.comment.dbUrl, authorId: this.comment.author.dbKey}}})
    }
    this.isMouseDown = false
    this.isMouseDragging = false
  }

  async onClickReply (e) {
    e.preventDefault()
    if (matchMedia('(max-width: 1150px)').matches) {
      await CommentComposerPopup.create({
        comment: this.comment
      })
      emit(this, 'publish-reply')
    } else {
      this.isReplyOpen = true
    }
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
      emit(this, 'view-thread', {detail: {subject: {dbUrl: this.comment.dbUrl, authorId: this.comment.author.dbKey}}})
    }
  }

  onClickMenu (e) {
    e.preventDefault()
    e.stopPropagation()
    const rect = e.currentTarget.getClientRects()[0]
    const parentRect = this.getClientRects()[0]
    let items = [
      {
        icon: 'fas fa-fw fa-link',
        label: 'Copy link',
        click: () => {
          writeToClipboard(FULL_COMMENT_URL(this.comment))
          toast.create('Copied to clipboard')
        }
      }
    ]
    if (this.isMyComment) {
      items.push('-')
      items.push({
        icon: 'fas fa-fw fa-trash',
        label: 'Delete comment',
        click: () => {
          if (!confirm('Are you sure you want to delete this comment?')) {
            return
          }
          emit(this, 'delete-comment', {detail: {comment: this.comment}})
        }
      })
    }
    contextMenu.create({
      parent: this,
      x: rect.left - parentRect.left + 30,
      y: 0,
      right: true,
      roomy: true,
      noBorders: true,
      style: `padding: 4px 0; font-size: 13px`,
      items
    })
  }
}

customElements.define('app-comment', Comment)
