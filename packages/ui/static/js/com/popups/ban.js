/* globals beaker */
import { html } from '../../../vendor/lit/lit.min.js'
import { BasePopup } from './base.js'
import * as session from '../../lib/session.js'
import '../button.js'

// exported api
// =

export class BanPopup extends BasePopup {
  static get properties () {
    return {
      currentError: {type: String},
      isProcessing: {type: Boolean}
    }
  }

  constructor (opts) {
    super()
    this.currentError = undefined
    this.isProcessing = false
    this.communityId = opts.communityId
    this.member = opts.member
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
    return BasePopup.create(BanPopup, opts)
  }

  static destroy () {
    return BasePopup.destroy('ban-popup')
  }

  // rendering
  // =

  renderBody () {
    return html`
      <form class="px-2">
        <h2 class="text-3xl py-4">Ban user</h2>

        <section class="mb-2">
          <label class="block font-semibold p-1" for="citizenId-input">User</label>
          <input
            required
            type="text"
            id="citizenId-input"
            name="citizenId"
            class="block box-border w-full border border-gray-300 rounded p-3"
            value=${this.member.userId}
            disabled
          />
        </section>

        <section class="mb-2">
          <label class="block font-semibold p-1" for="reason-textarea">Reason for the ban</label>
          <textarea
            id="reason-textarea"
            class="block box-border w-full border border-gray-300 rounded p-3"
            placeholder="Optional"
          ></textarea>
        </section>

        ${this.currentError ? html`
          <div class="text-red-500 px-1">${this.currentError}</div>
        ` : ''}

        <div class="flex border-t border-gray-200 mt-4 pt-4">
          <app-button @click=${this.onReject} tabindex="3" label="Cancel"></app-button>
          <span class="flex-1"></span>
          <app-button
            btn-class="mr-1"
            btn-type="submit"
            tabindex="2"
            ?disabled=${this.isProcessing}
            ?spinner=${this.isProcessing}
            label="Just remove"
            @click=${this.onClickJustRemove}
          ></app-button>
          <app-button
            primary
            btn-type="submit"
            tabindex="1"
            ?disabled=${this.isProcessing}
            ?spinner=${this.isProcessing}
            label="Ban and remove"
            @click=${this.onClickBan}
          ></app-button>
        </div>
      </form>
    `
  }

  firstUpdated () {
    this.querySelector('textarea').focus()
  }

  // events
  // =

  onClickJustRemove (e) {
    e.preventDefault()
    e.stopPropagation()
    this.doIt({ban: false})
  }

  onClickBan (e) {
    e.preventDefault()
    e.stopPropagation()
    this.doIt({ban: true})
  }

  async doIt ({ban}) {
    const banReason = this.querySelector('#reason-textarea').value

    if (this.isProcessing) return
    this.isProcessing = true

    let res
    this.currentError = undefined
    try {
      res = await session.ctzn.db(this.communityId).method(
        'ctzn.network/community-remove-member-method',
        {
          member: this.member,
          ban,
          banReason: ban ? banReason : undefined
        }
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

customElements.define('ban-popup', BanPopup)