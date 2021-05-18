/* globals beaker */
import { html } from '../../../vendor/lit/lit.min.js'
import { repeat } from '../../../vendor/lit/directives/repeat.js'
import { BasePopup } from './base.js'
import * as session from '../../lib/session.js'
import '../button.js'

// exported api
// =

export class CreateItemPopup extends BasePopup {
  static get properties () {
    return {
      communityId: {type: String},
      itemClassId: {type: String},
      members: {type: Array},
      isProcessing: {type: Boolean},
      currentError: {type: String}
    }
  }

  constructor (opts) {
    super()
    this.communityId = opts.communityId
    this.itemClassId = opts.itemClassId
    this.members = opts.members
    this.isProcessing = false
    this.currentError = undefined
  }

  get shouldShowHead () {
    return false
  }

  get shouldCloseOnEscape () {
    return false
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
    return BasePopup.create(CreateItemPopup, opts)
  }

  static destroy () {
    return BasePopup.destroy('create-item-popup')
  }

  // rendering
  // =

  renderBody () {
    return html`
      <form class="px-2" @submit=${this.onSubmit}>
        <h2 class="text-3xl py-4">Generate ${this.itemClassId}</h2>

        <label class="block font-semibold p-1" for="owner-input">Owner</label>
        <div class="relative">
          <select
            type="text"
            id="owner-input"
            name="owner"
            value="${this.communityId}"
            class="block box-border w-full border border-gray-300 rounded p-3 mb-2 appearance-none"
          >
            <option value=${this.communityId}>${this.communityId}</option>
            ${repeat(this.members, member => html`<option value=${member.value.user.userId}>${member.value.user.userId}</option>`)}
          </select>
          <span class="fas fa-caret-down absolute z-10" style="right: 15px; top: 15px"></span>
        </div>
        <label class="block font-semibold p-1" for="keyTemplate-input">Quantity</label>
        <input
          required
          type="text"
          id="qty-input"
          name="qty"
          value="1"
          class="block box-border w-full border border-gray-300 rounded p-3 mb-2"
        />
        <label class="block font-semibold p-1" for="properties-input">Properties</label>
        <textarea
          id="properties-input"
          name="properties"
          class="block box-border w-full border border-gray-300 rounded p-3 mb-2"
          placeholder="Optional"
        ></textarea>

        ${this.currentError ? html`
          <div class="bg-red-100 px-6 py-4 mb-4 text-red-600">${this.currentError}</div>
        ` : ''}

        <div class="flex border-t border-gray-200 mt-4 pt-4">
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
            label="Generate"
            ?disabled=${this.isProcessing}
            ?spinner=${this.isProcessing}
          ></app-button>
        </div>
      </form>
    `
  }

  // events
  // =

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

    if (value.properties) {
      try {
        value.properties = JSON.parse(value.properties)
      } catch (e) {
        this.currentError = `Invalid properties: ${e.toString()}`
        this.isProcessing = false
        return
      }
    } else {
      value.properties = undefined
    }

    let owner
    try {
      owner = await session.ctzn.lookupUser(value.owner)
      if (!owner.userId || !owner.dbUrl) throw new Error('webfinger lookup failed')
    } catch (e) {
      this.currentError = `Failed to lookup owner details: ${e.toString()}`
      this.isProcessing = false
      return
    }
    
    try {
      await session.ctzn.db(this.communityId).method('ctzn.network/create-item-method', {
        classId: this.itemClassId,
        qty,
        properties: value.properties,
        owner
      })
    } catch (e) {
      this.currentError = e.message || e.data || e.toString()
      this.isProcessing = false
      return
    }
    this.dispatchEvent(new CustomEvent('resolve'))
  }
}

customElements.define('create-item-popup', CreateItemPopup)