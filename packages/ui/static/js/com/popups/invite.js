/* globals beaker */
import { html } from '../../../vendor/lit/lit.min.js'
import { BasePopup } from './base.js'
import * as session from '../../lib/session.js'
import '../button.js'
import '../users-input.js'

// exported api
// =

export class InvitePopup extends BasePopup {
  static get properties () {
    return {
      userId: {type: String},
      currentError: {type: String},
      isProcessing: {type: Boolean}
    }
  }

  constructor (opts) {
    super()
    this.userId = undefined
    this.currentError = undefined
    this.isProcessing = false
    this.communityId = opts.communityId
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
    return BasePopup.create(InvitePopup, opts)
  }

  static destroy () {
    return BasePopup.destroy('invite-popup')
  }

  // rendering
  // =

  renderBody () {
    return html`
      <form class="px-2" @submit=${this.onSubmit}>
        <h2 class="text-3xl py-4">Invite user</h2>

        <section class="mb-2">
          <app-users-input .users=${session.myFollowing} @change-user=${this.onChangeUser}></app-users-input>
        </section>

        ${this.currentError ? html`
          <div class="text-red-500 px-1">${this.currentError}</div>
        ` : ''}

        <div class="flex border-t border-gray-200 mt-4 pt-4">
          <app-button @click=${this.onReject} tabindex="3" label="Cancel"></app-button>
          <span class="flex-1"></span>
          <app-button
            primary
            btn-type="submit"
            tabindex="1"
            ?disabled=${!this.userId || this.isProcessing}
            ?spinner=${this.isProcessing}
            label="Invite"
          ></app-button>
        </div>
      </form>
    `
  }

  // events
  // =

  onChangeUser (e) {
    this.userId = e.detail.value
  }

  async onSubmit (e) {
    e.preventDefault()
    e.stopPropagation()
    
    if (this.isProcessing) return
    this.isProcessing = true
    this.currentError = undefined

    let invitedUser
    try {
      invitedUser = await session.ctzn.lookupUser(this.userId)
      if (!invitedUser.userId || !invitedUser.dbUrl) throw new Error('webfinger lookup failed')
    } catch (e) {
      this.currentError = `Failed to lookup user details: ${e.toString()}`
      this.isProcessing = false
      return
    }

    let res
    try {
      res = await session.ctzn.db(this.communityId).method(
        'ctzn.network/community-invite-member-method',
        {invitedUser}
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

customElements.define('invite-popup', InvitePopup)