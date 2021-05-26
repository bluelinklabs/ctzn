/* globals beaker monaco */
import { LitElement, html } from '../../../vendor/lit/lit.min.js'
import { repeat } from '../../../vendor/lit/directives/repeat.js'
import { ViewPostPopup } from '../popups/view-post.js'
import * as toast from '../toast.js'
import * as session from '../../lib/session.js'
import * as images from '../../lib/images.js'
import '../button.js'

const CHAR_LIMIT = 256
const THUMB_WIDTH = 640
const MAX_THUMB_BYTE_SIZE = 256000
const MAX_ORIGINAL_BYTE_SIZE = 512000

class PostComposer extends LitElement {
  static get properties () {
    return {
      isProcessing: {type: Boolean},
      uploadProgress: {type: Number},
      uploadTotal: {type: Number},
      draftText: {type: String, attribute: 'draft-text'},
      media: {type: Array}
    }
  }

  constructor () {
    super()
    this.isProcessing = false
    this.uploadProgress = 0
    this.uploadTotal = 0
    this.placeholder = 'What\'s new?'
    this.draftText = ''
    this.media = []
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  connectedCallback () {
    super.connectedCallback()
    this.$onGlobalPaste = this.$onGlobalPaste || this.onGlobalPaste.bind(this)
    document.addEventListener('paste', this.$onGlobalPaste)
  }

  disconnectedCallback () {
    super.disconnectedCallback()
    document.removeEventListener('paste', this.$onGlobalPaste)
  }

  get canPost () {
    return !this.isProcessing && (
      (this.draftText.length > 0 && this.draftText.length <= CHAR_LIMIT)
      || this.media.filter(Boolean).length > 0
    )
  }

  firstUpdated () {
    if (this.autofocus) {
      this.querySelector('textarea').focus()
    }
  }

  get charLimitClass () {
    if (this.draftText.length > CHAR_LIMIT) {
      return 'font-semibold text-red-600'
    }
    if (this.draftText.length > CHAR_LIMIT - 50) {
      return 'font-semibold text-yellow-500'
    }
    return 'text-gray-500'
  }

  async triggerImageSelect () {
    await this.requestUpdate()
    this.querySelector('#image-file-input').click()
  }

  // rendering
  // =

  render () {
    return html`
      <form @submit=${this.onSubmit}>
        <section class="mb-3">
          <textarea
            id="text"
            class="py-2 px-3 w-full h-32 sm:h-20 box-border resize-y text-lg border border-gray-300 rounded"
            placeholder="What's new?"
            @keyup=${this.onTextareaKeyup}
            @change=${this.onTextareaKeyup}
            @keydown=${this.onTextareaKeydown}
          ></textarea>
          <div>
            <span class="px-2 ${this.charLimitClass}">
              ${this.draftText.length} / ${CHAR_LIMIT}
            </span>
          </div>
        </section>

        ${this.media.length ? html`
          ${repeat(this.media, (item, index) => item ? html`
            <div class="flex my-3 overflow-hidden rounded bg-gray-50">
              <div class="flex-1 bg-black">
                <img
                  src=${item.blobs.original.dataUrl}
                  class="block mx-auto"
                >
              </div>
              <div class="flex-1 p-4">
                <label class="block box-border mb-1 w-full" for="media-caption-${index}">Caption</label>
                <input
                  class="block border border-gray-300 box-border mb-1 px-3 py-2 rounded w-full"
                  id="media-caption-${index}"
                  placeholder="Optional"
                >
                <div class="text-sm px-0.5">
                  <a class="text-blue-600 cursor-pointer hov:hover:underline" @click=${e => this.onClickRemoveMedia(e, index)}>Remove</a>
                </div>
              </div>
            </div>
          ` : '')}
        ` : ''}

        <input
          id="image-file-input"
          class="hidden"
          type="file"
          accept=".jpg,.jpeg,.png"
          multiple
          @change=${this.onChooseImageFile}
        >

        <div class="flex">
          <app-button
            transparent
            btn-class="hidden sm:block"
            label="Cancel"
            @click=${this.onCancel}
          ></app-button>
          <div class="flex-1"></div>
          <app-button
            transparent
            btn-class="mr-3 sm:mr-0 px-2 sm:px-4"
            icon="far fa-image"
            label="Add Image"
            @click=${this.onClickAddImage}
          ></app-button>
          <app-button
            transparent
            btn-class="mr-6 sm:mr-4 px-2 sm:px-4"
            label="Preview"
            @click=${this.onClickPreview}
          ></app-button>
          <app-button
            primary
            btn-type="submit"
            ?disabled=${!this.canPost}
            ?spinner=${this.isProcessing}
            tabindex="1"
            label="Create Post"
          ></app-button>
        </div>

        ${this.isProcessing && this.uploadTotal > 0 ? html`
          <div class="bg-gray-100 mt-3 rounded overflow-hidden">
            <div
              class="bg-blue-500"
              style="height: 2px; width: ${10 + (this.uploadProgress / this.uploadTotal * 90)|0}%; transition: width 0.1s"
            ></div>
          </div>
        ` : ''}
      </form>
    `
  }
  
  // events
  // =

  onTextareaKeyup (e) {
    this.draftText = e.currentTarget.value
  }

  onTextareaKeydown (e) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      this.onSubmit()
    }
  }

  onClickPreview (e) {
    e.preventDefault()
    e.stopPropagation()
    ViewPostPopup.create({
      mode: 'expanded',
      post: {
        key: '',
        author: {
          dbKey: session.info.dbKey,
          displayName: session.info.displayName
        },
        value: {
          text: this.draftText,
          media: this.media,
          createdAt: (new Date()).toISOString()
        }
      }
    })
  }

  onClickAddImage (e) {
    this.querySelector('#image-file-input').click()
  }

  onChooseImageFile (e) {
    Array.from(e.currentTarget.files).forEach(file => {
      var fr = new FileReader()
      fr.onload = () => {
        this.media = this.media.concat({
          caption: '',
          blobs: {
            original: {dataUrl: fr.result}
          }
        })
      }
      fr.readAsDataURL(file)
    })
  }

  onClickRemoveMedia (e, index) {
    this.media[index] = undefined
    this.requestUpdate()
  }

  onGlobalPaste (e) {
    if (!e.clipboardData.files.length) return
    e.preventDefault()
    for (let file of Array.from(e.clipboardData.files)) {
      if (!/\.(png|jpg|jpeg|gif)$/.test(file.name)) {
        continue
      }
      var fr = new FileReader()
      fr.onload = () => {
        this.media = this.media.concat({
          caption: '',
          blobs: {
            original: {dataUrl: fr.result}
          }
        })
      }
      fr.readAsDataURL(file)
    }
    // console.log(e.clipboardData.files)
  }

  onCancel (e) {
    e.preventDefault()
    e.stopPropagation()
    this.draftText = ''
    this.dispatchEvent(new CustomEvent('cancel'))
  }

  async onSubmit (e) {
    e?.preventDefault()
    e?.stopPropagation()

    if (!this.canPost) {
      return
    }

    this.isProcessing = true
    this.uploadProgress = 0
    this.uploadTotal = this.media.filter(Boolean).length

    let res
    try {
      let media = this.media.filter(Boolean)
      let text = this.querySelector('#text').value
      let blobs = {}
      for (let i = 0; i < (media?.length || 0); i++) {
        const item = media[i]

        let thumbDataUrl = await images.resizeImage(item.blobs.original.dataUrl, THUMB_WIDTH)
        thumbDataUrl = await images.ensureImageByteSize(thumbDataUrl, MAX_THUMB_BYTE_SIZE)
        blobs[`media${i + 1}Thumb`] = parseDataUrl(thumbDataUrl)
        
        let originalMimeType = images.parseDataUrl(item.blobs.original.dataUrl).mimeType
        let originalDataUrl = await images.ensureImageByteSize(item.blobs.original.dataUrl, MAX_ORIGINAL_BYTE_SIZE, originalMimeType)
        blobs[`media${i + 1}`] = parseDataUrl(originalDataUrl)
      }
      res = await session.api.user.table('ctzn.network/post').createWithBlobs({
        text,
        media: media?.length ? media.map(item => ({caption: item.caption})) : undefined
      }, blobs)
    } catch (e) {
      this.isProcessing = false
      toast.create(e.message, 'error')
      console.log(e)
      return
    }
    
    this.draftText = ''
    this.dispatchEvent(new CustomEvent('publish', {detail: res}))
  }
}

customElements.define('app-post-composer', PostComposer)

function parseDataUrl (url) {
  const [prelude, base64buf] = url.split(',')
  const mimeType = /data:([^\/]+\/[^;]+)/.exec(prelude)[1]
  return {mimeType, base64buf}
}