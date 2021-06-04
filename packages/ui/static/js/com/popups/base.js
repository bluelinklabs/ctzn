import { LitElement, html } from '../../../vendor/lit/lit.min.js'

// exported api
// =

export class BasePopup extends LitElement {
  constructor () {
    super()
    this.classList.add('active-popup')

    const onGlobalKeyUp = e => {
      // listen for the escape key
      if (this.shouldCloseOnEscape && e.keyCode === 27) {
        this.onReject()
      }
    }
    const onGlobalCloseAllPopups = e => {
      this.onReject()
    }
    document.addEventListener('keyup', onGlobalKeyUp)
    document.addEventListener('close-all-popups', onGlobalCloseAllPopups)
    window.closePopup = () => this.onReject()

    // cleanup function called on cancel
    this.cleanup = () => {
      this.teardown()
      document.removeEventListener('keyup', onGlobalKeyUp)
      document.removeEventListener('close-all-popups', onGlobalCloseAllPopups)
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  teardown () {
    // overrideme
  }

  get shouldShowHead () {
    return true
  }

  get shouldCloseOnOuterClick () {
    return false
  }

  get shouldCloseOnEscape () {
    return false
  }

  get maxWidth () {
    return '450px'
  }

  get bodyClass () {
    return 'px-4 pt-4 lg:pb-4 pb-24'
  }

  // management
  //

  static async coreCreate (parentEl, Class, ...args) {
    var popupEl = new Class(...args)
    parentEl.appendChild(popupEl)

    const cleanup = () => {
      window.closePopup = undefined
      popupEl.cleanup()
      popupEl.remove()
    }

    // return a promise that resolves with resolve/reject events
    return new Promise((resolve, reject) => {
      popupEl.addEventListener('resolve', e => {
        resolve(e.detail)
        cleanup()
      })

      popupEl.addEventListener('reject', e => {
        reject()
        cleanup()
      })
    })
  }

  static async create (Class, ...args) {
    return BasePopup.coreCreate(document.body, Class, ...args)
  }

  static destroy (tagName = '.active-popup') {
    var popup = document.querySelector(tagName)
    if (popup) popup.onReject()
  }

  static getActive () {
    return document.querySelector('.active-popup')
  }

  // rendering
  // =

  render () {
    return html`
      <div
        class="popup-wrapper fixed left-0 top-0 w-full h-full z-30 overflow-y-auto"
        @click=${this.onClickWrapper}
      >
        <div class="popup-inner overflow-hidden mx-auto sm:my-10" style="max-width: ${this.maxWidth}">
          ${this.shouldShowHead ? html`
            <div class="bg-gray-100 box-border flex justify-between px-3 py-2 relative rounded-t text-gray-700 w-full">
              <span>${this.renderTitle()}</span>
              <span title="Close" @click=${this.onReject} class="close-btn cursor-pointer"><span class="fas fa-times"></span></span>
            </div>
          ` : html`
            <div class="flex justify-between box-border relative pt-4 px-5 w-full sm:hidden">
              <span title="Close" @click=${this.onReject}><span class="fas fa-angle-left text-3xl"></span></span>
              <span class="font-semibold">${this.renderTitle()}</span>
            </div>
          `}
          <div class="${this.bodyClass}">
            ${this.renderBody()}
          </div>
        </div>
      </div>
    `
  }

  renderTitle () {
    // should be overridden by subclasses
  }

  renderBody () {
    // should be overridden by subclasses
  }

  // events
  // =

  onClickWrapper (e) {
    if (e.target.classList.contains('popup-wrapper') && this.shouldCloseOnOuterClick) {
      this.onReject()
    }
  }

  onResolve (e) {
    if (e) e.preventDefault()
    this.dispatchEvent(new CustomEvent('resolve'))
  }

  onReject (e) {
    if (e) e.preventDefault()
    this.dispatchEvent(new CustomEvent('reject'))
  }
}