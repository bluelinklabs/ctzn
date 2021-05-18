import { LitElement, html } from '../../vendor/lit/lit.min.js'

export class Iframe extends LitElement {
  static get properties () {
    return {
      src: {type: String},
      isActivated: {type: Boolean}
    }
  }

  constructor () {
    super()
    this.setAttribute('ctzn-elem', '1')
    this.src = undefined
    this.isActivated = false
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  render () {
    return html`
      ${this.isActivated ? html`
        <div class="iframe-sizer bg-white sm:rounded">
          <iframe
            src=${this.src}
            allow="autoplay;camera;encrypted-media;fullscreen;microphone;midi;payment;usb;web-share"
            sandbox="allow-downloads allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
          ></iframe>
        </div>
      ` : html`
        <div class="bg-white py-2 px-3 hov:hover:bg-gray-50 sm:rounded cursor-pointer" @click=${this.onClickActivate}>
          <div><span class="fas fa-play fa-fw"></span> Click to activate embed</div>
          <div class="text-sm text-gray-500">${this.src}</div>
        </div>
      `}
    `
  }

  onClickActivate () {
    this.isActivated = true
  }
}

customElements.define('ctzn-iframe', Iframe)