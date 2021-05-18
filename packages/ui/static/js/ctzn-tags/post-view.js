import { LitElement, html } from '../../vendor/lit/lit.min.js'
import { unsafeHTML } from '../../vendor/lit/directives/unsafe-html.js'
import { repeat } from '../../vendor/lit/directives/repeat.js'
import { POST_URL, ITEM_CLASS_ICON_URL, FULL_POST_URL, AVATAR_URL, BLOB_URL } from '../lib/const.js'
import * as session from '../lib/session.js'
import { TransferItemRelatedPopup } from '../com/popups/transfer-item-related.js'
import { ReactionsListPopup } from '../com/popups/reactions-list.js'
import { RelatedItemTransfersListPopup } from '../com/popups/related-item-transfers-list.js'
import { ViewMediaPopup } from '../com/popups/view-media.js'
import { emit } from '../lib/dom.js'
import { makeSafe, linkify, pluralize, parseSrcAttr } from '../lib/strings.js'
import { relativeDate } from '../lib/time.js'
import { emojify } from '../lib/emojify.js'
import { writeToClipboard } from '../lib/clipboard.js'
import * as displayNames from '../lib/display-names.js'
import * as contextMenu from '../com/context-menu.js'
import * as reactMenu from '../com/menus/react.js'
import * as toast from '../com/toast.js'

export class PostView extends LitElement {
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
    this.setAttribute('ctzn-elem', '1')
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
    const {userId, schemaId, key} = parseSrcAttr(this.src)
    this.post = await session.ctzn.getPost(userId, key).catch(e => ({error: true, message: e.toString()}))
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

  get communityUserId () {
    return this.post?.value?.community?.userId
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
    if (!session.isActive() || !this.post?.author.userId) {
      return false
    }
    return session.info?.userId === this.post?.author.userId
  }

  get canInteract () {
    if (this.renderOpts?.preview) {
      return false
    }
    if (this.communityUserId) {
      return session.isInCommunity(this.communityUserId)
    }
    return session.isFollowingMe(this.post.author.userId)
  }

  get ctrlTooltip () {
    if (this.canInteract) return undefined
    if (this.communityUserId) {
      return `Only members of ${displayNames.render(this.communityUserId)} can interact with this post`
    }
    return `Only people followed by ${this.post.author.displayName} can interact with this post`
  }

  haveIReacted (reaction) {
    if (!session.isActive()) return
    return this.post.reactions?.[reaction]?.includes(session.info.userId)
  }

  getMyReactions () {
    if (!session.isActive()) return []
    if (!this.post.reactions) return []
    return Object.keys(this.post.reactions).filter(reaction => {
      return this.post.reactions[reaction].includes(session.info.userId)
    })
  }

  get hasReactionsOrGifts () {
    return (
      this.post.relatedItemTransfers?.length > 0
      || (this.post.reactions && Object.keys(this.post.reactions).length > 0)
    )
  }

  async reloadSignals () {
    this.post.reactions = (await session.ctzn.view('ctzn.network/reactions-to-view', this.post.url))?.reactions
    if (this.communityUserId) {
      this.post.relatedItemTransfers = (
        await session.ctzn.db(`server@${this.communityUserId.split('@')[1]}`)
          .table('ctzn.network/item-tfx-relation-idx')
          .get(this.post.url)
      )?.value.transfers
    }
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
        <div class="flex items-center bg-gray-50 sm:rounded">
          <div class="text-xl pl-4 py-2 text-gray-500">
            <span class="fas fa-fw fa-exclamation-circle"></span>
          </div>
          <div class="px-4 py-2 min-w-0">
            <div class="font-semibold text-gray-600">
              Failed to load post
            </div>
            ${this.post.message ? html`
              <div class="text-gray-500 text-sm">
                ${this.post.message}
              </div>
            ` : ''}
          </div>
        </div>
      `
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
        ${this.renderPostTextNonFull()}
        ${this.renderMedia()}
      </div>
    `
  }

  renderExpanded () {
    return html`
      <div
        class="grid grid-post px-1 py-0.5 bg-white sm:rounded ${this.renderOpts.noclick ? '' : 'cursor-pointer'} text-gray-600"
        @click=${this.onClickCard}
        @mousedown=${this.onMousedownCard}
        @mouseup=${this.onMouseupCard}
        @mousemove=${this.onMousemoveCard}
      >
        <div class="pl-2 pt-2">
          <a class="block" href="/${this.post.author.userId}" title=${this.post.author.displayName}>
            <img
              class="block object-cover rounded-full mt-1 w-11 h-11"
              src=${AVATAR_URL(this.post.author.userId)}
            >
          </a>
        </div>
        <div class="block bg-white min-w-0">
          <div class="pl-2 pr-2 py-2 min-w-0">
            <div class="pr-2.5 text-gray-600 truncate sm:mb-2">
              <span class="sm:mr-1 whitespace-nowrap">
                <a class="hov:hover:underline" href="/${this.post.author.userId}" title=${this.post.author.displayName}>
                  <span class="text-gray-800 font-semibold">${displayNames.render(this.post.author.userId)}</span>
                </a>
              </span>
              <span class="mr-2 text-sm">
                <a class="hov:hover:underline" href="${POST_URL(this.post)}" data-tooltip=${(new Date(this.post.value.createdAt)).toLocaleString()}>
                  ${relativeDate(this.post.value.createdAt)}
                </a>
                ${this.post.value.community ? html`
                  in
                  <a href="/${this.communityUserId}" class="whitespace-nowrap font-semibold text-gray-700 hov:hover:underline">
                    ${displayNames.render(this.communityUserId)}
                  </a>
                ` : ''}
              </span>
            </div>
            <div
              class="whitespace-pre-wrap break-words text-black mb-4"
              @click=${this.onClickText}
            >${unsafeHTML(linkify(emojify(makeSafe(this.post.value.text))))}</div>
            ${this.renderMedia()}
            ${this.renderPostExtendedText()}
            ${this.noctrls ? '' : html`
              ${this.hasReactionsOrGifts ? html`
                <div class="my-1.5">
                  ${this.renderGiftedItems()}
                  ${this.renderReactions()}
                </div>
              ` : ''}
              <div class="flex items-center justify-around text-sm text-gray-600 px-1 pt-1 pr-8 sm:pr-60">
                ${this.renderRepliesCtrl()}
                ${this.renderReactionsBtn()}
                ${this.renderGiftItemBtn()}
                ${this.renderActionsSummary()}
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
        class="grid grid-post px-1 py-0.5 bg-white sm:rounded ${this.renderOpts.noclick ? '' : 'cursor-pointer'} text-gray-600"
        @click=${this.onClickCard}
        @mousedown=${this.onMousedownCard}
        @mouseup=${this.onMouseupCard}
        @mousemove=${this.onMousemoveCard}
      >
        <div class="pl-2 pt-2">
          <a class="block" href="/${this.post.author.userId}" title=${this.post.author.displayName}>
            <img
              class="block object-cover rounded-full mt-1 w-11 h-11"
              src=${AVATAR_URL(this.post.author.userId)}
            >
          </a>
        </div>
        <div class="block bg-white min-w-0">
          <div class="pr-2 py-2 min-w-0">
            <div class="pl-1 pr-2.5 text-sm text-gray-600 truncate">
              <span class="sm:mr-1 whitespace-nowrap">
                <a class="hov:hover:underline" href="/${this.post.author.userId}" title=${this.post.author.displayName}>
                  <span class="text-black font-bold" style="font-size: 15px; letter-spacing: 0.1px;">${displayNames.render(this.post.author.userId)}</span>
                </a>
              </span>
              <span class="mr-2">
                <a class="hov:hover:underline" href="${POST_URL(this.post)}" data-tooltip=${(new Date(this.post.value.createdAt)).toLocaleString()}>
                  ${relativeDate(this.post.value.createdAt)}
                </a>
                ${this.post.value.community ? html`
                  in
                  <a href="/${this.communityUserId}" class="whitespace-nowrap font-semibold text-gray-700 hov:hover:underline">
                    ${displayNames.render(this.communityUserId)}
                  </a>
                ` : ''}
              </span>
            </div>
            ${this.renderPostTextNonFull()}
            ${this.renderMedia()}
            ${this.hasReactionsOrGifts ? html`
              <div class="flex items-center my-1.5 mx-0.5 text-gray-500 text-sm truncate">
                ${this.renderGiftedItems()}
                ${this.renderReactions()}
              </div>
            ` : ''}
            <div class="flex pl-1 mt-1.5 text-gray-500 text-sm items-center justify-between pr-12 sm:w-72">
              ${this.renderRepliesCtrl()}
              ${this.renderReactionsBtn()}
              ${this.renderGiftItemBtn()}
              <div>
                <a class="hov:hover:bg-gray-200 px-1 rounded" @click=${this.onClickMenu}>
                  <span class="fas fa-fw fa-ellipsis-h"></span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    `
  }

  renderImg (item, size) {
    let url = ''
    if (item.blobs.original.dataUrl) {
      url = item.blobs.original.dataUrl
    } else {
      url = BLOB_URL(this.post.author.userId, (item.blobs.thumb || item.blobs.original).blobName)
    }
    return html`
      <div
        class="bg-gray-100 rounded img-sizing-${size} img-placeholder cursor-pointer"
        @click=${this.renderOpts?.preview ? undefined : e => this.onClickImage(e, item)}
      >
        <img
          class="box-border object-cover border border-gray-200 rounded w-full img-sizing-${size}"
          src="${url}"
          alt=${item.caption || 'Image'}
        >
      </div>
    `
  }

  renderMedia () {
    const media = this.post.value.media
    if (!media?.length) {
      return ''
    }
    if (media.length > 4 && this.mode === 'expanded') {
      return html`
        <div class="grid grid-post-images mt-1 mb-2">
          ${repeat(media, item => html`
            ${this.renderImg(item, 'full')}
          `)}
        </div>
      `
    }
    const moreImages = media.length - 4
    return html`
      <div class="flex mt-1 mb-2 ${this.showDefault ? 'sm:px-1' : ''}">
        ${media.length >= 4 ? html`
          <div class="flex-1 flex flex-col pr-0.5">
            <div class="flex-1 pb-0.5">${this.renderImg(media[0], 'small')}</div>
            <div class="flex-1 pt-0.5">${this.renderImg(media[2], 'small')}</div>
          </div>
          <div class="flex-1 flex flex-col pl-0.5">
            <div class="flex-1 pb-0.5">${this.renderImg(media[1], 'small')}</div>
            <div class="flex-1 pt-0.5 relative">
              ${moreImages > 0 ? html`
                <span
                  class="absolute inline-block font-bold px-2 py-0.5 rounded sm:text-lg text-white"
                  style="left: 50%; top: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,.85);"
                >+${moreImages}</span>
              ` : ''}
              ${this.renderImg(media[3], 'small')}
            </div>
          </div>
        ` : media.length === 3 ? html`
          <div class="flex-1 pr-0.5">${this.renderImg(media[0], 'big')}</div>
          <div class="flex-1 flex flex-col pl-0.5">
            <div class="flex-1 pb-0.5">${this.renderImg(media[1], 'smaller')}</div>
            <div class="flex-1 pt-0.5">${this.renderImg(media[2], 'small')}</div>
          </div>
        ` : media.length === 2 ? html`
          <div class="flex-1 pr-0.5">${this.renderImg(media[0], 'medium')}</div>
          <div class="flex-1 pl-0.5">${this.renderImg(media[1], 'medium')}</div>
        ` : html`
          <div class="flex-1">${this.renderImg(media[0], 'free')}</div>
        `}
      </div>
    `
  }
  
  renderActionsSummary () {
    const reactionsCount = this.post.reactions ? Object.values(this.post.reactions).reduce((acc, v) => acc + v.length, 0) : 0
    const giftsCount = this.post.relatedItemTransfers?.length || 0
    let reactionsCls = `inline-block ml-1 rounded text-gray-500 ${reactionsCount ? 'cursor-pointer hov:hover:underline' : ''}`
    return html`
      <a class=${reactionsCls} @click=${reactionsCount ? this.onClickViewReactions : undefined}>
        ${reactionsCount} ${pluralize(reactionsCount, 'reaction')}${giftsCount > 0 ? ', ' : ''}
      </a>
      ${giftsCount > 0 ? html`
        <a class="inline-block rounded text-gray-500 cursor-pointer hov:hover:underline" @click=${this.onClickViewGifts}>
          ${giftsCount} ${pluralize(giftsCount, 'gift')}
        </a>
      ` : ''}
    `
  }

  renderRepliesCtrl () {
    let aCls = `inline-block ml-1 mr-6`
    if (this.canInteract) {
      aCls += ` text-gray-500`
    } else {
      aCls += ` text-gray-400`
    }
    return html`
      <span class=${aCls}>
        <span class="far fa-comment"></span>
        ${this.replyCount}
      </span>
    `
  }

  renderReactionsBtn () {
    let aCls = `inline-block px-1 ml-1 mr-6 rounded`
    if (this.canInteract) {
      aCls += ` text-gray-500 hov:hover:bg-gray-200`
    } else {
      aCls += ` text-gray-400`
    }
    if (this.isReactionsOpen) aCls += ' bg-gray-200'
    return html`
      <a class=${aCls} @click=${this.canInteract ? this.onClickReactBtn : undefined}>
        <span class="far fa-fw fa-heart"></span>
      </a>
    `
  }

  renderGiftItemBtn () {
    let aCls = `inline-block ml-1 mr-6 px-1 rounded`
    if (this.communityUserId && this.canInteract && !this.isMyPost) {
      return html`
        <a class="${aCls} text-gray-500 hov:hover:bg-gray-200" @click=${this.onClickGiftItem}>
          <span class="fas fa-fw fa-gift"></span>
        </a>
      `
    } else {
      const tooltip = this.isMyPost
        ? `Can't gift to yourself`
        : this.communityUserId
          ? `Must be a member of the community`
          : `Must be a community post`
      return html`
        <a class="${aCls} text-gray-300 tooltip-top" data-tooltip=${tooltip}>
          <span class="fas fa-fw fa-gift"></span>
        </a>
      `
    }
  }

  renderGiftedItems () {
    if (!this.post.relatedItemTransfers?.length) {
      return ''
    }
    return html`
      ${repeat(this.post.relatedItemTransfers, item => html`
        <span
          class="flex-shrink-0 inline-flex items-center border border-gray-300 px-1 py-0.5 rounded mr-1.5 text-sm font-semibold"
        >
          <img
            class="block w-4 h-4 object-cover mr-1"
            src=${ITEM_CLASS_ICON_URL(this.communityUserId, item.itemClassId)}
          >
          ${item.qty}
        </span>
      `)}
    `
  }

  renderReactions () {
    if (!this.post.reactions || !Object.keys(this.post.reactions).length) {
      return ''
    }
    return html`
      ${repeat(Object.entries(this.post.reactions), ([reaction, userIds]) => {
        const colors = this.haveIReacted(reaction) ? 'bg-blue-50 hov:hover:bg-blue-100 text-blue-600' : 'bg-gray-50 text-gray-600 hov:hover:bg-gray-100'
        return html`
          <a
            class="inline-block mr-2 px-1.5 py-0.5 rounded text-sm flex-shrink-0 ${colors}"
            @click=${e => this.onClickReaction(e, reaction)}
          >${unsafeHTML(emojify(makeSafe(reaction)))} <sup class="font-medium">${userIds.length}</sup></a>
        `
      })}
    `
  }

  renderPostTextNonFull () {
    const {text, extendedText} = this.post.value
    if (!text?.trim() && !extendedText?.trim()) {
      return ''
    }
    return html`
      <div
        class="whitespace-pre-wrap break-words text-black ${this.showContentOnly ? '' : 'mt-1 mb-2 ml-1 mr-2.5'}"
        style="font-size: 16px; line-height: 1.3;"
        @click=${this.onClickText}
      >${unsafeHTML(linkify(emojify(makeSafe(this.post.value.text))))}${this.post.value.extendedText
          ? html`<span class="bg-gray-200 ml-1 px-1 rounded text-gray-600 text-xs">more</span>`
          : ''
      }</div>
    `
  }

  renderPostExtendedText () {
    if (!this.post.value.extendedText) {
      return ''
    }
    if (this.post.value.extendedTextMimeType === 'text/html') {
      return html`
        <app-custom-html
          class="block pt-4 mt-4 mb-3 text-black border-t border-dashed border-gray-200"
          context="post"
          .contextState=${{page: {userId: this.post.author.userId}}}
          .html=${this.post.value.extendedText}
          @click=${this.onClickText}
        ></app-custom-html>
      `
    }
    return html`
      <div
        class="block pt-4 mt-4 mb-3 whitespace-pre-wrap break-words leading-snug text-black border-t border-dashed border-gray-200"
        @click=${this.onClickText}
      >${unsafeHTML(emojify(linkify(makeSafe(this.post.value.extendedText))))}</div>
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
      emit(this, 'view-thread', {detail: {subject: {dbUrl: this.post.url, authorId: this.post.author.userId}}})
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
      this.post.reactions[reaction] = this.post.reactions[reaction].filter(userId => userId !== session.info.userId)
      this.requestUpdate()
      await session.ctzn.user.table('ctzn.network/reaction').delete(`${reaction}:${this.post.url}`)
    } else {
      this.post.reactions[reaction] = (this.post.reactions[reaction] || []).concat([session.info.userId])
      this.requestUpdate()
      await session.ctzn.user.table('ctzn.network/reaction').create({
        subject: {dbUrl: this.post.url, authorId: this.post.author.userId},
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

  async onClickGiftItem () {
    await TransferItemRelatedPopup.create({
      communityId: this.communityUserId,
      subject: this.post
    })
    this.reloadSignals()
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
      }
    ]
    if (this.isMyPost) {
      items.push('-')
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
    if (this.communityUserId && session.isInCommunity(this.communityUserId)) {
      items.push(
        session.ctzn.view(
          'ctzn.network/community-user-permission-view',
          this.communityUserId,
          session.info.userId,
          'ctzn.network/perm-community-remove-post'
        ).then(perm => {
          if (perm) {
            return html`
              <div class="dropdown-item" @click=${() => this.onClickModeratorRemove()}>
                <i class="fas fa-times fa-fw"></i>
                Remove post (moderator)
              </div>
            `
          } else {
            return ''
          }
        })
      )
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

  onClickModeratorRemove () {
    if (!confirm('Are you sure you want to remove this post?')) {
      return
    }
    contextMenu.destroy()
    emit(this, 'moderator-remove-post', {detail: {post: this.post}})
  }

  onClickViewReactions (e) {
    ReactionsListPopup.create({
      reactions: this.post.reactions
    })
  }

  onClickViewGifts (e) {
    RelatedItemTransfersListPopup.create({
      communityId: this.communityUserId,
      relatedItemTransfers: this.post.relatedItemTransfers
    })
  }

  onClickImage (e, item) {
    e.preventDefault()
    e.stopPropagation()
    ViewMediaPopup.create({
      url: BLOB_URL(this.post.author.userId, (item.blobs.thumb || item.blobs.original).blobName),
      urls: this.post.value.media.map(item2 => BLOB_URL(this.post.author.userId, (item2.blobs.thumb || item2.blobs.original).blobName))
    })
  }
}

customElements.define('ctzn-post-view', PostView)
