/* globals beaker */
import { html } from '../../../vendor/lit/lit.min.js'
import { BasePopup } from './base.js'
import { ViewCustomHtmlPopup } from './view-custom-html.js'
import '../rich-editor.js'

// exported api
// =

export class UiEditorPopup extends BasePopup {
  static get properties () {
    return {
    }
  }

  constructor (opts) {
    super()
    this.label = opts.label
    this.context = opts.context
    this.contextState = opts.contextState
    this.value = opts.value
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

  // management
  //

  static async create (opts) {
    return BasePopup.create(UiEditorPopup, opts)
  }

  static destroy () {
    return BasePopup.destroy('ui-editor-popup')
  }

  // rendering
  // =

  renderBody () {
    return html`
      <input
        name="label"
        type="text"
        value="${this.label}"
        class="block box-border w-full border border-gray-300 rounded p-3 mb-1 font-medium text-lg"
        placeholder="Section name"
      />
      <app-rich-editor
        name="html"
        context=${this.context}
        .value=${this.value}
        editor-height="calc(85vh - 100px)"
        placeholder=${this.placeholder}
      ></app-rich-editor>
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
          label="OK"
          @click=${this.onClickOK}
          ?disabled=${!this.canSave}
        ></app-button>
      </div>
    `
  }

  // events
  // =

  onClickPreview (e) {
    ViewCustomHtmlPopup.create({
      context: this.context,
      contextState: this.contextState,
      html: this.querySelector('app-rich-editor').value
    })
  }

  onClickOK (e) {
    this.dispatchEvent(new CustomEvent('resolve', {
      detail: {
        label: this.querySelector('[name="label"]').value,
        html: this.querySelector('[name="html"]').value
      }
    }))
  }
}

customElements.define('ui-editor-popup', UiEditorPopup)