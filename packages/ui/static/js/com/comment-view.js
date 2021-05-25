import { LitElement, html } from '../../vendor/lit/lit.min.js'
import { unsafeHTML } from '../../vendor/lit/directives/unsafe-html.js'
import { ifDefined } from '../../vendor/lit/directives/if-defined.js'
import { repeat } from '../../vendor/lit/directives/repeat.js'
import { asyncReplace } from '../../vendor/lit/directives/async-replace.js'
import { AVATAR_URL, COMMENT_URL, FULL_COMMENT_URL } from '../lib/const.js'
import { writeToClipboard } from '../lib/clipboard.js'
import { CommentComposerPopup } from '../com/popups/comment-composer.js'
import { ReactionsListPopup } from '../com/popups/reactions-list.js'
import * as session from '../lib/session.js'
import { emit } from '../lib/dom.js'
import { makeSafe, linkify, pluralize, parseSrcAttr, extractSchemaId } from '../lib/strings.js'
import { relativeDate } from '../lib/time.js'
import { emojify } from '../lib/emojify.js'
import * as displayNames from '../lib/display-names.js'
import * as contextMenu from '../com/context-menu.js'
import * as reactMenu from '../com/menus/react.js'
import * as toast from '../com/toast.js'
import '../com/comment-composer.js'

export class CommentView extends LitElement {
  static get properties () {
    return {
      mode: {type: String}, // 'default', 'as-reply', or 'content-only'
      src: {type: String},
      comment: {type: Object},
      renderOpts: {type: Object},
      isReplyOpen: {type: Boolean},
      isReactionsOpen: {type: Boolean}
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
    this.isReactionsOpen = false

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

  haveIReacted (reaction) {
    if (!session.isActive()) return
    return this.comment.reactions?.[reaction]?.includes(session.info.dbKey)
  }

  getMyReactions () {
    if (!session.isActive()) return []
    if (!this.comment.reactions) return []
    return Object.keys(this.comment.reactions).filter(reaction => {
      return this.comment.reactions[reaction].includes(session.info.dbKey)
    })
  }

  get hasReactions () {
    return (this.comment.reactions && Object.keys(this.comment.reactions).length > 0)
  }

  async reloadSignals () {
    this.comment.reactions = (await session.api.view.get('ctzn.network/views/reactions-to', {dbUrl: this.comment.dbUrl}))?.reactions
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

    if (this.mode === 'as-reply') {
      return this.renderAsReply()
    } else if (this.mode === 'content-only') {
      return this.renderContentOnly()
    } else {
      return this.renderDefault()
    }
  }

  renderDefault () {
    return html`
      <div
        class="px-1 py-0.5 bg-white sm:rounded mb-0.5 ${this.renderOpts.noclick ? '' : 'cursor-pointer'} text-gray-600"
        @click=${this.onClickCard}
        @mousedown=${this.onMousedownCard}
        @mouseup=${this.onMouseupCard}
        @mousemove=${this.onMousemoveCard}
      >
        <div class="grid grid-post">
          <div class="pl-2 pt-2">
            <a class="block" href="/${this.comment.author.dbKey}" title=${this.comment.author.displayName}>
              <img
                class="block object-cover rounded-full mt-1 w-11 h-11"
                src=${AVATAR_URL(this.comment.author.dbKey)}
              >
            </a>
          </div>
          <div class="block min-w-0">
            <div class="block min-w-0 pl-1 pt-2 text-sm truncate">
              <span class="fas fa-reply"></span> Reply to
              ${asyncReplace(this.renderReplyParentAsync())}
            </div>
            <div class="pr-2 pb-2 min-w-0">
              <div class="pl-1 pr-2.5 text-gray-600 truncate">
                <span class="sm:mr-1 whitespace-nowrap">
                  <a class="hov:hover:underline" href="/${this.comment.author.dbKey}" title=${this.comment.author.displayName}>
                    <span class="text-gray-800 font-semibold">${displayNames.render(this.comment.author.dbKey)}</span>
                  </a>
                </span>
                <span class="mr-2 text-sm">
                  <a class="hov:hover:underline" href="${COMMENT_URL(this.comment)}" data-tooltip=${(new Date(this.comment.value.createdAt)).toLocaleString()}>
                    ${relativeDate(this.comment.value.createdAt)}
                  </a>
                </span>
              </div>
              ${this.renderCommentText()}
              ${this.hasReactions ? html`
                <div class="flex items-center my-1.5 mx-0.5 text-gray-500 text-sm truncate">
                  ${this.renderReactions()}
                </div>
              ` : ''}
              <div class="flex pl-1 mt-0.5 text-gray-500 text-sm items-center justify-between pr-12 sm:w-72">
                ${this.renderRepliesBtn()}
                ${this.renderReactionsBtn()}
                <div>
                  <a class="hov:hover:bg-gray-200 px-1 rounded" @click=${this.onClickMenu}>
                    <span class="fas fa-fw fa-ellipsis-h"></span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `
  }

  renderAsReply () {
    return html`
      <div
        class="text-gray-600 sm:rounded mb-0.5 ${this.renderOpts.noclick ? '' : 'cursor-pointer'}"
        @click=${this.onClickCard}
        @mousedown=${this.onMousedownCard}
        @mouseup=${this.onMouseupCard}
        @mousemove=${this.onMousemoveCard}
      >
        <div class="py-2 min-w-0">
          <div class="flex pr-2.5 text-gray-500 text-xs items-center">
            <a class="block relative" href="/${this.comment.author.dbKey}" title=${this.comment.author.displayName}>
              <img class="block w-4 h-4 object-cover rounded-full mr-1" src=${AVATAR_URL(this.comment.author.dbKey)}>
            </a>
            <div class="whitespace-nowrap">
              <a class="hov:hover:underline" href="/${this.comment.author.dbKey}" title=${this.comment.author.displayName}>
                <span class="text-gray-700 font-medium">${displayNames.render(this.comment.author.dbKey)}</span>
              </a>
            </div>
            <span class="mx-1">&middot;</span>
            <a class="text-gray-500 hov:hover:underline" href="${COMMENT_URL(this.comment)}" data-tooltip=${(new Date(this.comment.value.createdAt)).toLocaleString()}>
              ${relativeDate(this.comment.value.createdAt)}
            </a>
          </div>
          ${this.renderCommentText()}
          ${this.hasReactions ? html`
            <div class="pb-1 pl-5">
              ${this.renderReactions()}
            </div>
          ` : ''}
          <div class="pl-4">
            ${this.renderRepliesBtn()}
            ${this.renderReactionsBtn()}
            ${this.renderActionsSummary()}
            <a
              class="cursor-pointer tooltip-right hov:hover:bg-gray-100 px-2 py-1 ml-2 text-xs text-gray-500 font-bold"
              @click=${this.onClickMenu}
            >
              <span class="fas fa-fw fa-ellipsis-h"></span>
            </a>
          </div>
          ${this.isReplyOpen ? html`
            <div class="border border-gray-300 rounded py-2 px-2 my-2 mx-1 bg-white">
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
        class="${this.renderOpts.noclick ? '' : 'cursor-pointer'}"
        @click=${this.onClickCard}
        @mousedown=${this.onMousedownCard}
        @mouseup=${this.onMouseupCard}
        @mousemove=${this.onMousemoveCard}
      >
        ${this.renderCommentText()}
      </div>
    `
  }

  async *renderReplyParentAsync () {
    let parent = this.comment.value.reply.parent || this.comment.value.reply.root
    if (!parent) return ''
    const schemaId = extractSchemaId(parent.dbUrl)
    let record
    if (schemaId === 'ctzn.network/post') {
      record = await session.api.getPost(parent.authorId, parent.dbUrl)
    } else if (schemaId === 'ctzn.network/comment') {
      record = await session.api.getComment(parent.authorId, parent.dbUrl)
    } else {
      return html`Content by ${parent.authorId}`
    }
    if (!record) {
      return html`A ${schemaId === 'ctzn.network/post' ? 'post' : 'comment'} by ${parent.authorId}`
    }
    yield html`${record.value.text}`
  }

  renderCommentText () {
    let cls
    let style
    if (this.mode === 'as-reply') {
      cls = 'whitespace-pre-wrap break-words text-sm leading-snug text-black pt-2 pb-1.5 pl-5 pr-2.5'
    } else {
      cls = 'whitespace-pre-wrap break-words text-black mt-1 mb-1 ml-1 mr-2.5'
      style = 'font-size: 16px; letter-spacing: 0.1px; line-height: 1.3;'
    }
    return html`
      <div
        class="${cls}"
        style=${style}
        @click=${this.onClickText}
      >${unsafeHTML(emojify(linkify(makeSafe(this.comment.value.text))))}</div>`
  }

  renderRepliesBtn () {
    return html`
      <a
        class="
          tooltip-right px-2 py-1
          ${this.mode === 'as-reply' ? 'text-xs font-bold' : ''}
          cursor-pointer text-gray-500 hov:hover:bg-gray-100
        "
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

  renderReactionsBtn () {
    return html`
      <a
        class="
          tooltip-right pl-2 pr-1 mr-2 py-1
          ${this.mode === 'as-reply' ? 'text-xs font-bold' : ''}
          cursor-pointer text-gray-500 hov:hover:bg-gray-100
          ${this.isReactionsOpen ? 'bg-gray-200' : ''}
        "
        @click=${this.onClickReactBtn}
      >
        <span class="far fa-fw fa-heart"></span>
      </a>
    `
  }

  renderReactions () {
    if (!this.comment.reactions || !Object.keys(this.comment.reactions).length) {
      return ''
    }
    return html`
      ${repeat(Object.entries(this.comment.reactions), ([reaction, userIds]) => {
        const colors = this.haveIReacted(reaction) ? 'bg-blue-50 hov:hover:bg-blue-100 text-blue-600' : 'bg-gray-50 text-gray-600 hov:hover:bg-gray-100'
        return html`
          <a
            class="inline-block mr-1 px-1.5 py-0.5 mt-1 text-sm rounded cursor-pointer ${colors}"
            @click=${e => this.onClickReaction(e, reaction)}
          >
            ${unsafeHTML(emojify(makeSafe(reaction)))}
            <sup class="font-medium">${userIds.length}</sup>
          </a>
        `
      })}
    `
  }

  renderActionsSummary () {
    const reactionsCount = this.comment.reactions ? Object.values(this.comment.reactions).reduce((acc, v) => acc + v.length, 0) : 0
    let reactionsCls = `inline-block ml-1 text-sm text-gray-500 ${reactionsCount ? 'cursor-pointer hov:hover:underline' : ''}`
    return html`
      <a class=${reactionsCls} @click=${reactionsCount ? this.onClickViewReactions : undefined}>
        ${reactionsCount} ${pluralize(reactionsCount, 'reaction')}
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

  onToggleReaction (e) {
    this.onClickReaction(e, e.detail.reaction)
  }

  async onClickReaction (e, reaction) {
    e.preventDefault()
    e.stopPropagation()

    if (this.haveIReacted(reaction)) {
      this.comment.reactions[reaction] = this.comment.reactions[reaction].filter(dbKey => dbKey !== session.info.dbKey)
      this.requestUpdate()
      await session.api.user.table('ctzn.network/reaction').delete(`${reaction}:${this.comment.dbUrl}`)
    } else {
      this.comment.reactions[reaction] = (this.comment.reactions[reaction] || []).concat([session.info.dbKey])
      this.requestUpdate()
      await session.api.user.table('ctzn.network/reaction').create({
        subject: {dbUrl: this.comment.dbUrl, authorId: this.comment.author.dbKey},
        reaction
      })
    }
    this.reloadSignals()
  }

  async onClickReactBtn (e) {
    e.preventDefault()
    e.stopPropagation()
    const rect = e.currentTarget.getClientRects()[0]
    const parentRect = this.getClientRects()[0]
    this.isReactionsOpen = true
    await reactMenu.create({
      parent: this,
      x: rect.left - parentRect.left,
      y: 0,
      reactions: this.comment.reactions,
      onToggleReaction: e => this.onToggleReaction(e)
    })
    this.isReactionsOpen = false
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

  onClickViewReactions (e) {
    ReactionsListPopup.create({
      reactions: this.comment.reactions
    })
  }
}

customElements.define('app-comment-view', CommentView)
