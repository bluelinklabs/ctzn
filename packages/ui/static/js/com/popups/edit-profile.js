import { html } from '../../../vendor/lit/lit.min.js'
import { BasePopup } from './base.js'
import { AVATAR_URL, BLOB_URL } from '../../lib/const.js'
import '../button.js'
import '../img-fallbacks.js'

// exported api
// =

export class EditProfilePopup extends BasePopup {
  constructor (userId, profile) {
    super()
    this.userId = userId
    this.profile = profile
    this.img = undefined
    this.uploadedAvatar = undefined
    this.uploadedBanner = undefined
  }

  // management
  //

  static async create (userId, profile) {
    return BasePopup.create(EditProfilePopup, userId, profile)
  }

  static destroy () {
    return BasePopup.destroy('app-edit-profile')
  }

  // rendering
  // =

  renderTitle () {
    return `Edit your profile`
  }

  renderBody () {
    return html`
      <form @submit=${this.onSubmit}>      
        <div style="height: 190px">
          <div style="height: 130px">
            ${!this.uploadedBanner ? html`
              <app-img-fallbacks>
                <img
                  slot="img1"
                  class="block rounded w-full object-cover cursor-pointer hov:hover:opacity-50"
                  style="height: 130px"
                  src=${BLOB_URL(this.userId, 'profile-banner')} 
                  @click=${this.onClickBanner}
                >
                <div
                  slot="img2"
                  class="block rounded cursor-pointer hov:hover:opacity-50"
                  style="height: 130px; background: linear-gradient(0deg, #3c4af6, #2663eb);"
                  @click=${this.onClickBanner}
                ></div>
              </app-img-fallbacks>
            ` : html`
              <img
                class="block rounded w-full object-cover cursor-pointer hov:hover:opacity-50"
                style="height: 130px"
                src=${this.uploadedBanner} 
                @click=${this.onClickBanner}
              >
            `}
          </div>
          <div
            class="relative bg-white rounded-3xl shadow-md"
            style="
              top: -100px;
              left: 50%;
              transform: translateX(-50%);
              width: 150px;
              height: 150px
            "
          >
            <img 
              class="block mx-auto border-4 border-white rounded-3xl object-cover cursor-pointer hov:hover:opacity-50"
              style="width: 150px; height: 150px;"
              src=${this.uploadedAvatar || AVATAR_URL(this.userId)}
              @click=${this.onClickAvatar}
            >
          </div>
        </div>
        <input id="banner-file-input" class="hidden" type="file" accept=".jpg,.jpeg,.png,.svg" @change=${this.onChooseBannerFile}>
        <input id="avatar-file-input" class="hidden" type="file" accept=".jpg,.jpeg,.png,.svg" @change=${this.onChooseAvatarFile}>

        <label class="block font-semibold p-1" for="displayName-input">Display Name</label>
        <input
          autofocus
          type="text"
          id="displayName-input"
          name="displayName"
          value="${this.profile.displayName}"
          class="block box-border w-full border border-gray-300 rounded p-3 mb-1"
          placeholder="Anonymous"
        />

        <label class="block font-semibold p-1" for="description-input">Bio</label>
        <textarea
          id="description-input"
          name="description"
          class="block box-border w-full border border-gray-300 rounded p-3"
        >${this.profile.description}</textarea>

        <div class="flex justify-between mt-4">
          <app-button @click=${this.onReject} tabindex="3" label="Cancel"></app-button>
          <app-button
            primary
            btn-type="submit"
            tabindex="2"
            label="Save"
          ></app-button>
        </div>
      </form>
    `
  }

  // events
  // =

  onClickBanner (e) {
    e.preventDefault()
    this.querySelector('#banner-file-input').click()
  }

  onChooseBannerFile (e) {
    var file = e.currentTarget.files[0]
    if (!file) return
    var fr = new FileReader()
    fr.onload = () => {
      this.uploadedBanner = fr.result
      this.requestUpdate()
    }
    fr.readAsDataURL(file)
  }

  onClickAvatar (e) {
    e.preventDefault()
    this.querySelector('#avatar-file-input').click()
  }

  onChooseAvatarFile (e) {
    var file = e.currentTarget.files[0]
    if (!file) return
    var fr = new FileReader()
    fr.onload = () => {
      this.uploadedAvatar = fr.result
      this.requestUpdate()
    }
    fr.readAsDataURL(file)
  }

  onSubmit (e) {
    e.preventDefault()
    e.stopPropagation()

    this.dispatchEvent(new CustomEvent('resolve', {
      detail: {
        profile: {
          displayName: e.target.displayName.value,
          description: e.target.description.value
        },
        uploadedAvatar: this.uploadedAvatar,
        uploadedBanner: this.uploadedBanner
      }
    }))
  }
}

customElements.define('app-edit-profile', EditProfilePopup)