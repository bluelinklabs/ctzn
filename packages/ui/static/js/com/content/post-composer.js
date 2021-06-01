/* globals beaker monaco */
import { LitElement, html } from '../../../vendor/lit/lit.min.js'
import { repeat } from '../../../vendor/lit/directives/repeat.js'
import { ViewPostPopup } from '../popups/view-post.js'
import * as toast from '../toast.js'
import * as session from '../../lib/session.js'
import * as images from '../../lib/images.js'
import * as videos from '../../lib/videos.js'
import bytes from '../../../vendor/bytes/index.js'
import '../button.js'

const CHAR_LIMIT = 256
const THUMB_WIDTH = 640
const MAX_THUMB_BYTE_SIZE = 256000
const MAX_ORIGINAL_BYTE_SIZE = 512000
let idCounter = 0

class PostComposer extends LitElement {
  static get properties () {
    return {
      isProcessing: {type: Boolean},
      uploadProgress: {type: Number},
      uploadTotal: {type: Number},
      audience: {type: String},
      draftText: {type: String, attribute: 'draft-text'},
      media: {type: Array},
      activeCompressionCount: {type: Number}
    }
  }

  constructor () {
    super()
    this.isProcessing = false
    this.uploadProgress = 0
    this.uploadTotal = 0
    this.placeholder = 'What\'s new?'
    this.audience = undefined
    this.draftText = ''
    this.media = []
    this.activeCompressionCount = 0
    this.activeCompressions = {}
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
    this.querySelector('#media-file-input').click()
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

        <div class="pb-1 font-medium"><span class="fas fa-users"></span> Community:</div>
        <div class="mb-4 text-lg">
          ${this.renderCommunitySelector(undefined, 'Everyone')}
          ${repeat(session.myCommunities || [], c => c, c => this.renderCommunitySelector(c, c))}
        </div>

        ${''/* TODO
        <div class="font-medium">Content warnings:</div>
        <div class="mb-4 rounded text-lg">
          <label class="whitespace-nowrap px-1 py-1 inline-block mr-0.5">
            <span class="mr-1 fas fa-check-square"></span>
            Satire
          </label>
          <label class="whitespace-nowrap px-1 py-1 inline-block mr-0.5">
            <span class="mr-1 far fa-square"></span>
            Maybe wrong
          </label>
          <label class="whitespace-nowrap px-1 py-1 inline-block mr-0.5">
            <span class="mr-1 far fa-square"></span>
            Unverified
          </label>
          <label class="whitespace-nowrap px-1 py-1 inline-block mr-0.5">
            <span class="mr-1 far fa-square"></span>
            Politics
          </label>
          <label class="whitespace-nowrap px-1 py-1 inline-block mr-0.5">
            <span class="mr-1 far fa-square"></span>
            Upsetting
          </label>
          <label class="whitespace-nowrap px-1 py-1 inline-block mr-0.5">
            <span class="mr-1 far fa-square"></span>
            NSFW
          </label>
        </div>*/}

        ${this.media.length ? html`
          ${repeat(this.media, (item, index) => item ? html`
            <div class="flex my-3 overflow-hidden rounded bg-gray-50">
              ${item.error ? html`
                <div class="error px-3 py-2">${item.error}</div>
                <div class="error px-3 py-2">
                  <a class="cursor-pointer hov:hover:underline" @click=${e => this.onClickRemoveMedia(e, index)}><span class="fas fa-times"></span></a>
                </div>
              ` : html`
                <div class="flex-1 bg-black">
                  ${item.type === 'video' ? html`
                    <video
                      autoplay
                      loop
                      playsinline
                      src=${item.blobs.original.dataUrl || item.blobs.original.objectUrl}
                      class="block mx-auto"
                    >
                  ` : html`
                    <img src=${item.blobs.original.dataUrl} class="block mx-auto">
                  `}
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
                  ${item.wasTruncated ? html`
                    <div class="text-sm pt-1 px-0.5">
                      Note: your video was shortened due to size limits.
                    </div>
                  ` : ''}
                </div>
              `}
            </div>
          ` : '')}
        ` : ''}

        <input
          id="media-file-input"
          class="hidden"
          type="file"
          accept=".jpg,.jpeg,.png,.gif,.mp4"
          multiple
          @change=${this.onChooseMediaFile}
        >

        <div class="px-1 my-3 overflow-hidden ${this.activeCompressionCount > 0 ? 'block' : 'hidden'}">
          <div class="mb-1">Compressing videos, please wait...</div>
          ${repeat(Object.entries(this.activeCompressions), ([id]) => `compression-progress-${id}`, (([id, progress]) => html`
            <div
              class="bg-blue-500"
              style="height: 2px; width: ${10 + (progress * 90)|0}%; transition: width 0.1s"
            ></div>
          `))}
        </div>

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

  renderCommunitySelector (value, label) {
    return html`
      <span
        class="post-community-select ${this.audience === value ? 'selected' : ''} whitespace-nowrap px-2 py-1 inline-block mb-1"
        @click=${e => {this.audience = value}}
      >${label}</span>
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
    this.querySelector('#media-file-input').click()
  }

  async onChooseMediaFile (e) {
    let files = Array.from(e.currentTarget.files)
    for (let file of files) {
      await this.handleMediaFile(file)
    }
  }

  onClickRemoveMedia (e, index) {
    this.media[index] = undefined
    this.requestUpdate()
  }

  async onGlobalPaste (e) {
    if (!e.clipboardData.files.length) return
    e.preventDefault()
    for (let file of Array.from(e.clipboardData.files)) {
      if (!/\.(png|jpg|jpeg|gif|mp4)$/i.test(file.name)) {
        continue
      }
      await this.handleMediaFile(file)
    }
  }

  async handleMediaFile (file) {
    if (/\.(mov|mp4)$/i.test(file.name)) {
      const id = ++idCounter
      this.activeCompressionCount = this.activeCompressionCount + 1
      this.activeCompressions[id] = 0
      const res = await videos.compressAndGetThumb(file, MAX_ORIGINAL_BYTE_SIZE, progress => {
        this.activeCompressions[id] = progress
        this.requestUpdate()
      })
      this.activeCompressionCount = this.activeCompressionCount - 1
      delete this.activeCompressions[id]

      if (res.videoBlob.size > MAX_ORIGINAL_BYTE_SIZE) {
        this.media = this.media.concat({
          error: `${file.name} is still too big after compression (${bytes(res.videoBlob.size)}), must be smaller than ${bytes(MAX_ORIGINAL_BYTE_SIZE)}`
        })
      } else {
        this.media = this.media.concat({
          type: 'video',
          caption: '',
          wasTruncated: res.wasTruncated,
          blobs: {
            thumb: {
              dataUrl: res.thumbDataUrl
            },
            original: {
              blob: res.videoBlob,
              objectUrl: res.videoBlobUrl
            }
          }
        })
      }
    } else {
      var fr = new FileReader()
      fr.onload = () => {
        this.media = this.media.concat({
          type: 'image',
          caption: '',
          blobs: {
            original: {dataUrl: fr.result}
          }
        })
      }
      fr.readAsDataURL(file)
    }
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

        if (item.type === 'video') {
          let thumbDataUrl = await images.ensureImageByteSize(item.blobs.thumb.dataUrl, MAX_THUMB_BYTE_SIZE)
          blobs[`media${i + 1}Thumb`] = parseDataUrl(thumbDataUrl)
          
          blobs[`media${i + 1}`] = {
            mimeType: item.blobs.original.blob.type,
            blob: item.blobs.original.blob
          }
        } else {
          let thumbDataUrl = await images.resizeImage(item.blobs.original.dataUrl, THUMB_WIDTH)
          thumbDataUrl = await images.ensureImageByteSize(thumbDataUrl, MAX_THUMB_BYTE_SIZE)
          blobs[`media${i + 1}Thumb`] = parseDataUrl(thumbDataUrl)
          
          let originalMimeType = images.parseDataUrl(item.blobs.original.dataUrl).mimeType
          let originalDataUrl = await images.ensureImageByteSize(item.blobs.original.dataUrl, MAX_ORIGINAL_BYTE_SIZE, originalMimeType)
          blobs[`media${i + 1}`] = parseDataUrl(originalDataUrl)
        }
      }
      res = await session.api.user.table('ctzn.network/post').createWithBlobs({
        audience: this.audience,
        text,
        media: media?.length ? media.map(item => ({type: item.type, caption: item.caption})) : undefined
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