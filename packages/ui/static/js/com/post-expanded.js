import { LitElement, html } from '../../vendor/lit/lit.min.js'
import { unsafeHTML } from '../../vendor/lit/directives/unsafe-html.js'
import { repeat } from '../../vendor/lit/directives/repeat.js'
import { ifDefined } from '../../vendor/lit/directives/if-defined.js'
import { AVATAR_URL, POST_URL, ITEM_CLASS_ICON_URL, BLOB_URL, SUGGESTED_REACTIONS } from '../lib/const.js'
import * as session from '../lib/session.js'
import { TransferItemRelatedPopup } from './popups/transfer-item-related.js'
import { makeSafe, linkify, pluralize } from '../lib/strings.js'
import { emojify } from '../lib/emojify.js'
import { ReactionsListPopup } from './popups/reactions-list.js'
import { RelatedItemTransfersListPopup } from './popups/related-item-transfers-list.js'
import * as displayNames from '../lib/display-names.js'

export class PostExpanded extends LitElement {
  static get properties () {
    return {
      post: {type: Object},
      context: {type: String},
      searchTerms: {type: String, attribute: 'search-terms'},
      asReplyParent: {type: Boolean, attribute: 'as-reply-parent'},
      asReplyChild: {type: Boolean, attribute: 'as-reply-child'},
      nometa: {type: Boolean},
      nocommunity: {type: Boolean},
      noctrls: {type: Boolean},
      hoverBgColor: {type: String, attribute: 'hover-bg-color'},
      viewContentOnClick: {type: Boolean, attribute: 'view-content-on-click'},
      isReactionsOpen: {type: Boolean}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.post = undefined
    this.context = undefined
    this.searchTerms = undefined
    this.nometa = false
    this.nocommunity = false
    this.noctrls = false
    this.hoverBgColor = 'gray-50'
    this.isReactionsOpen = false
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
    if (this.communityUserId) {
      return session.isInCommunity(this.communityUserId)
    }
    return session.isFollowingMe(this.post.author.userId)
  }

  get ctrlTooltip () {
    if (this.canInteract) return undefined
    if (this.communityUserId) {
      return `Only members of ${this.communityUserId} can interact with this post`
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
        <div class="px-4 py-2 min-w-0 bg-gray-50">
          <div class="font-semibold text-gray-600">
            <span class="fas fa-fw fa-exclamation-circle"></span>
            Failed to load post
          </div>
          ${this.post.message ? html`
            <div class="text-gray-500 text-sm">
              ${this.post.message}
            </div>
          ` : ''}
        </div>
      `
    }

    return html`
      <div class="flex items-center pt-2 px-3 sm:pt-3 sm:px-4">
        <a class="inline-block w-10 h-10 mr-2" href="/${this.post.author.userId}" title=${this.post.author.displayName}>
          <img
            class="inline-block w-10 h-10 object-cover rounded"
            src=${AVATAR_URL(this.post.author.userId)}
          >
        </a>
        <div class="flex-1">
          <div>
            <a class="hov:hover:underline" href="/${this.post.author.userId}" title=${this.post.author.displayName}>
              <span class="text-black font-bold">${displayNames.render(this.post.author.userId)}</span>
            </a>
          </div>
          <div class="text-sm">
            <a class="text-gray-600 hov:hover:underline" href="${POST_URL(this.post)}" data-tooltip=${(new Date(this.post.value.createdAt)).toLocaleString()}>
              ${relativeDate(this.post.value.createdAt)}
            </a>
            ${this.post.value.community ? html`
              <span class="text-gray-700">
                in
                <a href="/${this.communityUserId}" class="whitespace-nowrap font-semibold hov:hover:underline">
                  ${displayNames.render(this.communityUserId)}
                </a>
              </span>
            ` : ''}
          </div>
        </div>
      </div>
      <div class="px-3 py-3 sm:px-4 sm:py-4 min-w-0">
        <div class="whitespace-pre-wrap break-words text-lg leading-tight font-medium text-black mb-1.5">${this.renderPostText()}</div>
        ${this.post.value.extendedText ? html`
          <div class="whitespace-pre-wrap break-words leading-snug text-gray-800 my-2">${this.renderPostExtendedText()}</div>
        ` : ''}
        ${this.renderMedia()}
        ${this.noctrls ? '' : html`
          ${this.hasReactionsOrGifts ? html`
            <div class="my-1.5">
              ${this.renderGiftedItems()}
              ${this.renderReactions()}
            </div>
          ` : ''}
          <div class="flex items-center justify-around text-sm text-gray-600 px-1 pt-1 pr-8 sm:pr-80">
            ${this.renderRepliesCtrl()}
            ${this.renderReactionsBtn()}
            ${this.renderGiftItemBtn()}
            ${this.renderActionsSummary()}
          </div>
          ${this.renderReactionsCtrl()}
        `}
      </div>
    `
  }

  renderMedia () {
    if (!this.post.value.media?.length) {
      return ''
    }
    const media = this.post.value.media
    const img = (item) => html`
      <a href=${BLOB_URL(this.post.author.userId, (item.blobs.original || item.blobs.thumb).blobName)} target="_blank">
        <img
          class="box-border object-cover w-full h-full ${item.caption ? 'rounded-t' : 'mb-1 rounded'}"
          src=${BLOB_URL(this.post.author.userId, (item.blobs.thumb || item.blobs.original).blobName)}
          alt=${item.caption || 'Image'}
        >
        ${item.caption ? html`
          <div class="bg-gray-100 px-3 py-1 rounded-b mb-1">${item.caption}</div>
        ` : ''}
      </a>
    `
    return html`
      <div class="mt-1 mb-2">
        ${repeat(media, item => img(item))}
      </div>
    `
  }

  renderRepliesCtrl () {
    let aCls = `inline-block mr-6 tooltip-right`
    if (this.canInteract) {
      aCls += ` text-gray-500`
    } else {
      aCls += ` text-gray-400`
    }
    return html`
      <a class=${aCls} @click=${this.onViewThread} data-tooltip=${ifDefined(this.ctrlTooltip)}>
        <span class="far fa-comment"></span>
        ${this.replyCount}
      </a>
    `
  }

  renderReactionsBtn () {
    let aCls = `inline-block ml-1 mr-6 rounded`
    if (this.canInteract) {
      aCls += ` text-gray-500 cursor-pointer hov:hover:bg-gray-200`
    } else {
      aCls += ` text-gray-400`
    }
    return html`
      <a
        class=${aCls}
        @click=${this.canInteract ? e => {this.isReactionsOpen = !this.isReactionsOpen} : undefined}
        data-tooltip=${ifDefined(this.ctrlTooltip)}
      >
        <span class="fas fa-fw fa-${this.isReactionsOpen ? 'minus' : 'plus'}"></span>
      </a>
    `
  }

  renderGiftItemBtn () {
    let aCls = `inline-block ml-1 mr-6 px-1 rounded`
    if (this.communityUserId && this.canInteract && !this.isMyPost) {
      return html`
        <a class="${aCls} text-gray-500 cursor-pointer hov:hover:bg-gray-200" @click=${this.onClickGiftItem}>
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

  renderReactionsCtrl () {
    if (!this.isReactionsOpen) {
      return ''
    }
    return html`
      <app-reaction-input
        .reactions=${this.post.reactions}
        @toggle-reaction=${this.onToggleReaction}
      ></app-reaction-input>
    `
  }

  renderReactions () {
    if (!this.post.reactions || !Object.keys(this.post.reactions).length) {
      return ''
    }
    return html`
      ${repeat(Object.entries(this.post.reactions), ([reaction, userIds]) => {
        const colors = this.haveIReacted(reaction) ? 'bg-blue-50 hov:hover:bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500 hov:hover:bg-gray-200'
        return html`
          <a
            class="inline-block mt-1 mr-1 px-1.5 py-0.5 rounded text-sm cursor-pointer ${colors}"
            @click=${e => this.onClickReaction(e, reaction)}
          >
            ${unsafeHTML(emojify(makeSafe(reaction)))}
            <sup class="font-medium">${userIds.length}</sup>
          </a>
        `
      })}
    `
  }

  renderGiftedItems () {
    if (!this.post.relatedItemTransfers?.length) {
      return ''
    }
    return html`
      ${repeat(this.post.relatedItemTransfers, item => html`
        <span
          class="inline-block border border-gray-300 px-1 py-0.5 rounded mt-1 text-sm font-semibold"
        >
          <img
            class="inline relative w-4 h-4 object-cover mr-1"
            src=${ITEM_CLASS_ICON_URL(this.communityUserId, item.itemClassId)}
            style="top: -1px"
          >
          ${item.qty}
        </span>
      `)}
    `
  }

  renderPostText () {
    return unsafeHTML(emojify(linkify(makeSafe(this.post.value.text))))
  }

  renderPostExtendedText () {
    return unsafeHTML(emojify(linkify(makeSafe(this.post.value.extendedText))))
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

  onToggleReaction (e) {
    this.onClickReaction(e, e.detail.reaction)
  }

  async onClickReaction (e, reaction) {
    e.preventDefault()
    e.stopPropagation()

    this.isReactionsOpen = false
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

  async onClickCustomReaction (e) {
    e.preventDefault()
    e.stopPropagation()

    let reaction
    do {
      reaction = prompt('Type your reaction')
      if (!reaction) return
      reaction = reaction.toLowerCase()
      if (reaction.length < 16) break
      alert('Sorry, reactions can be no longer than 16 characters.')
    } while (true)

    if (this.haveIReacted(reaction)) {
      return
    }
    this.isReactionsOpen = false
    await session.ctzn.user.table('ctzn.network/reaction').create({
      subject: {dbUrl: this.post.url, authorId: this.post.author.userId},
      reaction
    })
    this.post.reactions[reaction] = (this.post.reactions[reaction] || []).concat([session.info.userId])
    this.requestUpdate()
    this.reloadSignals()
  }

  async onClickGiftItem () {
    await TransferItemRelatedPopup.create({
      communityId: this.communityUserId,
      subject: this.post
    })
    this.reloadSignals()
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
}

customElements.define('app-post-expanded', PostExpanded)

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