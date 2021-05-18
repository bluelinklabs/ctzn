/* globals beaker */
import { html } from '../../../vendor/lit/lit.min.js'
import { BasePopup } from './base.js'
import * as session from '../../lib/session.js'
import '../button.js'

// exported api
// =

export class EditCommunityConfigPopup extends BasePopup {
  static get properties () {
    return {
      currentError: {type: String},
      isProcessing: {type: Boolean},
      config: {type: Object},
    }
  }

  constructor (opts) {
    super()
    this.currentError = undefined
    this.isProcessing = false
    this.communityId = opts.communityId
    this.config = undefined
    this.load()
  }

  async load () {
    this.config = (await session.ctzn.db(this.communityId).table('ctzn.network/community-config').get('self'))?.value
    if (!this.config) this.config = {}
    console.log(this.config)
  }

  get shouldShowHead () {
    return false
  }

  get maxWidth () {
    return '520px'
  }

  // management
  //

  static async create (opts) {
    return BasePopup.create(EditCommunityConfigPopup, opts)
  }

  static destroy () {
    return BasePopup.destroy('edit-community-config-popup')
  }

  // rendering
  // =

  renderBody () {
    return html`
      <form class="px-2" @submit=${this.onSubmit}>
        <h2 class="text-3xl pt-4 pb-2">Community settings</h2>

        ${this.config ? html`
          <label class="block font-semibold pb-1">Join Mode</label>
          <div class="border border-gray-200 rounded px-2 pt-3 pb-2">
            <div class="flex items-baseline mb-2">
              <input
                id="joinMode-open"
                type="radio"
                name="joinMode"
                value="open"
                class="mx-2"
                ?checked=${this.config.joinMode !== 'closed'}
              >
              <label for="joinMode-open" class="text-gray-600">
                <strong class="font-semibold text-black">Open.</strong>
                Anybody can join the community.
              </label>
            </div>
            <div class="flex items-baseline">
              <input
                id="joinMode-closed"
                type="radio"
                name="joinMode"
                value="closed"
                class="mx-2"
                ?checked=${this.config.joinMode === 'closed'}
              >
              <label for="joinMode-closed" class="text-gray-600">
                <strong class="font-semibold text-black">Closed.</strong>
                Members must be invited to join the community.
              </label>
            </div>
            <div class="bg-gray-100 mt-2 px-2 py-1 rounded text-gray-500 text-sm">
              Note: Closed communities are still publicly readable.
            </div>
          </div>
        ` : html`
          <div class="text-center rounded bg-gray-50 py-12">
            <span class="spinner"></span>
          </div>
        `}

        ${this.currentError ? html`
          <div class="text-red-500 px-1">${this.currentError}</div>
        ` : ''}

        <div class="flex justify-between border-t border-gray-200 mt-4 pt-4">
          <app-button @click=${this.onReject} tabindex="2" label="Cancel"></app-button>
          <app-button
            primary
            btn-type="submit"
            tabindex="1"
            ?disabled=${this.isProcessing || !this.config}
            ?spinner=${this.isProcessing}
            label="Save changes"
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

    if (this.isProcessing) return
    this.isProcessing = true

    const formData = new FormData(e.currentTarget)
    const values = Object.fromEntries(formData.entries())

    let res
    this.currentError = undefined
    try {
      res = await session.ctzn.db(this.communityId).method(
        'ctzn.network/community-update-config-method',
        values
      )
    } catch (e) {
      this.currentError = e.toString()
      return
    } finally {
      this.isProcessing = false
    }
    this.dispatchEvent(new CustomEvent('resolve', {detail: res}))
  }
}

customElements.define('edit-community-config-popup', EditCommunityConfigPopup)