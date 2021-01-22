import { html, css } from '../../../vendor/lit-element/lit-element.js'
import { BasePopup } from './base.js'
import popupsCSS from '../../../css/com/popups.css.js'

const CANVAS_SIZE = 200

// exported api
// =

export class EditProfilePopup extends BasePopup {
  constructor (userId, profile) {
    super()
    this.userId = userId
    this.profile = profile
    this.zoom = 1
    this.img = undefined
    this.uploadedAvatar = undefined
    this.loadImg(`${location.origin}/${userId}/avatar`)
  }

  loadImg (url) {
    this.zoom = 1
    this.img = document.createElement('img')
    this.img.src = url
    this.img.onload = () => {
      var smallest = (this.img.width < this.img.height) ? this.img.width : this.img.height
      this.zoom = CANVAS_SIZE / smallest
      this.updateCanvas()
    }
  }

  updateCanvas () {
    var canvas = this.shadowRoot.getElementById('avatar-canvas')
    if (canvas) {
      var ctx = canvas.getContext('2d')
      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
      ctx.save()
      ctx.scale(this.zoom, this.zoom)
      ctx.drawImage(this.img, 0, 0, this.img.width, this.img.height)
      ctx.restore()
    }
  }

  // management
  //

  static async create (userId, profile) {
    return BasePopup.create(EditProfilePopup, userId, profile)
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
          <canvas id="avatar-canvas" width=${CANVAS_SIZE} height=${CANVAS_SIZE} @click=${this.onClickAvatar}></canvas>
          <div class="change-avatar">
            <button class="btn" tabindex="1" @click=${this.onClickAvatar}>Change Avatar</button>
            <input type="file" accept=".jpg,.jpeg,.png" @change=${this.onChooseAvatarFile}>
          </div>

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

  async onClickAvatar (e) {
    e.preventDefault()
    this.shadowRoot.querySelector('input[type="file"]').click()
  }

  onChooseAvatarFile (e) {
    var file = e.currentTarget.files[0]
    if (!file) return
    var fr = new FileReader()
    fr.onload = () => {
      var ext = file.name.split('.').pop()
      this.loadImg(fr.result)
      var base64buf = fr.result.split(',').pop()
      this.uploadedAvatar = {ext, base64buf}
    }
    fr.readAsDataURL(file)
  }

  onSubmit (e) {
    e.preventDefault()
    e.stopPropagation()

    let uploadedAvatar = undefined
    if (this.uploadedAvatar) {
      let dataUrl = this.shadowRoot.getElementById('avatar-canvas').toDataURL()
      this.uploadedAvatar.ext = 'png'
      this.uploadedAvatar.base64buf = dataUrl.split(',').pop()
    }

    this.dispatchEvent(new CustomEvent('resolve', {
      detail: {
        profile: {
          displayName: e.target.displayName.value,
          description: e.target.description.value
        },
        uploadedAvatar: this.uploadedAvatar
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

canvas {
  display: block;
  margin: 10px auto;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  cursor: pointer;
}

canvas:hover {
  opacity: 0.5;
}

.change-avatar {
  text-align: center;
  margin-bottom: 10px;
}

input[type="file"] {
  display: none;
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