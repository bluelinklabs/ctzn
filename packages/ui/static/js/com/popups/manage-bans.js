/* globals beaker */
import { html } from '../../../vendor/lit/lit.min.js'
import { repeat } from '../../../vendor/lit/directives/repeat.js'
import { BasePopup } from './base.js'
import * as session from '../../lib/session.js'
import * as toast from '../toast.js'
import '../button.js'

// exported api
// =

export class ManageBansPopup extends BasePopup {
  static get properties () {
    return {
      bans: {type: Array}
    }
  }

  constructor (opts) {
    super()
    this.communityId = opts.communityId
    this.bans = []
    this.load()
  }

  async load () {
    this.bans = await session.ctzn.db(this.communityId).table('ctzn.network/community-ban').list().catch(e => {
      console.log('Failed to fetch bans')
      console.log(e)
      return []
    })
    console.log({bans: this.bans})
  }

  get shouldShowHead () {
    return false
  }

  get shouldCloseOnEscape () {
    return true
  }

  get shouldCloseOnOuterClick () {
    return true
  }

  get maxWidth () {
    return '520px'
  }

  // management
  //

  static async create (opts) {
    return BasePopup.create(ManageBansPopup, opts)
  }

  static destroy () {
    return BasePopup.destroy('manage-bans-popup')
  }

  // rendering
  // =

  renderBody () {
    return html`
      <form class="px-2">
        <h2 class="text-3xl py-4">Manage bans</h2>

        ${this.bans.length === 0 ? html`
          <section class="border border-gray-200 rounded p-3 mb-2 bg-gray-50">
            No users have been banned.
          </section>
        ` : ''}
        ${repeat(this.bans, ban => html`
          <section class="border border-gray-200 rounded p-3 mb-2">
            <div class="">
              <span class="font-semibold">Banned user:</span>
              <a class="text-blue-600 hov:hover:underline" href="/${ban.value.bannedUser.userId}" target="_blank" title=${ban.value.bannedUser.userId}>${ban.value.bannedUser.userId}</a>
            </div>
            <div class="">
              <span class="font-semibold">Banned by:</span>
              <a class="text-blue-600 hov:hover:underline" href="/${ban.value.createdBy.userId}" target="_blank" title=${ban.value.createdBy.userId}>${ban.value.createdBy.userId}</a>
            </div>
            <div class="">
              <span class="font-semibold">Date:</span>
              ${(new Date(ban.value.createdAt)).toLocaleString()}
            </div>
            <div class="">
              <span class="font-semibold">Reason:</span>
              ${ban.value.reason || ''}
            </div>
            <div class="mt-1">
              <app-button
                btn-class="px-3 py-1"
                @click=${e => this.onLiftBan(e, ban)}
                label="Lift ban"
              ></app-button>
            </div>
          </section>
        `)}

        <div class="flex border-t border-gray-200 mt-4 pt-4">
          <span class="flex-1"></span>
          <app-button @click=${this.onReject} tabindex="3" label="Close"></app-button>
        </div>
      </form>
    `
  }

  // events
  // =

  async onLiftBan (e, ban) {
    if (!confirm(`Lift ban on ${ban.value.bannedUser.userId}?`)) {
      return
    }
    try {
      let res = await session.ctzn.db(this.communityId).method(
        'ctzn.network/community-delete-ban-method',
        {bannedUser: ban.value.bannedUser}
      )
      if (res.success()) {
        toast.create('Ban lifted', 'success')
      }
      this.load()
    } catch (e) {
      toast.create(e.toString(), 'error')
      console.log(e)
    }
  }
}

customElements.define('manage-bans-popup', ManageBansPopup)