import { html, css } from '../../../vendor/lit-element/lit-element.js'
import { BasePopup } from './base.js'
import popupsCSS from '../../../css/com/popups.css.js'

// exported api
// =

export class EditProfilePopup extends BasePopup {
  constructor (profile) {
    super()
    this.profile = profile
  }

  // management
  //

  static async create (profile) {
    return BasePopup.create(EditProfilePopup, profile)
  }

  static destroy () {
    return BasePopup.destroy('ctzn-edit-profile')
  }

  // rendering
  // =

  renderTitle () {
    return `Edit your profile`
  }

  renderBody () {
    return html`
      <form @submit=${this.onSubmit}>      
        <div class="controls">
          <img src="/img/default-user-thumb.jpg">

          <label for="displayName-input">Display Name</label>
          <input autofocus type="text" id="displayName-input" name="displayName" value="${this.profile.displayName}" placeholder="Anonymous" />

          <label for="description-input">Bio</label>
          <textarea id="description-input" name="description">${this.profile.description}</textarea>
        </div>

        <div class="actions">
          <button type="button" class="btn ${this.isCreate ? 'hidden' : ''}" @click=${this.onReject} tabindex="2">Cancel</button>
          <button type="submit" class="btn primary" tabindex="1">Save</button>
        </div>
      </form>
    `
  }

  // events
  // =

  onSubmit (e) {
    e.preventDefault()
    e.stopPropagation()
    this.dispatchEvent(new CustomEvent('resolve', {
      detail: {
        displayName: e.target.displayName.value,
        description: e.target.description.value
      }
    }))
  }
}
EditProfilePopup.styles = [popupsCSS, css`
input,
textarea {
  font-size: 17px;
}

input {
  padding: 0 8px;
  line-height: 32px;
}

textarea {
  padding: 4px 8px;
}

img {
  display: block;
  margin: 10px auto;
  border-radius: 50%;
  height: 130px;
  width: 130px;
  object-fit: cover;
}

.controls {
  max-width: 460px;
  margin: 20px auto 40px;
}

.popup-inner {
  width: 560px;
}

.popup-inner textarea,
.popup-inner input {
  margin-bottom: 20px;
}

.popup-inner .actions {
  justify-content: space-between;
}

.hidden {
  visibility: hidden;
}
`]

customElements.define('ctzn-edit-profile', EditProfilePopup)