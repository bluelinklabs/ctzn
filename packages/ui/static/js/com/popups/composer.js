/* globals beaker */
import { html } from '../../../vendor/lit/lit.min.js'
import { BasePopup } from './base.js'
import * as session from '../../lib/session.js'
import '../button.js'
import '../post-composer.js'

// exported api
// =

export class ComposerPopup extends BasePopup {
  static get properties () {
    return {
    }
  }

  constructor (opts) {
    super()
    this.community = opts?.community
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
    return BasePopup.create(ComposerPopup, opts)
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
        .community=${this.community}
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

customElements.define('composer-popup', ComposerPopup)