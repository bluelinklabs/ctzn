/* globals beaker */
import { html } from '../../../vendor/lit/lit.min.js'
import { BasePopup } from './base.js'
import { ViewCustomHtmlPopup } from './view-custom-html.js'
import { slugify } from '../../../vendor/slugify.js'
import { encodeBase64 } from '../../lib/strings.js'
import * as session from '../../lib/session.js'
import '../rich-editor.js'

// exported api
// =

export class PageEditorPopup extends BasePopup {
  static get properties () {
    return {
      isProcessing: {type: Boolean},
      currentError: {type: String}
    }
  }

  constructor (opts) {
    super()
    this.isProcessing = false
    this.currentError = undefined
    this.userId = opts.userId
    this.pageRecord = opts.pageRecord
    this.pageContent = opts.pageContent
    this.context = opts.context
    this.contextState = opts.contextState
    this.placeholder = opts.placeholder || ''
    this.canSave = opts.canSave
  }

  get shouldShowHead () {
    return false
  }

  get shouldCloseOnEscape () {
    return false
  }

  get shouldCloseOnOuterClick () {
    return false
  }

  get maxWidth () {
    return '700px'
  }

  generateSlug () {
    const idInput = this.querySelector('input[name="id"]')
    idInput.value = slugify(this.querySelector('input[name="title"]').value).toLowerCase()
  }

  // management
  //

  static async create (opts) {
    return BasePopup.create(PageEditorPopup, opts)
  }

  static destroy () {
    return BasePopup.destroy('page-editor-popup')
  }

  // rendering
  // =

  renderBody () {
    return html`
      <input
        name="title"
        type="text"
        value=${this.pageRecord?.value?.title}
        class="block box-border w-full border border-gray-300 rounded-t p-3 font-medium text-lg"
        placeholder="Page Title"
        @change=${this.onChangeTitle}
      />
      <div
        class="border-gray-300 border-l border-r box-border flex font-medium items-center px-2 py-1 text-sm w-full"
        @click=${e => this.querySelector('input[name="id"]').focus()}
      >
        <span class="fas fa-link mr-2 sm:mr-1 mt-0.5 text-gray-600 text-xs"></span>
        <!-- <span class="text-gray-600 font-mono mobile-hidden">/${this.userId}/ctzn.network/page/</span> -->
        <span class="mr-2">Page slug:</span>
        <input
          name="id"
          type="text"
          value=${this.pageRecord?.value?.id}
          class="bg-transparent flex-1"
          placeholder="untitled"
          @change=${this.onChangeId}
        />
      </div>
      <app-rich-editor
        name="html"
        context=${this.context}
        .value=${this.pageContent}
        editor-height="calc(85vh - 100px)"
        placeholder=${this.placeholder}
      ></app-rich-editor>
      ${this.currentError ? html`
        <div class="bg-red-100 px-6 py-4 mt-2 mb-4 text-red-600">${this.currentError}</div>
      ` : ''}
      <div class="flex pt-2 pb-2">
        <app-button
          btn-class="px-3 py-1"
          @click=${this.onReject}
          label="Cancel"
        ></app-button>
        <span class="flex-1"></span>
        <app-button
          btn-class="px-3 py-1 mr-2"
          label="Preview"
          @click=${this.onClickPreview}
        ></app-button>
        <app-button
          primary
          btn-type="submit"
          btn-class="px-3 py-1"
          label="Publish"
          @click=${this.onClickSave}
          ?disabled=${!this.canSave || this.isProcessing}
          ?spinner=${this.isProcessing}
        ></app-button>
      </div>
    `
  }

  // events
  // =

  onChangeTitle (e) {
    if (!this.pageRecord) {
      this.generateSlug()
    }
  }

  onChangeId (e) {
    e.currentTarget.value = slugify(e.currentTarget.value).toLowerCase()
  }

  onClickPreview (e) {
    ViewCustomHtmlPopup.create({
      context: this.context,
      contextState: this.contextState,
      html: this.querySelector('app-rich-editor').value
    })
  }

  async onClickSave (e) {
    const values = {
      id: this.querySelector('[name="id"]').value,
      title: this.querySelector('[name="title"]').value,
      html: this.querySelector('[name="html"]').value
    }

    if (!this.canSave) {
      return
    }

    this.currentError = undefined
    this.isProcessing = true

    try {
      if (!values.id) {
        values.id = 'untitled'
      } else if (/^([a-zA-Z][a-zA-Z0-9-]{1,62}[a-zA-Z0-9])$/.test(values.id) !== true) {
        throw 'The page slug must start with a character, and can only contain characters, numbers, and dashes.'
      }

      if (!this.pageRecord) {
        // find a free ID
        const existingPages = await session.ctzn.db(this.userId).table('ctzn.network/page').list()
        const baseId = values.id
        let id = values.id
        let n = 2
        while (existingPages.find(page => page.value.id === id)) {
          id = `${baseId}-${n}`
          n++
        }
        values.id = id
      }

      const userProfile = await session.ctzn.getProfile(this.userId)
      if (!userProfile) throw new Error('Unable to load profile information needed to create this page')
      const isCommunity = userProfile.dbType === 'ctzn.network/public-community-db'

      if (isCommunity) {
        let isPending = false
        const blobRes1 = await session.ctzn.blob.create(
          encodeBase64(values.html),
          {mimeType: 'text/html'}
        )
        const blobRes2 = await session.ctzn.db(this.userId).method(
          'ctzn.network/put-blob-method',
          {
            source: {
              userId: session.info.userId,
              dbUrl: session.info.dbUrl,
              blobName: blobRes1.name
            },
            target: {
              blobName: `ui:pages:${values.id}`
            }
          }
        )
        isPending = isPending || blobRes2.pending()
        const recordRes = await session.ctzn.db(this.userId).method(
          'ctzn.network/put-page-method',
          {
            id: values.id,
            title: values.title,
            content: {
              mimeType: 'text/html',
              blobName: `ui:pages:${values.id}`
            }
          }
        )
        isPending = isPending || recordRes.pending()
        if (isPending) {
          toast.create('Updates queued, check back later')
        }
      } else {
        await session.ctzn.blob.update(
          `ui:pages:${values.id}`,
          encodeBase64(values.html),
          {mimeType: 'text/html'}
        )
        if (this.pageRecord) {
          await session.ctzn.db(this.userId).table('ctzn.network/page').create({
            id: values.id,
            title: values.title,
            content: {
              mimeType: 'text/html',
              blobName: `ui:pages:${values.id}`
            },
            updatedAt: (new Date()).toISOString(),
            createdAt: this.pageRecord.value.createdAt
          })
          if (values.id !== this.pageRecord.value.id) {
            await session.ctzn.db(this.userId).table('ctzn.network/page').delete(this.pageRecord.key)
          }
        } else {
          await session.ctzn.db(this.userId).table('ctzn.network/page').create({
            id: values.id,
            title: values.title,
            content: {
              mimeType: 'text/html',
              blobName: `ui:pages:${values.id}`
            },
            createdAt: (new Date()).toISOString()
          })
        }
      }

      this.dispatchEvent(new CustomEvent('resolve', {
        detail: {id: values.id}
      }))
    } catch (e) {
      this.currentError = e.toString()
    }

    this.isProcessing = false
  }
}

customElements.define('page-editor-popup', PageEditorPopup)