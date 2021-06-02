import { LitElement, html } from '../../../vendor/lit/lit.min.js'
import { unsafeHTML } from '../../../vendor/lit/directives/unsafe-html.js'
import { repeat } from '../../../vendor/lit/directives/repeat.js'
import { USER_URL, POST_URL, FULL_POST_URL, AVATAR_URL, BLOB_URL } from '../../lib/const.js'
import * as session from '../../lib/session.js'
import { ReactionsListPopup } from '../popups/reactions-list.js'
import { ViewMediaPopup } from '../popups/view-media.js'
import { emit } from '../../lib/dom.js'
import { makeSafe, linkify, pluralize, parseSrcAttr } from '../../lib/strings.js'
import { relativeDate } from '../../lib/time.js'
import { emojify } from '../../lib/emojify.js'
import { writeToClipboard } from '../../lib/clipboard.js'
import * as displayNames from '../../lib/display-names.js'
import * as userIds from '../../lib/user-ids.js'
import * as contentFilters from '../../lib/content-filters.js'
import * as contextMenu from '../context-menu.js'
import * as reactMenu from '../menus/react.js'
import * as toast from '../toast.js'


export class Post extends LitElement {
  static get properties () {
    return {
      mode: {type: String}, // 'default', 'expanded', or 'content-only'
      src: {type: String},
      post: {type: Object},
      renderOpts: {type: Object},
      isReactionsOpen: {type: Boolean}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.mode = 'default'
    this.src = undefined
    this.post = undefined
    this.renderOpts = {noclick: false, preview: false}
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
    this.post = undefined
    const {dbKey, schemaId, key} = parseSrcAttr(this.src)
    this.post = await session.api.getPost(dbKey, key).catch(e => ({error: true, message: e.toString()}))
  }

  get showDefault () {
    return this.mode === 'default' || !this.mode
  }

  get showContentOnly () {
    return this.mode === 'content-only'
  }

  get showExpanded () {
    return this.mode === 'expanded'
  }

  get replyCount () {
    if (typeof this.post?.replyCount !== 'undefined') {
      return this.post.replyCount
    }
    if (typeof this.post?.replies !== 'undefined') {
      return this.post.replies.length
    }
    return 0
  }

  get isMyPost () {
    if (!session.isActive() || !this.post?.author.dbKey) {
      return false
    }
    return session.info?.dbKey === this.post?.author.dbKey
  }

  haveIReacted (reaction) {
    if (!session.isActive()) return
    return this.post.reactions?.[reaction]?.includes(session.info.dbKey)
  }

  getMyReactions () {
    if (!session.isActive()) return []
    if (!this.post.reactions) return []
    return Object.keys(this.post.reactions).filter(reaction => {
      return this.post.reactions[reaction].includes(session.info.dbKey)
    })
  }

  get hasReactions () {
    return (this.post.reactions && Object.keys(this.post.reactions).length > 0)
  }

  async reloadSignals () {
    this.post.reactions = (await session.api.view.get('ctzn.network/views/reactions-to', {dbUrl: this.post.dbUrl}))?.reactions
    this.requestUpdate()
  }

  // rendering
  // =

  render () {
    if (!this.post) {
      return html``
    }

    if (this.post.error) {
      return html`
        <div class="flex items-center">
          <div class="pl-4 py-2">
            <span class="fas fa-fw fa-exclamation-circle"></span>
          </div>
          <div class="px-4 py-2 min-w-0">
            <div class="">
              Failed to load post
            </div>
            ${this.post.message ? html`
              <div class="">
                ${this.post.message}
              </div>
            ` : ''}
          </div>
        </div>
      `
    }

    if (this.post?.value?.warnings?.length && contentFilters.isAnyFiltered(this.post.value.warnings)) {
      return html``
    }

    if (this.showContentOnly) {
      return this.renderContentOnly()
    } else if (this.showExpanded) {
      return this.renderExpanded()
    } else {
      return this.renderDefault()
    }
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
        ${this.renderPostText()}
        ${this.renderMedia()}
      </div>
    `
  }

  renderExpanded () {
    return html`
      <div
        class="expanded-wrapper grid grid-post px-1 py-0.5 ${this.renderOpts.noclick ? '' : 'cursor-pointer'}"
        @click=${this.onClickCard}
        @mousedown=${this.onMousedownCard}
        @mouseup=${this.onMouseupCard}
        @mousemove=${this.onMousemoveCard}
      >
        <div class="pl-2 pt-2">
          <a class="block" href="${USER_URL(this.post.author.dbKey)}" title=${this.post.author.displayName}>
            <img
              class="avatar block object-cover mt-1 w-11 h-11"
              src=${AVATAR_URL(this.post.author.dbKey)}
            >
          </a>
        </div>
        <div class="block min-w-0">
          <div class="pl-2 pr-2 py-2 min-w-0">
            ${this.post.value.audience ? html`
              <div class="post-audience pr-2.5 truncate">
                <span class="fas fa-users"></span>
                <a class="hov:hover:underline" href="/p/explore/community/${encodeURIComponent(this.post.value.audience)}">
                  ${this.post.value.audience}
                </a>
              </div>
            ` : ''}
            <div class="post-metadata pr-2.5 truncate sm:mb-2">
              <span class="whitespace-nowrap">
                <a class="hov:hover:underline" href="${USER_URL(this.post.author.dbKey)}" title=${this.post.author.displayName}>
                  <span class="display-name">${displayNames.render(this.post.author.dbKey)}</span>
                </a>
              </span>
              <span class="whitespace-nowrap">
                <a class="hov:hover:underline" href="${USER_URL(this.post.author.dbKey)}" title=${this.post.author.displayName}>
                  <span class="userid">@${userIds.render(this.post.author.dbKey)}</span>
                </a>
              </span>
              <span>&middot;</span>
              <span class="post-date">
                <a class="hov:hover:underline" href="${POST_URL(this.post)}" data-tooltip=${(new Date(this.post.value.createdAt)).toLocaleString()}>
                  ${relativeDate(this.post.value.createdAt)}
                </a>
              </span>
            </div>
            <div
              class="post-text whitespace-pre-wrap break-words mb-4"
              @click=${this.onClickText}
            >${unsafeHTML(linkify(emojify(makeSafe(this.post.value.text))))}</div>
            ${this.renderMedia()}
            ${this.noctrls ? '' : html`
              ${this.renderActionsSummary()}
              ${this.renderWarnings()}
              <div class="post-actions flex items-center justify-between pt-1 pl-1 pr-6 sm:pr-12">
                ${this.renderRepliesCtrl()}
                ${this.renderRepostCtrl()}
                ${this.renderReactCtrl()}
                ${this.renderMenuCtrl()}
              </div>
            `}
          </div>
        </div>
      </div>
    `
  }

  renderDefault () {
    return html`
      <div
        class="default-wrapper grid grid-post px-1 py-0.5 ${this.renderOpts.noclick ? '' : 'cursor-pointer'}"
        @click=${this.onClickCard}
        @mousedown=${this.onMousedownCard}
        @mouseup=${this.onMouseupCard}
        @mousemove=${this.onMousemoveCard}
      >
        <div class="pl-2 pt-2">
          <a class="block" href="${USER_URL(this.post.author.dbKey)}" title=${this.post.author.displayName}>
            <img
              class="avatar block object-cover mt-1 w-11 h-11"
              src=${AVATAR_URL(this.post.author.dbKey)}
            >
          </a>
        </div>
        <div class="block min-w-0">
          <div class="pr-2 py-2 ${this.post.value.audience ? 'pt-1' : ''} min-w-0">
            ${this.post.value.audience ? html`
              <div class="post-audience pl-1 pr-2.5 truncate">
                <span class="fas fa-users"></span>
                <a class="hov:hover:underline" href="/p/explore/community/${encodeURIComponent(this.post.value.audience)}">
                  ${this.post.value.audience}
                </a>
              </div>
            ` : ''}
            <div class="post-metadata pl-1 pr-2.5 truncate">
              <span class="whitespace-nowrap">
                <a class="hov:hover:underline" href="${USER_URL(this.post.author.dbKey)}" title=${this.post.author.displayName}>
                  <span class="display-name">${displayNames.render(this.post.author.dbKey)}</span>
                </a>
              </span>
              <span class="whitespace-nowrap">
                <a class="hov:hover:underline" href="${USER_URL(this.post.author.dbKey)}" title=${this.post.author.displayName}>
                  <span class="userid">@${userIds.render(this.post.author.dbKey)}</span>
                </a>
              </span>
              <span>&middot;</span>
              <span class="post-date">
                <a class="hov:hover:underline" href="${POST_URL(this.post)}" data-tooltip=${(new Date(this.post.value.createdAt)).toLocaleString()}>
                  ${relativeDate(this.post.value.createdAt)}
                </a>
              </span>
            </div>
            ${this.renderPostText()}
            ${this.renderMedia()}
            ${this.hasReactions ? html`
              <div class="reactions flex items-center my-1.5 mx-0.5 truncate">
                ${this.renderReactions()}
              </div>
            ` : ''}
            <div class="post-actions flex mt-1.5 items-center justify-between sm:pl-2 pr-6 sm:pr-16">
              ${this.renderRepliesCtrl()}
              ${this.renderRepostCtrl()}
              ${this.renderReactCtrl()}
              ${this.renderMenuCtrl()}
            </div>
          </div>
        </div>
      </div>
    `
  }

  renderMediaItem (n, item, size) {
    if (this.post.value.warnings.includes('NSFW')) {
      return html`
        <div
          class="relative item-wrapper img-sizing-${size} img-placeholder nsfw cursor-pointer"
          @click=${this.renderOpts?.preview ? undefined : e => this.onClickImage(e, n, item)}
        >
          <span
            class="more-images absolute inline-block px-2 py-0.5"
            style="left: 50%; top: 50%; transform: translate(-50%, -50%)"
          >NSFW</span>
        </div>
      `
    } else if (item.type === 'video') {
      let thumbUrl = ''
      if (item.blobs?.thumb?.dataUrl) {
        thumbUrl = item.blobs.thumb.dataUrl
      } else {
        thumbUrl = BLOB_URL(this.post.author.dbKey, 'ctzn.network/post', this.post.key, `media${n + 1}Thumb`)
      }
      let videoUrl = ''
      if (item.blobs?.original?.objectUrl) {
        videoUrl = item.blobs.original.objectUrl
      } else {
        videoUrl = BLOB_URL(this.post.author.dbKey, 'ctzn.network/post', this.post.key, `media${n + 1}`)
      }
      return html`
        <div
          class="item-wrapper img-sizing-${size} img-placeholder cursor-pointer"
          @click=${this.renderOpts?.preview ? undefined : e => this.onClickImage(e, n, item)}
        >
          <video
            class="item box-border object-cover w-full img-sizing-${size}"
            playsinline
            autoplay
            loop
            muted
            poster=${thumbUrl}
            src=${videoUrl}
            alt=${item.caption || 'Video'}
          >
        </div>
      `
    } else if (item.type === 'image') {
      let url = ''
      if (item.blobs?.original?.dataUrl) {
        url = item.blobs.original.dataUrl
      } else {
        url = BLOB_URL(this.post.author.dbKey, 'ctzn.network/post', this.post.key, `media${n + 1}Thumb`)
      }
      return html`
        <div
          class="item-wrapper img-sizing-${size} img-placeholder cursor-pointer"
          @click=${this.renderOpts?.preview ? undefined : e => this.onClickImage(e, n, item)}
        >
          <img
            class="item box-border object-cover w-full img-sizing-${size}"
            src="${url}"
            alt=${item.caption || 'Image'}
          >
        </div>
      `
    }
  }

  renderMedia () {
    const media = this.post.value.media
    if (!media?.length) {
      return ''
    }
    if (media.length > 4 && this.mode === 'expanded') {
      return html`
        <div class="post-media grid grid-post-images mt-1 mb-2">
          ${repeat(media, (item, i) => html`
            ${this.renderMediaItem(i, item, 'full')}
          `)}
        </div>
      `
    }
    const moreImages = media.length - 4
    return html`
      <div class="post-media flex mt-1 mb-2 ${this.showDefault ? 'sm:px-1' : ''}">
        ${media.length >= 4 ? html`
          <div class="flex-1 flex flex-col pr-0.5">
            <div class="flex-1 pb-0.5">${this.renderMediaItem(0, media[0], 'small')}</div>
            <div class="flex-1 pt-0.5">${this.renderMediaItem(2, media[2], 'small')}</div>
          </div>
          <div class="flex-1 flex flex-col pl-0.5">
            <div class="flex-1 pb-0.5">${this.renderMediaItem(1, media[1], 'small')}</div>
            <div class="flex-1 pt-0.5 relative">
              ${moreImages > 0 ? html`
                <span
                  class="more-images absolute inline-block px-2 py-0.5"
                  style="left: 50%; top: 50%; transform: translate(-50%, -50%)"
                >+${moreImages}</span>
              ` : ''}
              ${this.renderMediaItem(3, media[3], 'small')}
            </div>
          </div>
        ` : media.length === 3 ? html`
          <div class="flex-1 pr-0.5">${this.renderMediaItem(0, media[0], 'big')}</div>
          <div class="flex-1 flex flex-col pl-0.5">
            <div class="flex-1 pb-0.5">${this.renderMediaItem(1, media[1], 'smaller')}</div>
            <div class="flex-1 pt-0.5">${this.renderMediaItem(2, media[2], 'small')}</div>
          </div>
        ` : media.length === 2 ? html`
          <div class="flex-1 pr-0.5">${this.renderMediaItem(0, media[0], 'medium')}</div>
          <div class="flex-1 pl-0.5">${this.renderMediaItem(1, media[1], 'medium')}</div>
        ` : html`
          <div class="flex-1">${this.renderMediaItem(0, media[0], 'free')}</div>
        `}
      </div>
    `
  }

  renderWarnings () {
    if (!this.post.value.warnings?.length) {
      return ''
    }
    return html`
      <div class="warnings mb-3 py-2 px-2">
        <span class="fas fa-fw fa-info-circle"></span>
        ${this.post.value.warnings.join(', ')}
      </div>
    `
  }
  
  renderActionsSummary () {
    const reactionsCount = this.post.reactions ? Object.values(this.post.reactions).reduce((acc, v) => acc + v.length, 0) : 0
    if (reactionsCount === 0) return ''
    return html`
      <div class="actions-summary mb-3 py-3 px-2">
        <a class="inline-block mr-2 cursor-pointer hov:hover:underline" @click=${this.onClickViewReactions}>
          ${reactionsCount} ${pluralize(reactionsCount, 'reaction')}
        </a>
        ${this.renderReactions()}
      </div>
    `
  }

  renderRepliesCtrl () {
    return html`
      <span class="post-action reply">
        <span class="far fa-comment"></span>
        <span class="count">${this.replyCount}</span>
      </span>
    `
  }

  renderRepostCtrl () {
    return html`
      <div class="post-action">
        <a class="px-1">
          <span class="fas fa-retweet"></span>
          <span class="count">0</span>
        </a>
      </div>
    `
  }

  renderReactCtrl () {
    let aCls = `post-action react`
    if (this.isReactionsOpen) aCls += ' is-open'
    return html`
      <a class=${aCls} @click=${this.onClickReactBtn}>
        <span class="far fa-fw fa-grin-tears"></span>
      </a>
    `
  }

  renderShareCtrl () {
    return html`
      <div class="post-action">
        <a class="px-1" @click=${this.onClickShareMenu}>
          <span class="far fa-fw fa-share-square"></span>
        </a>
      </div>
    `
  }

  renderMenuCtrl () {
    return html`
      <div class="post-action">
        <a class="px-1" @click=${this.onClickMenu}>
          <span class="fas fa-fw fa-ellipsis-h"></span>
        </a>
      </div>
    `
  }

  renderReactions () {
    if (!this.post.reactions || !Object.keys(this.post.reactions).length) {
      return ''
    }
    return html`
      ${repeat(Object.entries(this.post.reactions), ([reaction, dbKeys]) => {
        const state = this.haveIReacted(reaction) ? 'is-selected' : ''
        return html`
          <a
            class="reaction ${state} inline-block mr-2 px-1.5 py-0.5 flex-shrink-0"
            @click=${e => this.onClickReaction(e, reaction)}
          >${unsafeHTML(emojify(makeSafe(reaction)))} <sup>${dbKeys.length}</sup></a>
        `
      })}
    `
  }

  renderPostText () {
    const {text} = this.post.value
    if (!text?.trim()) {
      return ''
    }
    return html`
      <div
        class="post-text whitespace-pre-wrap break-words ${this.showContentOnly ? '' : 'mt-1 mb-2 ml-1 mr-2.5'}"
        @click=${this.onClickText}
      >${unsafeHTML(linkify(emojify(makeSafe(this.post.value.text))))}</div>
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
      if (el.tagName === 'A' || el.tagName === 'IMG' || el.tagName === 'APP-COMPOSER') {
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
      if (el.tagName === 'A' || el.tagName === 'IMG' || el.tagName === 'APP-COMPOSER') {
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
      emit(this, 'view-thread', {detail: {subject: {dbUrl: this.post.dbUrl, authorId: this.post.author.dbKey}}})
    }
    this.isMouseDown = false
    this.isMouseDragging = false
  }

  onToggleReaction (e) {
    this.onClickReaction(e, e.detail.reaction)
  }

  async onClickReaction (e, reaction) {
    e.preventDefault()
    e.stopPropagation()

    if (this.haveIReacted(reaction)) {
      this.post.reactions[reaction] = this.post.reactions[reaction].filter(dbKey => dbKey !== session.info.dbKey)
      this.requestUpdate()
      await session.api.user.table('ctzn.network/reaction').delete(`${reaction}:${this.post.dbUrl}`)
    } else {
      this.post.reactions[reaction] = (this.post.reactions[reaction] || []).concat([session.info.dbKey])
      this.requestUpdate()
      await session.api.user.table('ctzn.network/reaction').create({
        subject: {dbUrl: this.post.dbUrl},
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
      reactions: this.post.reactions,
      onToggleReaction: e => this.onToggleReaction(e)
    })
    this.isReactionsOpen = false
  }

  onClickShareMenu (e) {
    e.preventDefault()
    e.stopPropagation()
    const rect = e.currentTarget.getClientRects()[0]
    const parentRect = this.getClientRects()[0]
    let items = [
      {
        icon: 'fas fa-fw fa-link',
        label: 'Copy link',
        click: () => {
          writeToClipboard(FULL_POST_URL(this.post))
          toast.create('Copied to clipboard')
        }
      }
    ]
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
          writeToClipboard(FULL_POST_URL(this.post))
          toast.create('Copied to clipboard')
        }
      },
      '-',
      {
        icon: 'fas fa-fw fa-arrow-down',
        label: 'Downvote',
        click: () => {
          alert('todo')
        }
      }
    ]
    if (this.isMyPost) {
      items.push({
        icon: 'fas fa-fw fa-trash',
        label: 'Delete post',
        click: () => {
          if (!confirm('Are you sure you want to delete this post?')) {
            return
          }
          emit(this, 'delete-post', {detail: {post: this.post}})
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
      reactions: this.post.reactions
    })
  }

  onClickImage (e, n, item) {
    e.preventDefault()
    e.stopPropagation()
    ViewMediaPopup.create({
      item: {
        type: item.type,
        url: BLOB_URL(this.post.author.dbKey, 'ctzn.network/post', this.post.key, `media${n + 1}`)
      },
      items: this.post.value.media.map((item2, n) => ({
        type: item2.type,
        url: BLOB_URL(this.post.author.dbKey, 'ctzn.network/post', this.post.key, `media${n + 1}`)
      }))
    })
  }
}

customElements.define('app-post', Post)
