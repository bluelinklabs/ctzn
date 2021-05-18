import { LitElement, html } from '../../vendor/lit/lit.min.js'
import { repeat } from '../../vendor/lit/directives/repeat.js'
import { slugify } from '../../vendor/slugify.js'
import * as session from '../lib/session.js'
import * as images from '../lib/images.js'
import { encodeBase64, decodeBase64 } from '../lib/strings.js'
import { deepClone } from '../lib/functions.js'
import { emit } from '../lib/dom.js'
import {
  AVATAR_URL,
  BLOB_URL,
  PERM_DESCRIPTIONS
} from '../lib/const.js'
import { UiEditorPopup } from './popups/ui-editor.js'
import { ManageBansPopup } from '../com/popups/manage-bans.js'
import { EditRolePopup } from '../com/popups/edit-role.js'
import { InvitePopup } from '../com/popups/invite.js'
import * as toast from './toast.js'
import './button.js'
import './code-textarea.js'
import './img-fallbacks.js'

export class EditProfile extends LitElement {
  static get properties () {
    return {
      userId: {type: String, attribute: 'user-id'},
      profile: {type: Object},
      communityPerms: {type: Object},
      communityConfig: {type: Object},
      communityRoles: {type: Object},
      communityMembers: {type: Object},
      _hasChanges: {type: Boolean},
      values: {type: Object},
      communityConfigValues: {type: Object},
      currentView: {type: String},
      currentError: {type: String},
      isProcessing: {type: Boolean}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.userId = undefined
    this.profile = undefined

    // community
    this.communityPerms = undefined
    this.communityConfig = undefined
    this.communityRoles = undefined
    this.communityMembers = undefined
    
    // UI state
    this.hasChanges = false
    this.values = undefined
    this.communityConfigValues = undefined
    this.currentView = 'basics'
    this.currentError = undefined
    this.img = undefined
    this.uploadedAvatar = undefined
    this.uploadedBanner = undefined
    this.isProcessing = false
  }

  get isCitizen () {
    return this.profile?.dbType === 'ctzn.network/public-citizen-db'
  }

  get isCommunity () {
    return this.profile?.dbType === 'ctzn.network/public-community-db'
  }

  updated (changedProperties) {
    if (changedProperties.has('profile') && this.profile) {
      this.load()
    }
  }

  async load () {
    if (this.profile?.value?.sections?.length) {
      for (let section of this.profile.value.sections) {
        if (!section.html) {
          try {
            let base64buf = (await session.ctzn.getBlobByHomeServer(this.userId, `ui:profile:${section.id}`))?.buf
            if (base64buf) section.html = decodeBase64(base64buf)
          } catch (e) {
            console.log('Failed to load blob', e)
          }
          if (!section.html) {
            section.html = ''
          }
        }
      }
    }
    this.values = deepClone(this.profile.value)
    await this.loadCommunity()
  }

  async loadCommunity () {
    if (!this.isCommunity) return
    this.communityPerms = session.isActive ? (await session.ctzn.viewByHomeServer(
      this.userId,
      'ctzn.network/community-user-permissions-view',
      this.userId,
      session.info.userId
    ))?.permissions : []
    this.communityConfig = (await session.ctzn.db(this.userId).table('ctzn.network/community-config').get('self'))?.value || {}
    this.communityRoles = await session.ctzn.db(this.userId).table('ctzn.network/community-role').list().catch(e => undefined) || []
    this.communityMembers = await session.ctzn.listAllMembers(this.userId)
    this.communityConfigValues = deepClone(this.communityConfig)
  }

  get hasChanges () {
    return this._hasChanges
  }

  set hasChanges (v) {
    this._hasChanges = v
    document.body.querySelector('app-root').pageHasChanges = v
  }

  getValue (path) {
    return getByPath(this.values, path)
  }

  setValue (path, v) {
    if (this.getValue(path) !== v) {
      setByPath(this.values, path, v)
      this.hasChanges = true
    }
  }

  get canEditProfile () {
    return session.isActive () && (
      session.info.userId === this.userId ||
      this.hasPermission('ctzn.network/perm-community-edit-profile')
    )
  }

  hasPermission (permId) {
    if (!this.communityPerms?.length) {
      return false
    }
    return !!this.communityPerms.find(p => p.permId === 'ctzn.network/perm-admin' || p.permId === permId)
  }

  getMembersWithRole (roleId) {
    return this.communityMembers?.filter?.(m => m.value.roles?.includes(roleId)) || []
  }

  // rendering
  // =

  render () {
    if (!this.values) return html``
    const navItem = (id, label) => html`
      <div
        class="
          py-2 pl-4 pr-6 hov:hover:bg-gray-100 cursor-pointer
          ${id === this.currentView ? 'text-blue-600 border-b sm:border-b-0 sm:border-r-4 border-blue-600' : ''}
        "
        @click=${e => {this.currentView = id}}
      >${label}</div>
    `
    return html`
      <form @submit=${this.onSubmit} class="bg-white sm:rounded mb-0.5">
        <div class="border-b border-gray-200 flex items-center justify-between pl-4 pr-2 py-2 rounded-t">
          <div class="text-lg font-semibold">Settings</div>
          <app-button
            ?primary=${this.hasChanges}
            ?disabled=${!this.hasChanges || this.isProcessing}
            ?spinner=${this.isProcessing}
            btn-class="py-1 px-2 text-sm"
            btn-type="submit"
            label="Save changes"
          ></app-button>
        </div>
        ${this.currentError ? html`
          <div class="bg-red-100 p-6 mt-2 mb-4 text-red-600">${this.currentError}</div>
        ` : ''}
        <div class="sm:flex">
          <div class="flex sm:block border-b sm:border-b-0 sm:border-r border-gray-200 sm:w-32">
            ${navItem('basics', 'Basics')}
            ${this.isCommunity ? navItem('community', 'Community') : ''}
            ${navItem('advanced', 'Advanced')}
          </div>
          <div class="sm:flex-1 px-4 pt-2 pb-4">
            <div class="${this.currentView === 'basics' ? 'block' : 'hidden'}">
              <label class="block font-semibold p-1" for="displayName-input">Display Name</label>
              <input
                autofocus
                type="text"
                id="displayName-input"
                name="displayName"
                value="${this.values.displayName}"
                class="block box-border w-full border border-gray-300 rounded p-3 mb-1"
                placeholder="Anonymous"
                @keyup=${e => this.onKeyupValue(e, ['displayName'])}
                ?disabled=${!this.canEditProfile}
              />

              <label class="block font-semibold p-1" for="description-input">Bio</label>
              <textarea
                id="description-input"
                name="description"
                class="block box-border w-full border border-gray-300 rounded p-3 mb-2"
                @keyup=${e => this.onKeyupValue(e, ['description'])}
                ?disabled=${!this.canEditProfile}
              >${this.values.description}</textarea>

              <div class="mb-2">
                <label class="block font-semibold p-1">Banner Image</label>
                ${!this.uploadedBanner ? html`
                  <app-img-fallbacks>
                    <img
                      slot="img1"
                      class="block rounded-2xl border border-gray-400 w-full object-cover cursor-pointer hov:hover:opacity-50"
                      style="width: 320px; height: 150px"
                      src=${BLOB_URL(this.userId, 'profile-banner')} 
                      @click=${this.onClickBanner}
                    >
                    <div
                      slot="img2"
                      class="block rounded-2xl border border-gray-400 cursor-pointer hov:hover:opacity-50"
                      style="width: 320px; height: 150px; background: linear-gradient(0deg, #3c4af6, #2663eb);"
                      @click=${this.onClickBanner}
                    ></div>
                  </app-img-fallbacks>
                ` : html`
                  <img
                    class="block rounded-2xl border border-gray-400 w-full object-cover cursor-pointer hov:hover:opacity-50"
                    style="width: 320px; height: 150px"
                    src=${this.uploadedBanner} 
                    @click=${this.onClickBanner}
                  >
                `}
              </div>
              <div class="mb-2">
                <label class="block font-semibold p-1">Profile Image</label>
                <img 
                  class="block border border-gray-400 rounded-3xl object-cover cursor-pointer hov:hover:opacity-50"
                  style="width: 150px; height: 150px;"
                  src=${this.uploadedAvatar || AVATAR_URL(this.userId)}
                  @click=${this.onClickAvatar}
                >
              </div>
              <input id="banner-file-input" class="hidden" type="file" accept=".jpg,.jpeg,.png,.svg" @change=${this.onChooseBannerFile}>
              <input id="avatar-file-input" class="hidden" type="file" accept=".jpg,.jpeg,.png,.svg" @change=${this.onChooseAvatarFile}>
            </div>

            <div class="${this.currentView === 'community' ? 'block' : 'hidden'}">
              ${this.isCommunity ? this.renderCommunityForm() : ''}
            </div>

            <div class="${this.currentView === 'advanced' ? 'block' : 'hidden'}">
              <label class="block font-semibold p-1">Custom sections</label>
              <div class="px-1 pb-3 text-gray-500 text-sm font-medium">
                You can add new sections to your profile below.
              </div>
              <div class="block rounded border border-gray-200">
                ${this.values?.sections?.length ? html`
                  ${repeat(this.values.sections, section => section.id, this.renderSection.bind(this))}
                ` : ''}
                <div class="bg-white rounded px-2 py-2 border-t border-gray-200">
                  <app-button
                    transparent
                    btn-class="px-2 py-1"
                    icon="fas fa-plus"
                    label="Add Section"
                    @click=${this.onAddSection}
                    ?disabled=${!this.canEditProfile}
                  ></app-button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    `
  }

  renderCommunityForm () {
    const canInvite = this.hasPermission('ctzn.network/perm-community-invite')
    const canManageRoles = this.hasPermission('ctzn.network/perm-community-manage-roles')
    const canBan = this.hasPermission('ctzn.network/perm-community-ban')
    const canEditConfig = this.hasPermission('ctzn.network/perm-community-update-config')

    const renderRole = (roleId, permissions) => {
      let members = this.getMembersWithRole(roleId)
      return html`
        <div class="px-4 py-2 bg-white border border-gray-300 rounded mb-1">
          <div class="flex items-center">
            <span class="font-semibold text-lg flex-1"><span class="text-sm far fa-fw fa-user"></span> ${roleId}</span>
            ${roleId !== 'admin' && this.hasPermission('ctzn.network/perm-community-manage-roles') ? html`
              <app-button btn-class="px-3 py-1 text-sm" @click=${e => this.onRemoveRole(e, roleId)} label="Remove"></app-button>
            ` : ''}
            ${this.hasPermission('ctzn.network/perm-community-manage-roles') ? html`
              <app-button btn-class="ml-1 px-3 py-1 text-sm" @click=${e => this.onEditRole(e, roleId, permissions)} label="Edit"></app-button>
            ` : ''}
          </div>
          <div class="text-gray-500">
            ${roleId === 'admin' ? html`
              <div>&bull; Runs this community.</div>
            ` : permissions.length ? html`
              ${repeat(permissions, p => p.permId, p => html`
                <div>&bull; ${PERM_DESCRIPTIONS[p.permId] || p.permId}</div>
              `)}
            ` : html`
              <em>This role has no permissions</em>
            `}
          </div>
          ${members.length > 0 ? html`
            <div class="flex mt-2">
              ${repeat(members, member => html`
                <a class="block" href="/${member.value.user.userId}" data-tooltip=${member.value.user.userId}>
                  <img class="block rounded object-cover w-10 h-10 mr-1" src=${AVATAR_URL(member.value.user.userId)}>
                </a>
              `)}
            </div>
          ` : ''}
        </div>
      `
    }

    return html`
      <div class="mt-2 mb-4">
        <app-button
          btn-class="px-3 py-1 text-sm"
          @click=${canInvite ? this.onCreateInvite : undefined}
          ?disabled=${!canInvite}
          label="Invite New Member"
        ></app-button>
      </div>

      <h4 class="font-medium border-b border-gray-200 mb-2">Join mode</h4>
      ${this.communityConfigValues ? html`
        <div class="py-2">
          <div class="flex items-baseline mb-2">
            <input
              id="joinMode-open"
              type="radio"
              name="joinMode"
              value="open"
              class="mx-2"
              @click=${this.onClickJoinMode}
              ?checked=${this.communityConfigValues.joinMode !== 'closed'}
              ?disabled=${!canEditConfig}
            >
            <label for="joinMode-open" class="text-gray-600">
              <strong class="font-medium text-black">Open.</strong>
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
              @click=${this.onClickJoinMode}
              ?checked=${this.communityConfigValues.joinMode === 'closed'}
              ?disabled=${!canEditConfig}
            >
            <label for="joinMode-closed" class="text-gray-600">
              <strong class="font-medium text-black">Closed.</strong>
              Members must be invited to join the community.
            </label>
          </div>
          <div class="mt-2 px-2 py-1 text-gray-500 text-sm">
            Note: Closed communities are still publicly readable.
          </div>
        </div>
      ` : html`
        <div class="text-center rounded bg-gray-50 py-12">
          <span class="spinner"></span>
        </div>
      `}
      <h4 class="font-medium border-b border-gray-200 mb-2 mt-3">Member roles</h4>
      <div class="bg-gray-100 rounded p-2 mb-2">
        ${renderRole('admin')}
        ${repeat(this.communityRoles || [], r => r.value.roleId, r => renderRole(r.value.roleId, r.value.permissions))}
        <div>
          <app-button
            btn-class="px-3 py-1 text-sm"
            @click=${canManageRoles ? this.onCreateRole : undefined}
            ?disabled=${!canManageRoles}
            label="Create New Role"
          ></app-button>
        </div>
      </div>
      <h4 class="font-medium border-b border-gray-200 mb-2 mt-3">Banned users</h4>
      <div>
        <app-button
          btn-class="px-3 py-1 text-sm"
          @click=${canBan ? this.onClickManageBans : undefined}
          ?disabled=${!canBan}
          label="Manage Banned Users"
        ></app-button>
      </div>
    `
  }

  renderSection (section, i) {
    return html`
      <div class="flex items-center bg-white pl-2 pr-1 py-2 ${i !== 0 ? 'border-t border-gray-200 rounded-t' : ''}">
        <span class="text-sm">
          ${i === 0 ? html`
            <span class="fas fa-arrow-up px-1.5 py-0.5 text-gray-300"></span>
          ` : html`
            <app-button
              transparent
              btn-class="px-1.5 py-0.5"
              icon="fas fa-arrow-up"
              data-tooltip="Move up in the nav order"
              @click=${e => this.onMoveSection(e, i, -1)}
              ?disabled=${!this.canEditProfile}
            ></app-button>
          `}
          ${i === this.values.sections.length - 1 ? html`
            <span class="fas fa-arrow-down px-1.5 py-0.5 text-gray-300"></span>
          ` : html`
            <app-button
              transparent
              btn-class="px-1.5 py-0.5"
              icon="fas fa-arrow-down"
              data-tooltip="Move down in the nav order"
              @click=${e => this.onMoveSection(e, i, 1)}
              ?disabled=${!this.canEditProfile}
            ></app-button>
          `}
        </span>
        <span
          class="flex-1 truncate ml-2 border border-gray-200 rounded px-2 py-1 font-medium cursor-pointer hov:hover:bg-gray-50"
          @click=${e => this.onEditSection(e, i)}
        >
          <span class="fa-fw fa-pen fas text-gray-400 text-gray-600 text-sm"></span>
          ${section.label || html`<em>Unnamed section</em>`}
        </span>
        <app-button
          transparent
          btn-class="ml-1 px-2 py-1 text-red-500 text-sm"
          class="ml-auto"
          icon="fas fa-times"
          @click=${e => this.onDeleteSection(e, i)}
          ?disabled=${!this.canEditProfile}
        ></app-button>
      </div>
    `
  }

  // events
  // =

  onKeyupValue (e, path) {
    let v = (e.target.value || '').trim()
    if (this.getValue(path) !== v) {
      this.setValue(path, v)
    }
  }

  onAddSection (e) {
    this.values.sections = this.values.sections || []
    this.values.sections.push({id: '', label: '', html: ''})
    this.hasChanges = true
    this.requestUpdate()
  }

  onMoveSection (e, index, dir) {
    let tmp = this.values.sections[index + dir]
    this.values.sections[index + dir] = this.values.sections[index]
    this.values.sections[index] = tmp
    this.hasChanges = true
    this.requestUpdate()
  }

  onDeleteSection (e, index) {
    if (!confirm('Delete this section?')) {
      return
    }
    this.values.sections.splice(index, 1)
    this.hasChanges = true
    this.requestUpdate()
  }

  async onEditSection (e, index) {
    const res = await UiEditorPopup.create({
      label: this.values.sections[index].label,
      context: 'profile',
      contextState: {page: {userId: this.userId}},
      value: this.values.sections[index].html,
      placeholder: 'Build your UI here!',
      canSave: this.canEditProfile
    })
    if (this.canEditProfile) {
      this.setValue(['sections', index, 'label'], res.label)
      this.setValue(['sections', index, 'html'], res.html)
      this.requestUpdate()
    }
  }

  onClickBanner (e) {
    if (!this.canEditProfile) {
      return
    }
    e.preventDefault()
    this.querySelector('#banner-file-input').click()
  }

  onChooseBannerFile (e) {
    var file = e.currentTarget.files[0]
    if (!file) return
    var fr = new FileReader()
    fr.onload = () => {
      this.uploadedBanner = fr.result
      this.hasChanges = true
      this.requestUpdate()
    }
    fr.readAsDataURL(file)
  }

  onClickAvatar (e) {
    if (!this.canEditProfile) {
      return
    }
    e.preventDefault()
    this.querySelector('#avatar-file-input').click()
  }

  onChooseAvatarFile (e) {
    var file = e.currentTarget.files[0]
    if (!file) return
    var fr = new FileReader()
    fr.onload = () => {
      this.uploadedAvatar = fr.result
      this.hasChanges = true
      this.requestUpdate()
    }
    fr.readAsDataURL(file)
  }

  async onCreateRole (e) {
    try {
      await EditRolePopup.create({communityId: this.userId})
      this.loadCommunity()
    } catch (e) {
      console.log(e)
    }
  }

  async onEditRole (e, roleId, permissions) {
    try {
      await EditRolePopup.create({
        communityId: this.userId,
        roleId,
        permissions,
        members: this.getMembersWithRole(roleId)
      })
      this.loadCommunity()
    } catch (e) {
      console.log(e)
    }
  }

  async onRemoveRole (e, roleId) {
    if (!confirm('Remove this role?')) {
      return
    }
    try {
      let res = await session.ctzn.db(this.userId).method(
        'ctzn.network/community-delete-role-method',
        {roleId}
      )
      if (!res.pending()) {
        toast.create(`${roleId} role removed`)
      }
      this.loadCommunity()
    } catch (e) {
      console.log(e)
      toast.create(e.toString(), 'error')
    }
  }

  async onCreateInvite (e) {
    try {
      await InvitePopup.create({
        communityId: this.userId
      })
      toast.create('Invite created', 'success')
    } catch (e) {
      if (e) {
        console.log(e)
        toast.create(e.toString(), 'error')
      }
    }
  }

  async onClickManageBans (e) {
    try {
      await ManageBansPopup.create({
        communityId: this.userId
      })
    } catch (e) {
      // ignore
    }
  }

  onClickJoinMode (e) {
    this.communityConfigValues.joinMode = e.currentTarget.value
    this.hasChanges = true
  }

  async onSubmit (e) {
    e.preventDefault()
    e.stopPropagation()

    this.currentError = undefined
    this.isProcessing = true

    try {
      let isPending = false

      // update community settings
      if (this.isCommunity && hasChanges(this.communityConfigValues, this.communityConfig)) {
        let res = await session.ctzn.db(this.userId).method(
          'ctzn.network/community-update-config-method',
          {joinMode: this.communityConfigValues.joinMode}
        )
        isPending = isPending || res.pending()
      }

      // update profile data
      if (this.canEditProfile && hasChanges(this.values, this.profile.value)) {
        let usedSectionIds = new Set()
        for (let section of (this.values.sections || [])) {
          const baseId = (slugify(section.label) || 'section').toLocaleLowerCase()
          let id = baseId
          let n = 2
          while (usedSectionIds.has(id)) {
            id = `${baseId}-${n}`
            n++
          }
          usedSectionIds.add(baseId)
          section.id = id
        }

        // build a list of section blobs to update
        let sectionBlobUpdates = []
        for (let section of (this.values.sections || [])) {
          let oldSection = this.profile.value.sections?.find(old => old.id === section.id)
          if (!oldSection || oldSection.html !== section.html) {
            sectionBlobUpdates.push({id: section.id, html: section.html})
          }
        }

        if (this.isCitizen) {
          // upload section blobs
          for (let update of sectionBlobUpdates) {
            await session.ctzn.blob.update(
              `ui:profile:${update.id}`,
              encodeBase64(update.html),
              {mimeType: 'text/html'}
            )
          }

          // update profile record
          const record = {
            displayName: this.values.displayName,
            description: this.values.description,
            sections: this.values.sections?.length
              ? this.values.sections.map(s => ({id: s.id, label: s.label}))
              : undefined
          }
          await session.ctzn.user.table('ctzn.network/profile').create(record)
        } else if (this.isCommunity) {
          // upload section blobs to the community
          for (let update of sectionBlobUpdates) {
            let res = await session.ctzn.blob.create(
              encodeBase64(update.html),
              {mimeType: 'text/html'}
            )
            let res2 = await session.ctzn.db(this.userId).method(
              'ctzn.network/put-blob-method',
              {
                source: {
                  userId: session.info.userId,
                  dbUrl: session.info.dbUrl,
                  blobName: res.name
                },
                target: {
                  blobName: `ui:profile:${update.id}`
                }
              }
            )
            isPending = isPending || res2.pending()
          }

          // update the community profile
          const arg = {
            displayName: this.values.displayName,
            description: this.values.description,
            sections: this.values.sections?.length
              ? this.values.sections.map(s => ({id: s.id, label: s.label}))
              : undefined
          }
          let res = await session.ctzn.db(this.userId).method(
            'ctzn.network/put-profile-method',
            arg
          )
          isPending = isPending || res.pending()
        }
      }

      // update avatar
      if (this.uploadedAvatar) {
        toast.create('Uploading avatar...')
        if (this.isCitizen) {
          await uploadBlob('avatar', this.uploadedAvatar)
        } else if (this.isCommunity) {
          const blobRes = await uploadBlob(undefined, this.uploadedAvatar)
          let res = await session.ctzn.db(this.userId).method(
            'ctzn.network/put-avatar-method',
            {
              blobSource: {userId: session.info.userId, dbUrl: session.info.dbUrl},
              blobName: blobRes.name
            }
          )
          isPending = isPending || res.pending()
        }
      }

      // update banner
      if (this.uploadedBanner) {
        toast.create('Uploading banner image...')
        if (this.isCitizen) {
          await uploadBlob('profile-banner', this.uploadedBanner)
        } else if (this.isCommunity) {
          const blobRes = await uploadBlob(undefined, this.uploadedBanner)
          let res = await session.ctzn.db(this.userId).method(
            'ctzn.network/put-blob-method',
            {
              source: {
                userId: session.info.userId,
                dbUrl: session.info.dbUrl,
                blobName: blobRes.name
              },
              target: {
                blobName: 'profile-banner'
              }
            }
          )
          isPending = isPending || res.pending()
        }
      }
      if (!isPending) {
        toast.create('Profile updated', 'success')
        emit(this, 'profile-updated')
      } else {
        toast.create('Updates processing')
      }
      this.isProcessing = false
      this.hasChanges = false
    } catch (e) {
      this.isProcessing = false
      this.currentError = e.toString()
      console.error(e)
    }
  }
}

customElements.define('app-edit-profile', EditProfile)


function hasChanges (left, right) {
  let keys = Array.from(new Set(Object.keys(left).concat(Object.keys(right))))
  for (let k of keys) {
    if (typeof left[k] !== typeof right[k]) {
      return true
    }
    if (typeof left[k] === 'object' || Array.isArray(left[k])) {
      if (hasChanges(left[k], right[k])) {
        return true
      }
    }
    if (left[k] !== right[k]) {
      return true
    }
  }
  return false
}

async function uploadBlob (blobName, dataUrl) {
  let {base64buf, mimeType} = images.parseDataUrl(dataUrl)
  let res, lastError
  for (let i = 1; i < 6; i++) {
    try {
      if (blobName) {
        res = await session.ctzn.blob.update(blobName, base64buf, {mimeType})
      } else {
        res = await session.ctzn.blob.create(base64buf, {mimeType})
      }
    } catch (e) {
      lastError = e
      let shrunkDataUrl = await images.shrinkImage(dataUrl, (10 - i) / 10, mimeType)
      let parsed = images.parseDataUrl(shrunkDataUrl)
      base64buf = parsed.base64buf
      mimeType = parsed.mimeType
    }
  }
  if (!res) {
    console.error(lastError)
    throw new Error(`Failed to upload ${blobName}: ${lastError.toString()}`)
  }
  return res
}

function getByPath (obj, path) {
  for (let k of path.slice(0, -1)) {
    if (typeof obj[k] === 'object') {
      obj = obj[k]
    } else {
      return undefined
    }
  }
  return obj[path[path.length - 1]]
}

function setByPath (obj, path, v) {
  for (let k of path.slice(0, -1)) {
    if (typeof obj[k] === 'object') {
      obj = obj[k]
    } else {
      obj[k] = {}
      obj = obj[k]
    }
  }
  obj[path[path.length - 1]] = v
}