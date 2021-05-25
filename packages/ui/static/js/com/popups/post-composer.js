/* globals beaker */
import { html } from '../../../vendor/lit/lit.min.js'
import { BasePopup } from './base.js'
import '../button.js'
import '../content/post-composer.js'

// exported api
// =

export class PostComposerPopup extends BasePopup {
  static get properties () {
    return {
    }
  }

  constructor (opts) {
    super()
    this.intent = opts?.intent
  }

  get shouldShowHead () {
    return false
  }

  get shouldCloseOnOuterClick () {
    return false
  }

  get maxWidth () {
    return '700px'
  }

  firstUpdated () {
    if (this.intent === 'image') {
      this.querySelector('app-post-composer').triggerImageSelect()
    }
  }

  // management
  //

  static async create (opts) {
    return BasePopup.create(PostComposerPopup, opts)
  }

  static destroy () {
    return BasePopup.destroy('composer-popup')
  }

  // rendering
  // =

  renderBody () {
    return html`
      <h2 class="text-3xl py-4">Create a post</h2>
      <app-post-composer
        autofocus
        nocancel
        @cancel=${this.onReject}
        @publish=${this.onPublishPost}
      ></app-post-composer>
    `
  }

  // events
  // =

  onPublishPost (e) {
    this.dispatchEvent(new CustomEvent('resolve', {detail: e.detail}))
  }
}

customElements.define('post-composer-popup', PostComposerPopup)