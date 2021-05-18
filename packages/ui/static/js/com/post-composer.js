/* globals beaker monaco */
import { LitElement, html } from '../../vendor/lit/lit.min.js'
import { repeat } from '../../vendor/lit/directives/repeat.js'
import { ViewPostPopup } from './popups/view-post.js'
import * as toast from './toast.js'
import * as session from '../lib/session.js'
import { AVATAR_URL } from '../lib/const.js'
import * as images from '../lib/images.js'
import * as contextMenu from './context-menu.js'
import * as displayNames from '../lib/display-names.js'
import './button.js'
import './rich-editor.js'

const CHAR_LIMIT = 256
const THUMB_WIDTH = 640

class PostComposer extends LitElement {
  static get properties () {
    return {
      isProcessing: {type: Boolean},
      uploadProgress: {type: Number},
      uploadTotal: {type: Number},
      isExtendedOpen: {type: Boolean},
      isExtendedUsingHtml: {type: Boolean},
      draftText: {type: String, attribute: 'draft-text'},
      media: {type: Array},
      community: {type: Object},
    }
  }

  constructor () {
    super()
    this.isProcessing = false
    this.uploadProgress = 0
    this.uploadTotal = 0
    this.isExtendedOpen = false
    this.isExtendedUsingHtml = false
    this.placeholder = 'What\'s new?'
    this.draftText = ''
    this.media = []
    this.community = undefined
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  get canPost () {
    return !this.isProcessing && (
      (this.draftText.length > 0 && this.draftText.length <= CHAR_LIMIT)
      || this.media.filter(Boolean).length > 0
    )
  }

  get communityName () {
    return this.community?.userId ? displayNames.render(this.community.userId) : 'Self'
  }

  get communityIcon () {
    return this.community ? html`<span class="fas fa-fw fa-users text-sm mx-1"></span>` : html`<span class="fas fa-fw fa-user text-sm ml-1"></span>`
  }

  get communityExplanation () {
    if (this.community) {
      return html`Only people in ${displayNames.render(this.community.userId)} can reply.`
    }
    return `Only people you follow can reply.`
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
        <section class="mb-2">
          <div>
            <button
              class="inline-flex items-center rounded px-3 py-1 bg-white border border-gray-300 hov:hover:bg-gray-100"
              @click=${this.onClickSelectCommunity}
            >
              Post to: ${this.communityIcon} ${this.communityName} <span class="fas fa-fw fa-caret-down"></span>
            </button>
          </div>
          <div class="community-selector-container"></div>
          <div class="p-1 pt-1.5 text-gray-500">
            ${this.communityExplanation}
          </div>
        </section>

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

        <section class="mb-2">
          <div
            class="block border border-gray-300 p-2 cursor-pointer hov:hover:bg-gray-100 ${this.isExtendedOpen ? 'rounded-0 rounded-t border-b-0' : 'rounded'}"
            @click=${this.onToggleExtendedText}
          >
            <span class="fas fa-fw fa-caret-${this.isExtendedOpen ? 'down' : 'right'}"></span>
            Extended post text
          </div>
          <div class="${this.isExtendedOpen ? '' : 'hidden'}">
            <app-rich-editor context="post" placeholder="Add more to your post! This is optional, and there's no character limit."></app-rich-editor>
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

        <div class="flex pt-3">
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

        <div class="bg-gray-100 font-medium mt-4 sm:mt-2 px-3 py-2 rounded text-center text-gray-700 text-sm">
          <span class="fas fa-fw fa-info text-gray-600"></span>
          Gentle reminder: always be kind and respectful of others!
        </div>
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

  onToggleExtendedText (e) {
    this.isExtendedOpen = !this.isExtendedOpen
  }

  onToggleExtendedUsingHtml (e) {
    this.isExtendedUsingHtml = !!e.currentTarget.checked
  }

  onClickPreview (e) {
    e.preventDefault()
    e.stopPropagation()
    ViewPostPopup.create({
      mode: 'expanded',
      post: {
        key: '',
        author: {
          userId: session.info.userId,
          displayName: session.info.displayName
        },
        value: {
          text: this.draftText,
          extendedText: this.querySelector('app-rich-editor').value,
          extendedTextMimeType: 'text/html',
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

  onCancel (e) {
    e.preventDefault()
    e.stopPropagation()
    this.draftText = ''
    this.dispatchEvent(new CustomEvent('cancel'))
  }

  onClickSelectCommunity (e) {
    e.preventDefault()
    e.stopPropagation()
    const _this = this
    const communities = session.myCommunities.slice()
    communities.sort((a, b) => a.userId.toLowerCase().localeCompare(b.userId.toLowerCase()))
    contextMenu.create({
      parent: this.querySelector('.community-selector-container'),
      x: 0,
      y: 0,
      render () {
        return html`
          <div class="dropdown-items left no-border" style="padding: 4px 0; max-height: 50vh; overflow-y: scroll">
            <div class="section-header small light">
              My Profile
            </div>
            <div class="dropdown-item" @click=${e => {_this.community = undefined; this.destroy()}}>
              <div class="img-wrapper">
                <img class="rounded" src=${AVATAR_URL(session.info.userId)}>
                <div>
                  <div class="label truncate">
                    ${displayNames.render(session.info.userId)}
                  </div>
                  <div class="description truncate">${session.info.userId}</div>
                </div>
              </div>
            </div>
            ${session.myCommunities.length ? html`
              <hr>
              <div class="section-header small light">
                My Communities
              </div>
              ${repeat(communities, community => html`
                <div class="dropdown-item"  @click=${e => {_this.community = community; this.destroy()}}>
                  <div class="img-wrapper">
                    <img class="rounded" src=${AVATAR_URL(community.userId)}>
                    <div>
                      <div class="label truncate">
                        ${displayNames.render(community.userId)}
                      </div>
                      <div class="description truncate">${community.userId}</div>
                    </div>
                  </div>
                </div>
              `)}
            ` : ''}
          </div>
        `
      }
    })
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

    // upload media
    for (let i = 0; i < this.media.length; i++) {
      try {
        let item = this.media[i]
        if (!item) continue // happens if the item was removed

        item.caption = document.getElementById(`media-caption-${i}`).value || undefined
        if (!item.blobs.thumb?.blobName && item.blobs.original?.dataUrl) {
          let thumbDataUrl = await images.resizeImage(item.blobs.original.dataUrl, THUMB_WIDTH)
          let thumbData = parseDataUrl(thumbDataUrl)
          let res = await session.ctzn.blob.create(thumbData.base64buf, {mimeType: thumbData.mimeType})
          item.blobs.thumb = {
            blobName: res.name,
            mimeType: thumbData.mimeType
          }
        }
        if (!item.blobs.original?.blobName) {
          let originalData = parseDataUrl(item.blobs.original.dataUrl)
          let originalMimeType = originalData.mimeType
          let res
          let lastError
          for (let i = 1; i < 6; i++) {
            try {
              res = await session.ctzn.blob.create(originalData.base64buf, {mimeType: originalData.mimeType})
            } catch (e) {
              lastError = e
              let dataUrl = await images.shrinkImage(item.blobs.original.dataUrl, (10 - i) / 10, originalMimeType)
              originalData = parseDataUrl(dataUrl)
            }
          }
          if (!res) throw lastError
          item.blobs.original = {
            blobName: res.name,
            mimeType: originalData.mimeType
          }
        }

        this.uploadProgress++
      } catch (e) {
        this.isProcessing = false
        toast.create(e.message, 'error')
        console.log(e)
        return
      }
    }

    let res
    try {
      let media = this.media.filter(Boolean)
      let text = this.querySelector('#text').value
      let extendedText = this.querySelector('app-rich-editor').value.trim()
      let extendedTextMimeType = !!extendedText ? 'text/html' : undefined
      res = await session.ctzn.user.table('ctzn.network/post').create({
        text,
        media: media?.length ? media : undefined,
        extendedText,
        extendedTextMimeType,
        community: this.community
      })
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