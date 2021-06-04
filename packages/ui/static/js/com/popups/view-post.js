/* globals beaker */
import { html } from '../../../vendor/lit/lit.min.js'
import { BasePopup } from './base.js'
import '../content/post.js'

// exported api
// =

export class ViewPostPopup extends BasePopup {
  static get properties () {
    return {
    }
  }

  constructor (opts) {
    super()
    this.post = opts.post
    this.mode = opts.mode
  }

  get shouldShowHead () {
    return false
  }

  get shouldCloseOnEscape () {
    return true
  }

  get shouldCloseOnOuterClick () {
    return true
  }

  get maxWidth () {
    return '710px'
  }

  get bodyClass () {
    return ''
  }

  // management
  //

  static async create (opts) {
    return BasePopup.create(ViewPostPopup, opts)
  }

  static destroy () {
    return BasePopup.destroy('view-post-popup')
  }

  // rendering
  // =

  renderBody () {
    return html`
      <div class="overflow-auto" style="max-height: calc(100vh - 100px)">
        <app-post
          mode=${this.mode}
          .post=${this.post}
          .renderOpts=${{noclick: true, preview: true}}
        ></app-post>
      </div>
    `
  }
}

customElements.define('view-post-popup', ViewPostPopup)