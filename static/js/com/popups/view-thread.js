/* globals beaker */
import { html, css } from '../../../vendor/lit-element/lit-element.js'
import { BasePopup } from './base.js'
import popupsCSS from '../../../css/com/popups.css.js'
import '../thread.js'

// exported api
// =

export class ViewThreadPopup extends BasePopup {
  constructor (opts) {
    super()
    this.api = opts.api
    this.postUrl = opts.postUrl
    this.profile = opts.profile
  }

  static get properties () {
    return {
      recordUrl: {type: String}
    }
  }

  static get styles () {
    return [popupsCSS, css`
    .popup-inner {
      width: 100%;
      max-width: 700px;
      border-radius: 6px;
      overflow: visible;
    }
    .popup-inner .body {
      background: var(--bg-color--default);
      padding: 8px 10px 10px;
    }
    `]
  }

  // management
  //

  static async create (opts) {
    return BasePopup.create(ViewThreadPopup, opts)
  }

  static destroy () {
    return BasePopup.destroy('view-thread-popup')
  }

  // rendering
  // =

  renderTitle () {
    return `Thread`
  }

  renderBody () {
    return html`
      <ctzn-thread
        .api=${this.api}
        post-url=${this.postUrl}
        .profile=${this.profile}
        @load=${this.onLoadThread}
        @view-thread=${this.onViewThread}
      ></ctzn-thread>
    `
  }

  // events
  // =

  onLoadThread () {
    this.shadowRoot.querySelector('ctzn-thread').scrollHighlightedPostIntoView()
  }

  onViewThread (e) {
    this.recordUrl = e.detail.record.url
  }
}

customElements.define('view-thread-popup', ViewThreadPopup)