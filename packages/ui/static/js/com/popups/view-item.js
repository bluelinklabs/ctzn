/* globals beaker */
import { html } from '../../../vendor/lit/lit.min.js'
import { BasePopup } from './base.js'
import * as session from '../../lib/session.js'
import { AVATAR_URL, ITEM_CLASS_ICON_URL } from '../../lib/const.js'
import * as displayNames from '../../lib/display-names.js'
import '../button.js'

// exported api
// =

export class ViewItemPopup extends BasePopup {
  static get properties () {
    return {
      databaseId: {type: String},
      item: {type: Object},
      itemClass: {type: Object},
      members: {type: Array},
      canTransferUnownedItem: {type: Boolean},
      isTransferFormOpen: {type: Boolean},
      isDataOpen: {type: Boolean},
      isProcessing: {type: Boolean},
      currentError: {type: String}
    }
  }

  constructor (opts) {
    super()
    this.databaseId = opts.databaseId || opts.communityId
    this.item = opts.item
    this.itemClass = undefined
    this.members = opts.members
    this.canTransferUnownedItem = false
    this.isTransferFormOpen = false
    this.isDataOpen = false
    this.isProcessing = false
    this.currentError = undefined
    this.recipient = undefined
    this.load()
  }

  async load () {
    if (!this.itemClass) {
      this.itemClass = await session.ctzn.db(this.databaseId).table('ctzn.network/item-class').get(this.item.value.classId)
    }
    if (session.isActive()) {
      let res = await session.ctzn.getCommunityUserPermission(
        this.databaseId,
        session.info.userId,
        'ctzn.network/perm-transfer-unowned-item'
      )
      this.canTransferUnownedItem = !!res
    }
    if (!this.members) {
      this.members = await listAllMembers(this.databaseId)
    }
  }

  get canTransferItem () {
    return this.canTransferUnownedItem || session.info?.userId === this.item.value.owner.userId
  }

  get isDoingSomething () {
    return this.isProcessing || this.isTransferFormOpen
  }

  get shouldShowHead () {
    return false
  }

  get shouldCloseOnEscape () {
    return !this.isDoingSomething
  }

  get shouldCloseOnOuterClick () {
    return !this.isDoingSomething
  }

  get maxWidth () {
    return '520px'
  }

  // management
  //

  static async create (opts) {
    return BasePopup.create(ViewItemPopup, opts)
  }

  static destroy () {
    return BasePopup.destroy('view-item-popup')
  }

  // rendering
  // =

  renderBody () {
    return html`
      <div class="flex mb-2">
        <div class="pt-1 pl-2 pr-4">
          <img
            src=${ITEM_CLASS_ICON_URL(this.databaseId, this.item.value.classId)}
            class="block w-8 h-8 object-cover"
          >
        </div>
        <div class="mr-2 flex-1 truncate">
          <div class="text-2xl">
            ${this.itemClass?.value.displayName || this.item.value.classId}
          </div>
          ${this.itemClass?.value.description ? html`
            <div class="whitespace-normal">${this.itemClass.value.description}</div>
          ` : ''}
        </div>
        <div class="bg-gray-100 font-semibold px-4 py-1.5 rounded self-start">
          <div>${this.item.value.qty}</div>
        </div>
      </div>
      <div class="rounded border border-gray-300">
        <div class="flex items-center border-b border-gray-200  p-2">
          <span class="border-r border-gray-200 mr-2" style="flex: 0 0 100px">Owner:</span>
          <a class="w-5 mr-1" href="/${this.item.value.owner.userId}" style="flex: 0 0 20px;">
            <img
              src=${AVATAR_URL(this.item.value.owner.userId)}
              class="rounded w-5 h-5"
            >
          </a>
          <a href="/${this.item.value.owner.userId}" class="truncate hov:hover:underline">
            <span class="font-medium">${displayNames.render(this.item.value.owner.userId)}</span>
            <span class="text-gray-500">${this.item.value.owner.userId}</span>
          </a>
        </div>
        <div class="flex items-center p-2">
          <span class="border-r border-gray-200 mr-2" style="flex: 0 0 100px">Community:</span>
          <a class="w-5 mr-1" href="/${this.databaseId}" style="flex: 0 0 20px;">
            <img
              src=${AVATAR_URL(this.databaseId)}
              class="rounded w-5 h-5"
            >
          </a>
          <a href="/${this.databaseId}" class="truncate hov:hover:underline">
            <span class="font-medium">${displayNames.render(this.databaseId)}</span>
            <span class="text-gray-500">${this.databaseId}</span>
          </a>
        </div>
      </div>

      <div class="flex border-t border-gray-200 mt-4 pt-4">
        ${this.canTransferItem ? html`
          <app-button
            btn-class="px-3 py-1"
            label="Transfer item"
            ?disabled=${this.isDoingSomething}
            @click=${this.onClickTransferItemToggle}
          ></app-button>
        ` : ''}
        <app-button
          transparent
          btn-class="px-3 py-1 ml-1 text-gray-600"
          label="Item data"
          icon=${this.isDataOpen ? 'fas fa-caret-up' : 'fas fa-caret-down'}
          ?disabled=${this.isDoingSomething}
          @click=${this.onClickItemDataToggle}
        ></app-button>
        <span class="flex-1"></span>
        <app-button
          btn-class="px-3 py-1"
          label="Close"
          ?disabled=${this.isDoingSomething}
          ?spinner=${this.isProcessing}
          @click=${this.onResolve}
        ></app-button>
      </div>

      ${this.isTransferFormOpen ? this.renderTransferForm() : ''}
      ${this.isDataOpen ? html`
        <div class="bg-gray-50 rounded p-2 text-sm text-gray-600 font-mono whitespace-pre overflow-x-auto">${JSON.stringify(this.item, null, 2)}</div>
      ` : ''}
    `
  }
  onChangeUser (e) {
    this.recipient = e.detail.value
  }

  renderTransferForm () {
    let idsList = [this.databaseId].concat(this.members?.map((member) => member.value.user.userId) || [])

    return html`
      <form class="border-t border-gray-200 mt-4 pt-4 pb-2" @submit=${this.onSubmit}>
        <h2 class="font-medium pb-2 text-2xl">Transfer item</h2>

        <label class="block font-semibold p-1" for="recp-input">Recipient</label>
          <app-users-input
            .users=${idsList}
            @change-user=${this.onChangeUser}
          ></app-users-input>
        <label class="block font-semibold p-1" for="keyTemplate-input">Quantity</label>
        <input
          required
          type="text"
          id="qty-input"
          name="qty"
          value="1"
          class="block box-border w-full border border-gray-300 rounded p-3 mb-2"
        />

        ${this.currentError ? html`
          <div class="bg-red-100 px-6 py-4 mb-4 text-red-600">${this.currentError}</div>
        ` : ''}

        <div class="flex">
          <app-button
            btn-class="px-3 py-1"
            @click=${this.onClickTransferItemToggle}
            label="Cancel"
            ?disabled=${this.isProcessing}
            ?spinner=${this.isProcessing}
          ></app-button>
          <span class="flex-1"></span>
          <app-button
            primary
            btn-type="submit"
            btn-class="px-3 py-1"
            label="Transfer"
            ?disabled=${this.isProcessing}
            ?spinner=${this.isProcessing}
          ></app-button>
        </div>
      </form>
    `
  }

  // events
  // =

  onClickTransferItemToggle (e) {
    this.isTransferFormOpen = !this.isTransferFormOpen
    this.isDataOpen = false
  }

  onClickItemDataToggle (e) {
    this.isDataOpen = !this.isDataOpen
    this.isTransferFormOpen = false
  }

  async onSubmit (e) {
    e.preventDefault()
    e.stopPropagation()

    this.isProcessing = true
    this.currentError = undefined

    const formData = new FormData(e.currentTarget)
    const value = Object.fromEntries(formData.entries())

    const qty = +value.qty
    if (qty != value.qty || qty < 1) {
      this.currentError = `Quantity must be a number greater than zero`
      this.isProcessing = false
      return
    }

    if (this.recipient === this.item.value.owner.userId) {
      this.currentError = `${value.recp} is already the owner`
      this.isProcessing = false
      return
    }

    let recp
    try {
      recp = await session.ctzn.lookupUser(this.recipient)
      if (!recp.userId || !recp.dbUrl) throw new Error('webfinger lookup failed')
    } catch (e) {
      this.currentError = `Failed to lookup recp details: ${e.toString()}`
      this.isProcessing = false
      return
    }
    
    try {
      await session.ctzn.db(this.databaseId).method('ctzn.network/transfer-item-method', {
        itemKey: this.item.key,
        qty,
        recp
      })
    } catch (e) {
      this.currentError = e.message || e.data || e.toString()
      this.isProcessing = false
      return
    }
    this.dispatchEvent(new CustomEvent('resolve'))
  }
}

customElements.define('view-item-popup', ViewItemPopup)


async function listAllMembers (userId) {
  let members = []
  let gt = undefined
  for (let i = 0; i < 1000; i++) {
    let m = await session.ctzn.db(userId).table('ctzn.network/community-member').list({gt, limit: 100})
    members = m.length ? members.concat(m) : members
    if (m.length < 100) break
    gt = m[m.length - 1].key
  }
  return members
}