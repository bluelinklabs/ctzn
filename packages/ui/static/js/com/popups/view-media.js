/* globals beaker */
import { html } from '../../../vendor/lit/lit.min.js'
import { BasePopup } from './base.js'
import * as gestures from '../../lib/gestures.js'

// exported api
// =

export class ViewMediaPopup extends BasePopup {
  static get properties () {
    return {
      url: {type: String}
    }
  }

  constructor (opts) {
    super()
    this.url = opts.url
    this.urls = opts.urls
    this.oldGestures = gestures.setCurrentNav(dir => this.move(dir))
    document.body.classList.add('overflow-hidden')
  }

  teardown () {
    document.body.classList.remove('overflow-hidden')
    if (this.oldGestures) {
      gestures.setCurrentNav(this.oldGestures)
    }
  }

  get currentIndex () {
    if (!this.urls) return 1
    return this.urls.indexOf(this.url) + 1
  }

  get isLeftMost () {
    return this.currentIndex === 1
  }

  get isRightMost () {
    return !this.urls || this.currentIndex === this.urls.length
  }

  move (dir) {
    if (!this.urls) return
    let current = this.urls.indexOf(this.url)
    if (dir === -1) {
      if (current > 0) {
        this.url = this.urls[current - 1]
      }
    } else if (dir === 1) {
      if (current < this.urls.length - 1) {
        this.url = this.urls[current + 1]
      }
    }
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
    return BasePopup.create(ViewMediaPopup, opts)
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
        style="background: #000d"
        @click=${this.onClickWrapper}
      >
        <span
          title="Close"
          @click=${this.onReject}
          class="absolute bg-white close-btn cursor-pointer px-2 rounded text-3xl text-black z-50"
          style="top: 10px; right: 15px"
        >
          <span class="fas fa-times"></span>
        </span>
        <div class="flex flex-col w-full h-full items-center justify-center" @click=${this.onReject}>
          <div class="flex items-center mb-1">
            <div class="block sm:hidden text-white text-3xl px-10 cursor-pointer ${this.isLeftMost ? 'opacity-20' : ''}" @click=${e => this.onClickDir(e, -1)}>
              <span class="fas fa-angle-left"></span>
            </div>
            <div class="text-white text-lg">${this.currentIndex} / ${this.urls?.length || 1}</div>
            <div class="block sm:hidden text-white text-3xl px-10 cursor-pointer ${this.isRightMost ? 'opacity-20' : ''}" @click=${e => this.onClickDir(e, 1)}>
              <span class="fas fa-angle-right"></span>
            </div>
          </div>
          <div class="flex items-center">
            <div class="hidden sm:block text-white text-3xl px-10 cursor-pointer ${this.isLeftMost ? 'opacity-20' : ''}" @click=${e => this.onClickDir(e, -1)}>
              <span class="fas fa-angle-left"></span>
            </div>
            <img class="block border border-white shadow-lg" src=${this.url}>
            <div class="hidden sm:block text-white text-3xl px-10 cursor-pointer ${this.isRightMost ? 'opacity-20' : ''}" @click=${e => this.onClickDir(e, 1)}>
              <span class="fas fa-angle-right"></span>
            </div>
          </div>
        </div>
      </div>
    `
  }

  // events
  // =

  onClickDir (e, dir) {
    e.preventDefault()
    e.stopPropagation()
    this.move(dir)
  }
}

customElements.define('view-media-popup', ViewMediaPopup)