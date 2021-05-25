/* globals beaker */
import { BasePopup } from './base.js'

// exported api
// =

export class GeneralPopup extends BasePopup {
  static get properties () {
    return {
    }
  }

  constructor (opts) {
    super()
    this.customMaxWidth = opts.maxWidth
    this.customBodyClass = opts.bodyClass
    this.customFirstUpdated = opts.firstUpdated
    this.customRender = opts.render
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
    return this.customMaxWidth || '710px'
  }

  get bodyClass () {
    if (this.customBodyClass) {
      return this.customBodyClass
    }
    return 'px-4 pt-4 lg:pb-4 pb-24'
  }

  firstUpdated () {
    super.firstUpdated()
    this.customFirstUpdated?.()
  }

  // management
  //

  static async create (opts) {
    return BasePopup.create(GeneralPopup, opts)
  }

  static destroy () {
    return BasePopup.destroy('general-popup')
  }

  // rendering
  // =

  renderBody () {
    return this.customRender.call(this)
  }
}

customElements.define('general-popup', GeneralPopup)