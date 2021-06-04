/* globals beaker */
import { html } from '../../../vendor/lit/lit.min.js'
import { BasePopup } from './base.js'
import * as gestures from '../../lib/gestures.js'
import '../content/posts-dashboard.js'

// exported api
// =

export class PostsDashboardPopup extends BasePopup {
  constructor () {
    super()
    document.body.classList.add('overflow-hidden')
  }

  teardown () {
    document.body.classList.remove('overflow-hidden')
  }

  get shouldShowHead () {
    return false
  }

  get shouldCloseOnOuterClick () {
    return true
  }

  get shouldCloseOnEscape () {
    return true
  }

  // management
  //

  static async create (opts) {
    return BasePopup.create(PostsDashboardPopup, opts)
  }

  static destroy () {
    return BasePopup.destroy('view-media-popup')
  }

  // rendering
  // =

  render () {
    return html`
      <div
        class="popup-wrapper fixed left-0 top-0 w-full h-full z-50 overflow-y-auto"
        style="background: var(--theme-bg)"
        @click=${this.onClickWrapper}
      >
        <app-posts-dashboard></app-posts-dashboard>
      </div>
    `
  }
}

customElements.define('posts-dashboard-popup', PostsDashboardPopup)