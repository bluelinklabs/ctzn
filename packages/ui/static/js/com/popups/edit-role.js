/* globals beaker */
import { html } from '../../../vendor/lit/lit.min.js'
import { repeat } from '../../../vendor/lit/directives/repeat.js'
import { PERM_DESCRIPTIONS } from '../../lib/const.js'
import { BasePopup } from './base.js'
import * as session from '../../lib/session.js'
import '../button.js'

// exported api
// =

export class EditRolePopup extends BasePopup {
  static get properties () {
    return {
      currentError: {type: String},
      isProcessing: {type: Boolean},
      isNewRole: {type: Boolean},
      roleId: {type: String},
      permissions: {type: Array},
      members: {type: Array}
    }
  }

  constructor (opts) {
    super()
    this.currentError = undefined
    this.isProcessing = false
    this.communityId = opts.communityId
    this.isNewRole = !opts.roleId
    this.roleId = opts.roleId || ''
    this.permissions = opts.permissions || []
    this.members = opts.members || []
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
    return BasePopup.create(EditRolePopup, opts)
  }

  static destroy () {
    return BasePopup.destroy('edit-role-popup')
  }

  // rendering
  // =

  renderBody () {
    const renderPerm = (permId) => {
      return html`
        <div class="flex items-center">
          <input
            id="perm-${permId}"
            type="checkbox"
            class="mx-2"
            ?checked=${this.permissions.find(p => p.permId === permId)}
            @click=${e => this.onTogglePerm(e, permId)}
          >
          <label for="perm-${permId}">${PERM_DESCRIPTIONS[permId]}</label>
        </div>
      `
    }

    return html`
      <form class="px-2" @submit=${this.onSubmit}>
        <h2 class="text-3xl py-4">${this.isNewRole ? 'Create' : 'Edit'} role</h2>

        <section class="mb-2">
          <label class="block font-semibold p-1" for="roleId-input">Role ID</label>
          <input
            required
            type="text"
            id="roleId-input"
            name="roleId"
            class="block box-border w-full border border-gray-300 rounded p-3"
            placeholder="e.g. 'super-moderators'"
            value=${this.roleId}
            ?disabled=${!this.isNewRole}
            @keyup=${this.isNewRole ? this.onKeyupRoleId : undefined}
          />
        </section>

        <section class="mb-2">
          <label class="block font-semibold p-1">Permissions</label>
          ${this.roleId === 'admin' ? html`
            <div class="text-gray-500 px-1">Admin has full permissions.</div>
          ` : html`
            <div>
              <div class="font-bold px-1 text-gray-500 text-xs">SETTINGS</div>
              ${renderPerm('ctzn.network/perm-community-update-config')}
              ${renderPerm('ctzn.network/perm-community-edit-profile')}
              ${renderPerm('ctzn.network/perm-community-manage-roles')}
              ${renderPerm('ctzn.network/perm-community-assign-roles')}
              <div class="font-bold px-1 text-gray-500 text-xs mt-3">MEMBERSHIP</div>
              ${renderPerm('ctzn.network/perm-community-invite')}
              ${renderPerm('ctzn.network/perm-community-ban')}
              <div class="font-bold px-1 text-gray-500 text-xs mt-3">MODERATION</div>
              ${renderPerm('ctzn.network/perm-community-remove-post')}
              ${renderPerm('ctzn.network/perm-community-remove-comment')}
              <div class="font-bold px-1 text-gray-500 text-xs mt-3">CONTENT</div>
              ${renderPerm('ctzn.network/perm-manage-pages')}
              <div class="font-bold px-1 text-gray-500 text-xs mt-3">ITEMS</div>
              ${renderPerm('ctzn.network/perm-manage-item-classes')}
              ${renderPerm('ctzn.network/perm-create-item')}
              ${renderPerm('ctzn.network/perm-transfer-unowned-item')}
              ${renderPerm('ctzn.network/perm-destroy-unowned-item')}
            </div>
          `}
        </section>

        <section class="mb-2">
          <label class="block font-semibold p-1" for="members-textarea">Assigned</label>
          <textarea
            id="members-textarea"
            class="block box-border w-full border border-gray-300 rounded p-3"
          >${this.members?.map(m => m.value.user.userId).join(' ')}</textarea>
          <div class="text-gray-500 px-1 py-1 text-sm">
            Enter the User IDs of the assignees separated by spaces.
            This is alpha software, what do you want from me, a fancy auto-complete?
          </div>
        </section>

        ${this.currentError ? html`
          <div class="text-red-500 px-1">${this.currentError}</div>
        ` : ''}

        <div class="flex justify-between border-t border-gray-200 mt-4 pt-4">
          <app-button @click=${this.onReject} tabindex="2" label="Cancel"></app-button>
          <app-button
            primary
            btn-type="submit"
            tabindex="1"
            ?disabled=${this.isProcessing || !this.roleId}
            ?spinner=${this.isProcessing}
            label="${this.isNewRole ? 'Create role' : 'Save changes'}"
          ></app-button>
        </div>
      </form>
    `
  }

  firstUpdated () {
    this.querySelector('input').focus()
  }

  // events
  // =

  onKeyupRoleId (e) {
    this.roleId = e.currentTarget.value.trim().replace(/[^A-z0-9-]/gi, '').slice(0, 64)
    e.currentTarget.value = this.roleId
    this.requestUpdate()
  }

  onTogglePerm (e, permId) {
    if (this.permissions.find(p => p.permId === permId)) {
      this.permissions = this.permissions.filter(p => p.permId !== permId)
    } else {
      this.permissions.push({permId})
    }
    this.requestUpdate()
  }

  async onSubmit (e) {
    e.preventDefault()
    e.stopPropagation()

    const memberIds = this.querySelector('#members-textarea').value
      .split(/\s/g)
      .map(id => id.trim())
      .filter(Boolean)

    if (this.isProcessing) return
    this.isProcessing = true

    let res
    this.currentError = undefined
    try {
      res = await session.ctzn.db(this.communityId).method(
        'ctzn.network/community-put-role-method',
        {roleId: this.roleId, permissions: this.permissions}
      )
      for (let memberId of memberIds) {
        if (!this.members?.find(member => member.value.user.userId === memberId)) {
          let record = await session.ctzn
            .db(this.communityId)
            .table('ctzn.network/community-member')
            .get(memberId)
          if (!record) {
            throw new Error(`${memberId} is not a member of this community`)
          }
          let roles = new Set(record.value.roles || [])
          roles.add(this.roleId)
          res = await session.ctzn.db(this.communityId).method(
            'ctzn.network/community-set-member-roles-method',
            {member: record.value.user, roles: Array.from(roles)}
          )
        }
      }
      for (let member of this.members) {
        if (!memberIds.includes(member.value.user.userId)) {
          let record = await session.ctzn
            .db(this.communityId)
            .table('ctzn.network/community-member')
            .get(member.value.user.userId)
          if (!record) {
            throw new Error(`${member.value.user.userId} is not a member of this community`)
          }
          let roles = new Set(record.value.roles || [])
          roles.delete(this.roleId)
          res = await session.ctzn.db(this.communityId).method(
            'ctzn.network/community-set-member-roles-method',
            {member: record.value.user, roles: Array.from(roles)}
          )
        }
      }
    } catch (e) {
      this.currentError = e.toString()
      return
    } finally {
      this.isProcessing = false
    }
    this.dispatchEvent(new CustomEvent('resolve', {detail: res}))
  }
}

customElements.define('edit-role-popup', EditRolePopup)