import { LitElement, html } from '../../vendor/lit/lit.min.js'
import { repeat } from '../../vendor/lit/directives/repeat.js'
import { asyncReplace } from '../../vendor/lit/directives/async-replace.js'
import { ViewActivityPopup } from '../com/popups/view-activity.js'
import * as displayNames from '../lib/display-names.js'
import { ITEM_CLASS_ICON_URL } from '../lib/const.js'
import { relativeDate } from '../lib/time.js'
import * as session from '../lib/session.js'
import { emit } from '../lib/dom.js'
import { extractSchemaId } from '../lib/strings.js'
import './post-view.js'

const CHECK_NEW_ITEMS_INTERVAL = 30e3
const _itemCache = {}

const METHOD_COLORS = {
  'ctzn.network/create-item-method': 'green-900',
  'ctzn.network/create-item-class-method': 'green-900',
  'ctzn.network/transfer-item-method': 'blue-900',
  'ctzn.network/community-remove-member-method': 'red-900',
  'ctzn.network/community-put-ban-method': 'red-900',
  'ctzn.network/delete-item-class-method': 'red-900',
  'ctzn.network/destroy-item-method': 'red-900',
}
const METHOD_BGS = {
  'ctzn.network/create-item-method': 'green-400',
  'ctzn.network/create-item-class-method': 'green-400',
  'ctzn.network/transfer-item-method': 'blue-400',
  'ctzn.network/community-remove-member-method': 'red-400',
  'ctzn.network/community-put-ban-method': 'red-400',
  'ctzn.network/delete-item-class-method': 'red-400',
  'ctzn.network/destroy-item-method': 'red-400',
}
const METHOD_ICONS = {
  'ctzn.network/community-delete-ban-method': html`
    <span class="fas fa-user absolute" style="left: 11px; top: 3px; font-size: 13px;"></span>
    <span class="fas fa-check absolute" style="right: 6px; bottom: 0px; font-size: 11px;"></span>
  `,
  'ctzn.network/community-invite-member-method': html`
    <span class="fas fa-user absolute" style="left: 11px; top: 3px; font-size: 13px;"></span>
    <span class="fas fa-check absolute" style="right: 7px; bottom: 1px; font-size: 11px;"></span>
  `,
  'ctzn.network/community-remove-member-method': html`
    <span class="fas fa-user absolute" style="left: 11px; top: 3px; font-size: 13px;"></span>
    <span class="fas fa-ban absolute" style="right: 7px; bottom: 1px; font-size: 11px;"></span>
  `,
  'ctzn.network/community-put-ban-method': html`
    <span class="fas fa-user absolute" style="left: 11px; top: 3px; font-size: 13px;"></span>
    <span class="fas fa-ban absolute" style="right: 7px; bottom: 1px; font-size: 11px;"></span>
  `,
  'ctzn.network/community-update-config-method': html`
    <span class="fas fa-list absolute" style="left: 11px; top: 3px; font-size: 13px;"></span>
    <span class="fas fa-pen absolute" style="right: 7px; bottom: 1px; font-size: 11px;"></span>
  `,
  'ctzn.network/create-item-method': html`
    <span class="far fa-gem absolute" style="left: 9px; top: 6px; font-size: 13px;"></span>
    <span class="fas fa-plus absolute" style="right: 9px; bottom: 0px; font-size: 11px"></span>
  `,
  'ctzn.network/create-item-class-method': html`
    <span class="absolute" style="left: 8px; top: 0px; font-size: 16px;">
      {<span class="far fa-gem" style="font-size: 12px"></span>}
    </span>
  `,
  'ctzn.network/delete-item-class-method': html`
    <span class="absolute" style="left: 8px; top: 0x; font-size: 16px;">
      {<span class="far fa-gem" style="font-size: 12px"></span>}
    </span>
  `,
  'ctzn.network/destroy-item-method': html`
    <span class="far fa-gem absolute" style="left: 9px; top: 5px; font-size: 13px;"></span>
    <span class="fas fa-times absolute" style="right: 9px; bottom: 1px; font-size: 11px"></span>
  `,
  'ctzn.network/put-avatar-method': html`
    <span class="far fa-image absolute" style="left: 10px; top: 2px; font-size: 16px;"></span>
    <span class="fas fa-pen absolute" style="right: 7px; bottom: 1px; font-size: 11px;"></span>
  `,
  'ctzn.network/put-blob-method': html`
    <span class="far fa-image absolute" style="left: 10px; top: 2px; font-size: 16px;"></span>
    <span class="fas fa-pen absolute" style="right: 7px; bottom: 1px; font-size: 11px;"></span>
  `,
  'ctzn.network/put-item-class-method': html`
    <span class="absolute" style="left: 8px; top: 0px; font-size: 16px;">
      {<span class="far fa-gem" style="font-size: 12px"></span>}
    </span>
  `,
  'ctzn.network/put-profile-method': html`
    <span class="fas fa-user absolute" style="left: 11px; top: 4px; font-size: 13px;"></span>
    <span class="fas fa-pen absolute" style="right: 7px; bottom: 1px; font-size: 11px;"></span>
  `,
  'ctzn.network/transfer-item-method': html`
    <span class="far fa-gem absolute" style="left: 9px; top: 6px; font-size: 13px;"></span>
    <span class="fas fa-arrow-right absolute" style="right: 9px; bottom: 0px; font-size: 11px"></span>
  `,
  'ctzn.network/update-item-class-method': html`
    <span class="absolute" style="left: 8px; top: 0px; font-size: 16px;">
      {<span class="far fa-gem" style="font-size: 12px"></span>}
    </span>
  `,
}

export class DbmethodsFeed extends LitElement {
  static get properties () {
    return {
      userId: {type: String, attribute: 'user-id'},
      _view: {type: String, attribute: 'view'},
      _methodsFilter: {type: String, attribute: 'methods-filter'},
      limit: {type: Number},
      entries: {type: Array},
      hasNewEntries: {type: Boolean},
      isLoadingMore: {type: Boolean},
      hasReachedEnd: {type: Boolean}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.setAttribute('ctzn-elem', '1')
    this.userId = undefined
    this.view = undefined
    this._methodsFilter = undefined
    this.limit = undefined
    this.entries = undefined
    this.hasNewEntries = false
    this.isLoadingMore = false
    this.hasReachedEnd = false
    this.userProfile = undefined

    // ui state
    this.loadMoreObserver = undefined
    setInterval(() => this.checkNewItems(), CHECK_NEW_ITEMS_INTERVAL)

    // query state
    this.activeQuery = undefined
  }

  disconnectedCallback () {
    super.disconnectedCallback()
    if (this.loadMoreObserver) {
      this.loadMoreObserver.disconnect()
    }
  }

  setContextState (state) {
    if (state?.page?.userId) {
      if (!this.userId) {
        this.userId = state.page.userId
      }
    }
  }

  get view () {
    if (this._view === 'calls') return 'ctzn.network/dbmethod-calls-view'
    if (this._view === 'results') return 'ctzn.network/dbmethod-results-view'
    if (this._view === 'feed') return 'ctzn.network/dbmethod-feed-view'
    return this._view || this.getViewForUser()
  }

  set view (v) {
    this._view = v
  }

  getViewForUser () {
    if (this.userProfile?.dbType === 'ctzn.network/public-community-db') {
      return 'ctzn.network/dbmethod-results-view'
    }
    return 'ctzn.network/dbmethod-calls-view'
  }

  get methodsFilter () {
    if (this._methodsFilter) {
      return this._methodsFilter.split(',').map(str => str.trim())
    }
  }

  set methodsFilter (v) {
    this._methodsFilter = v
  }

  get isLoading () {
    return !!this.activeQuery
  }

  get hasHitLimit () {
    return this.hasReachedEnd || (this.limit > 0 && this.entries?.length >= this.limit)
  }

  async load ({clearCurrent} = {clearCurrent: false}) {
    if ((!this.userId || !this.view) && this.view !== 'ctzn.network/dbmethod-feed-view') {
      return
    }
    if (this.activeQuery) {
      return this.activeQuery
    }
    if (clearCurrent) {
      this.entries = undefined
    }
    if (this.userProfile?.userId !== this.userId) {
      this.userProfile = await session.ctzn.getProfile(this.userId)
    }
    return this.queueQuery()
  }

  updated (changedProperties) {
    if (changedProperties.has('userId') && this.userId !== changedProperties.get('userId')) {
      this.load()
    }
    if (changedProperties.has('_view') && this._view !== changedProperties.get('_view')) {
      this.load()
    }

    const botOfFeedEl = this.querySelector('.bottom-of-feed')
    if (!this.loadMoreObserver && botOfFeedEl) {
      this.loadMoreObserver = new IntersectionObserver((entries) => {
        if (entries[0]?.isIntersecting) {
          this.queueQuery({more: true})
        }
      }, {threshold: 1.0})
      this.loadMoreObserver.observe(botOfFeedEl)
    }
  }

  queueQuery ({more} = {more: false}) {
    if (!this.activeQuery) {
      this.activeQuery = this.query({more})
      this.requestUpdate()
    } else {
      if (more) return this.activeQuery
      if (this.abortController) this.abortController.abort()
      this.activeQuery = this.activeQuery.catch(e => undefined).then(r => {
        this.activeQuery = undefined
        this.queueQuery({more})
      })
    }
    return this.activeQuery
  }

  async query ({more} = {more: false}) {
    if (this.hasHitLimit) {
      return
    }

    this.isLoadingMore = more

    emit(this, 'load-state-updated')
    this.abortController = new AbortController()
    let entries = more ? (this.entries || []) : []
    let lt = more ? entries[entries?.length - 1]?.key : undefined
    
    const viewRes = (this.view === 'ctzn.network/dbmethod-feed-view')
      ? await session.ctzn.view(this.view, {limit: 25, lt})
      : await session.ctzn.viewByHomeServer(this.userId, this.view, this.userId, {limit: 25, reverse: true, lt})
    let newEntries
    if (viewRes.results) {
      newEntries = viewRes.results.map(resultToGeneric)
    } else if (viewRes.calls) {
      newEntries = viewRes.calls.map(entry => callToGeneric(this.userId, entry))
    } else if (viewRes.feed) {
      newEntries = viewRes.feed.map(feedToGeneric)
    }
    if (newEntries.length === 0) {
      this.hasReachedEnd = true
    }

    if (this.methodsFilter) {
      newEntries = newEntries.filter(entry => this.methodsFilter.includes(entry.call.method))
    }

    entries = entries.concat(newEntries)
    
    if (this.limit > 0 && entries.length > this.limit) {
      entries = entries.slice(0, this.limit)
    }

    console.log(entries)
    this.entries = entries
    this.activeQuery = undefined
    this.hasNewEntries = false
    this.isLoadingMore = false
    emit(this, 'load-state-updated', {detail: {isEmpty: this.entries.length === 0}})
  }

  async checkNewItems () {
    if (!this.entries || this.hasHitLimit) {
      return
    }
    const viewRes = (this.view === 'ctzn.network/dbmethod-feed-view')
      ? await session.ctzn.view(this.view, {limit: 1})
      : await session.ctzn.view(this.view, this.userId, {limit: 1, reverse: true})
    let entries = viewRes.calls || viewRes.results || viewRes.feed
    if (this.methodsFilter) {
      entries = entries.filter(entry => this.methodsFilter.includes(entry.call.method))
    }
    this.hasNewEntries = (entries?.[0] && entries[0].key !== this.entries[0]?.key)
  }

  async pageLoadScrollTo (y) {
    window.scrollTo(0, y)
    let first = true
    while (true) {
      if (Math.abs(window.scrollY - y) < 10) {
        break
      }

      let numResults = this.entries?.length || 0
      if (first) {
        await this.load()
        first = false
      } else {
        await this.queueQuery({more: true})
      }
      await this.requestUpdate()
      window.scrollTo(0, y)
      if (numResults === this.entries?.length || 0) {
        break
      }
    }

    setTimeout(() => {
      if (Math.abs(window.scrollY - y) > 10) {
        window.scrollTo(0, y)
      }
    }, 500)
  }

  // rendering
  // =

  render () {
    if (!this.entries) {
      return html`
        <div class="bg-gray-100 text-gray-500 py-44 text-center my-5">
          <span class="spinner"></span>
        </div>
      `
    }
    if (!this.entries.length) {
      if (!this.emptyMessage) return html``
      return html`
        ${this.renderHasNewEntries()}
        <div class="bg-gray-100 text-gray-500 py-44 text-center my-5">
          <div>${this.emptyMessage}</div>
        </div>
      `
    }
    return html`
      ${this.renderHasNewEntries()}
      ${this.renderEntries()}
      ${this.entries?.length && !this.hasHitLimit ? html`
        <div class="bottom-of-feed ${this.isLoadingMore ? 'bg-white' : ''} sm:rounded text-center">
          <span class="spinner w-6 h-6 text-gray-500"></span>
        </div>
      ` : ''}
    `
  }

  renderHasNewEntries () {
    if (!this.hasNewEntries) {
      return ''
    }
    return html`
      <div
        class="new-items-indicator bg-blue-50 border border-blue-500 cursor-pointer fixed font-semibold hov:hover:bg-blue-100 inline-block px-4 py-2 rounded-3xl shadow-md text-blue-800 text-sm z-30"
        @click=${this.onClickViewNewEntries}
      >
        New Activity <span class="fas fa-fw fa-angle-up"></span>
      </div>
    `
  }

  renderEntries () {
    this.lastResultNiceDate = undefined // used by renderDateTitle
    return html`
      ${repeat(this.entries, entry => entry.key, (entry, i) => html`
        ${this.renderEntry(entry, i)}
      `)}
    `
  }
  
  renderEntry (entry, index) {
    if (entry.result.code !== 'success') return ''
    let [domain, methodName] = entry.call.method.split('/')
    methodName = methodName.replace(/(^(.)|[\-](.))/g, (match, _, char1, char2) => (char1 || char2).toUpperCase())
    const renderMethod = this[`render${methodName}`]
    if (!renderMethod) return ''
    const hasSubject = methodName === 'TransferItemMethod' && entry.call.args.relatedTo
    return html`
      <div
        class="flex bg-white px-2 py-3 sm:py-2 sm:rounded mb-0.5 hov:hover:bg-gray-50 cursor-pointer ${index === 0 ? '' : 'border-t border-gray-300'}"
        @click=${e => this.onClickActivity(e, entry)}
      >
        <span class="block rounded bg-${METHOD_BGS[entry.call.method] || 'gray-200'} w-10 h-10 pt-1.5 mr-2">
          <span class="block relative rounded w-10 h-6 text-${METHOD_COLORS[entry.call.method] || 'gray-700'}">
            ${METHOD_ICONS[entry.call.method]}
          </span>
        </span>
        <div class="flex-1 min-w-0">
          <div class="${hasSubject ? 'pt-2.5' : 'py-2.5'} leading-tight">
            <span class="font-medium">${displayNames.render(entry.authorId)}</span>
            <span class="text-gray-800">
              ${renderMethod.call(this, entry)}
            </span>
            <span class="text-sm text-gray-600">${relativeDate(entry.result.createdAt)}</span>
            ${hasSubject ? html`<span class="text-sm">for:</span>` : ''}
          </div>
          ${hasSubject ? html`
            <div class="border border-gray-300 mt-2 px-3 reply rounded bg-white hov:hover:bg-gray-50">
              ${asyncReplace(this.renderSubject(entry.call.args.recp.userId, entry.call.args.relatedTo.dbUrl))}
            </div>
          ` : ''}
        </div>
      </div>    `
  }

  renderCommunityDeleteBanMethod (entry) {
    const {bannedUser} = entry.call.args
    return html`
      lifted the ban on <span class="text-black">${displayNames.render(bannedUser.userId)}</span>
    `
  }

  renderCommunityInviteMemberMethod (entry) {
    const {invitedUser} = entry.call.args
    return html`
      invited
      <a href="/${invitedUser.userId}" class="text-blue-600 hov:hover:underline">${displayNames.render(invitedUser.userId)}</a>
      to join
      <a href="/${entry.call.database.userId}" class="text-blue-600 hov:hover:underline">${displayNames.render(entry.call.database.userId)}</a>
    `
  }
  
  renderCommunityRemoveMemberMethod (entry) {
    const {ban, banReason, member} = entry.call.args
    if (ban) {
      return html`
        banned ${member.userId} from <span class="text-black">${displayNames.render(entry.call.database.userId)}</span>
      `
    }
    return html`
      removed ${member.userId} from <span class="text-black">${displayNames.render(entry.call.database.userId)}</span>
    `
  }
    
  renderCommunityPutBanMethod (entry) {
    const {reason, bannedUser} = entry.call.args
    return html`
      banned ${bannedUser.userId} from <span class="text-black">${displayNames.render(entry.call.database.userId)}</span>
    `
  }

  renderCommunityUpdateConfigMethod (entry) {
    return html`
      updated the settings for
      <a href="/${entry.call.database.userId}" class="text-blue-600 hov:hover:underline">${displayNames.render(entry.call.database.userId)}</a>
    `
  }

  renderCreateItemMethod (entry) {
    const {classId, qty, owner} = entry.call.args
    return html`
      created
      <span class="font-semibold text-gray-800 text-sm">
        <img
          src=${ITEM_CLASS_ICON_URL(entry.call.database.userId, classId)}
          class="relative inline-block w-4 h-4 object-cover"
          style="top: -2px"
        >
        ${qty}
      </span>
      for
      <span class="text-black">${displayNames.render(owner.userId)}</span>
    `
  }
  
  renderCreateItemClassMethod (entry) {
    const {classId} = entry.call.args
    return html`
      created the item class
      <img
        src=${ITEM_CLASS_ICON_URL(entry.call.database.userId, classId)}
        class="relative inline-block w-4 h-4 object-cover"
        style="top: -2px"
      >
      <span class="text-black">${classId}</span>
    `
  }
  
  renderDeleteItemClassMethod (entry) {
    const {classId} = entry.call.args
    return html`
      deleted the item class
      <img
        src=${ITEM_CLASS_ICON_URL(entry.call.database.userId, classId)}
        class="relative inline-block w-4 h-4 object-cover"
        style="top: -2px"
      >
      <span class="text-black">${classId}</span>
    `
  }
  
  renderDestroyItemMethod (entry) {
    const {itemKey, qty} = entry.call.args
    const [classId] = itemKey.split(':')
    return html`
      destroyed
      <span class="font-semibold text-gray-800 text-sm">
        <img
          src=${ITEM_CLASS_ICON_URL(entry.call.database.userId, classId)}
          class="relative inline-block w-4 h-4 object-cover"
          style="top: -2px"
        >
        ${qty}
      </span>
    `
  }
  
  renderPutAvatarMethod (entry) {
    return html`
      updated <span class="text-black">${displayNames.render(entry.call.database.userId)}'s</span> avatar
    `
  }
  
  renderPutBlobMethod (entry) {
    const {blobName} = entry.call.args.target ? entry.call.args.target : ''
    return html`
      updated <span class="text-black">${displayNames.render(entry.call.database.userId)}'s</span> ${blobName} blob
    `
  }
  
  renderPutItemClassMethod (entry) {
    const {classId} = entry.call.args
    return html`
      set up the item class
      <img
        src=${ITEM_CLASS_ICON_URL(entry.call.database.userId, classId)}
        class="relative inline-block w-4 h-4 object-cover"
        style="top: -2px"
      >
      <span class="text-black">${classId}</span>
    `
  }
  
  renderPutProfileMethod (entry) {
    return html`
      updated <span class="text-black">${displayNames.render(entry.call.database.userId)}'s profile</span>
    `
  }
  
  renderTransferItemMethod (entry) {
    const {itemKey, qty, recp} = entry.call.args
    const [classId] = itemKey.split(':')
    return html`
      gave
      <span class="font-semibold text-gray-800 text-sm">
        <img
          src=${ITEM_CLASS_ICON_URL(entry.call.database.userId, classId)}
          class="relative inline-block w-4 h-4 object-cover"
          style="top: -2px"
        >
        ${qty}
      </span>
      to <span class="font-medium text-black">${displayNames.render(recp.userId)}</span>
    `
  }
  
  renderUpdateItemClassMethod (entry) {
    const {classId} = entry.call.args
    return html`
      updated the item class
      <img
        src=${ITEM_CLASS_ICON_URL(entry.call.database.userId, classId)}
        class="relative inline-block w-4 h-4 object-cover"
        style="top: -2px"
      >
      <span class="text-black">${classId}</span>
    `
  }

  async *renderSubject (authorId, dbUrl) {
    if (!_itemCache[dbUrl]) {
      yield html`Loading...`
    }

    const schemaId = extractSchemaId(dbUrl)
    let record
    if (schemaId === 'ctzn.network/post') {
      record = _itemCache[dbUrl] ? _itemCache[dbUrl] : await session.ctzn.getPost(authorId, dbUrl)
      _itemCache[dbUrl] = record
      yield html`
        <ctzn-post-view
          class="block py-2"
          .post=${record}
          mode="content-only"
        ></ctzn-post-view>
      `
    } else if (schemaId === 'ctzn.network/comment') {
      record = _itemCache[dbUrl] ? _itemCache[dbUrl] : await session.ctzn.getComment(authorId, dbUrl)
      _itemCache[dbUrl] = record
      yield html`
        <ctzn-post-view
          class="block py-2"
          .post=${record}
          mode="content-only"
        ></ctzn-post-view>
      `
    }
  }

  // events
  // =

  onClickViewNewEntries (e) {
    this.hasNewEntries = false
    this.load()
    window.scrollTo(0, 0)
  }

  onClickActivity (e, entry) {
    ViewActivityPopup.create({activity: entry})
  }
}

customElements.define('ctzn-dbmethods-feed', DbmethodsFeed)

function feedToGeneric (feedEntry) {
  return {
    key: feedEntry.key,
    authorId: feedEntry.caller.userId,
    call: feedEntry.call.value,
    result: feedEntry.result.value
  }
}

function callToGeneric (authorId, callEntry) {
  return {
    key: callEntry.key,
    authorId,
    call: callEntry.value,
    result: callEntry.result.value
  }
}

function resultToGeneric (resultEntry) {
  return {
    key: resultEntry.key,
    authorId: resultEntry.value.call.authorId,
    call: resultEntry.call.value,
    result: resultEntry.value
  }
}