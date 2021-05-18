/* globals beaker */
import { html } from '../../../vendor/lit/lit.min.js'
import { repeat } from '../../../vendor/lit/directives/repeat.js'
import { BasePopup } from './base.js'
import * as session from '../../lib/session.js'
import * as displayNames from '../../lib/display-names.js'
import '../button.js'
import '../../ctzn-tags/post-view.js'

// exported api
// =

export class TransferItemPopup extends BasePopup {
  static get properties () {
    return {
      recpUserId: {type: String},
      availableItems: {type: Array},
      sharedCommunities: {type: Array},
      selectedItem: {type: Object},
      isProcessing: {type: Boolean},
      currentError: {type: String}
    }
  }

  constructor (opts) {
    super()
    this.recpUserId = opts.recpUserId
    this.availableItems = undefined
    this.sharedCommunities = undefined
    this.selectedItem = undefined
    this.isProcessing = false
    this.currentError = undefined
    this.load()
  }

  async load () {
    const ownedItems = await session.ctzn.listOwnedItems(session.info.userId)
    const recpMemberships = await session.ctzn.db(this.recpUserId).table('ctzn.network/community-membership').list()
    this.sharedCommunities = session.myCommunities.filter(c => recpMemberships.find(m => m.value.community.userId === c.userId))
    this.availableItems = ownedItems.filter(item => this.sharedCommunities.find(c => c.userId === item.databaseId))
    this.selectedItem = this.availableItems[0]
  }

  get shouldShowHead () {
    return false
  }

  get shouldCloseOnEscape () {
    return !this.isProcessing
  }

  get shouldCloseOnOuterClick () {
    return false
  }

  get maxWidth () {
    return '520px'
  }

  // management
  //

  static async create (opts) {
    return BasePopup.create(TransferItemPopup, opts)
  }

  static destroy () {
    return BasePopup.destroy('transfer-item-popup')
  }

  // rendering
  // =

  renderBody () {
    return html`
      <form class="" @submit=${this.onSubmit}>
        <h2 class="font-medium pb-2 text-2xl">Give item to ${displayNames.render(this.recpUserId)}</h2>

        <label class="block font-semibold p-1" for="item-input">Item</label>
        <div class="relative">
          ${this.availableItems ? html`
            ${this.availableItems.length ? html`
              <select
                type="text"
                id="item-input"
                name="item"
                class="block box-border w-full border border-gray-300 rounded p-3 mb-2 appearance-none"
                @change=${this.onChangeSelectedItem}
              >
                ${repeat(this.availableItems, (item, i) => html`<option value=${i}>${item.itemClass?.value.displayName || item.value.classId}</option>`)}
              </select>
              <span class="fas fa-caret-down absolute z-10" style="right: 15px; top: 15px"></span>
            ` : html`
              <div class="bg-gray-100 px-4 py-3 rounded">
                <span class="far fa-fw fa-frown"></span>
                ${this.sharedCommunities.length === 0 ? html`
                  You aren't in any communities with ${displayNames.render(this.recpUserId)}.
                ` : html`
                  You don't own any items in the communities you share with ${displayNames.render(this.recpUserId)}.
                `}
              </div>
              <div class="flex pl-2 pt-2">
                <span class="mr-1.5 text-gray-600">
                  <span class="fas fa-info-circle fa-fw"></span>
                </span>
                <span class="flex-1 text-gray-500 text-sm">
                  Items are a communities feature.
                  Each item is specific to a community and can only be given to other members of that community.
                </span>
              </div>
            `}
          ` : html`
            <span class="spinner"></span>
          `}
        </div>
        ${this.selectedItem ? html`
          <label class="block font-semibold p-1" for="keyTemplate-input">Quantity</label>
          <input
            required
            type="text"
            id="qty-input"
            name="qty"
            value="1"
            class="block box-border w-full border border-gray-300 rounded-t p-3"
          />
          <div class="bg-gray-100 px-3 py-2 rounded-b mb-2">
            <span class="bg-white font-semibold inline-block mr-1 px-3 rounded">${this.selectedItem.value.qty}</span>
            ${this.selectedItem.itemClass?.value.displayName || this.selectedItem.value.classId}
            available to give
          </div>
        ` : ''}

        ${this.currentError ? html`
          <div class="bg-red-100 px-6 py-4 mb-4 text-red-600">${this.currentError}</div>
        ` : ''}

        <div class="flex mt-4 pt-4 pb-2 border-t border-gray-200">
          <app-button
            btn-class="px-3 py-1"
            @click=${this.onReject}
            label="Cancel"
            ?disabled=${this.isProcessing}
            ?spinner=${this.isProcessing}
          ></app-button>
          <span class="flex-1"></span>
          <app-button
            primary
            btn-type="submit"
            btn-class="px-3 py-1"
            label="Give Item"
            ?disabled=${this.isProcessing || !this.selectedItem}
            ?spinner=${this.isProcessing}
          ></app-button>
        </div>
      </form>
    `
  }

  // events
  // =

  onChangeSelectedItem (e) {
    this.selectedItem = this.availableItems[Number(e.currentTarget.value)]
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
    if (qty > this.selectedItem.value.qty) {
      this.currentError = `You don't have that many to give!`
      this.isProcessing = false
      return
    }

    let recp
    try {
      recp = await session.ctzn.lookupUser(this.recpUserId)
      if (!recp.userId || !recp.dbUrl) throw new Error('webfinger lookup failed')
    } catch (e) {
      this.currentError = `Failed to lookup recp details: ${e.toString()}`
      this.isProcessing = false
      return
    }
    
    try {
      await session.ctzn.db(this.selectedItem.databaseId).method('ctzn.network/transfer-item-method', {
        itemKey: this.selectedItem.key,
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

customElements.define('transfer-item-popup', TransferItemPopup)