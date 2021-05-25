import { LitElement, html } from '../../vendor/lit/lit.min.js'
import * as session from '../lib/session.js'
import * as images from '../lib/images.js'
import { deepClone } from '../lib/functions.js'
import { emit } from '../lib/dom.js'
import {
  AVATAR_URL,
  BLOB_URL
} from '../lib/const.js'
import * as toast from './toast.js'
import './button.js'
import './code-textarea.js'
import './img-fallbacks.js'

export class EditProfile extends LitElement {
  static get properties () {
    return {
      dbKey: {type: String, attribute: 'db-key'},
      profile: {type: Object},
      _hasChanges: {type: Boolean},
      values: {type: Object},
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
    this.dbKey = undefined
    this.profile = undefined

    // UI state
    this.hasChanges = false
    this.values = undefined
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

  updated (changedProperties) {
    if (changedProperties.has('profile') && this.profile) {
      this.load()
    }
  }

  async load () {
    this.values = deepClone(this.profile.value)
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
      session.info.dbKey === this.dbKey
    )
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
                      src=${BLOB_URL(this.dbKey, 'ctzn.network/profile', 'self', 'banner')} 
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
                  src=${this.uploadedAvatar || AVATAR_URL(this.dbKey)}
                  @click=${this.onClickAvatar}
                >
              </div>
              <input id="banner-file-input" class="hidden" type="file" accept=".jpg,.jpeg,.png,.svg" @change=${this.onChooseBannerFile}>
              <input id="avatar-file-input" class="hidden" type="file" accept=".jpg,.jpeg,.png,.svg" @change=${this.onChooseAvatarFile}>
            </div>
          </div>
        </div>
      </form>
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

  async onSubmit (e) {
    e.preventDefault()
    e.stopPropagation()

    this.currentError = undefined
    this.isProcessing = true

    try {
      // update profile data
      if (this.canEditProfile && hasChanges(this.values, this.profile.value)) {
        const record = {
          displayName: this.values.displayName,
          description: this.values.description
        }
        await session.api.user.table('ctzn.network/profile').create(record)
      }

      // update avatar
      if (this.canEditProfile && this.uploadedAvatar) {
        toast.create('Uploading avatar...')
        if (this.isCitizen) {
          await images.uploadBlob('ctzn.network/profile', 'self', 'avatar', this.uploadedAvatar)
        }
      }

      // update banner
      if (this.canEditProfile && this.uploadedBanner) {
        toast.create('Uploading banner image...')
        if (this.isCitizen) {
          await images.uploadBlob('ctzn.network/profile', 'self', 'banner', this.uploadedBanner)
        }
      }
      toast.create('Profile updated', 'success')
      emit(this, 'profile-updated')
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