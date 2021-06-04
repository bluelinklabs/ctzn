import {LitElement, html} from '../../vendor/lit/lit.min.js'

/*
Usage:

<app-img-fallbacks>
  <img src="/foo.png" slot="img1">
  <img src="/bar.png" slot="img2">
  <img src="/baz.png" slot="img3">
</app-img-fallbacks>
*/

export class ImgFallbacks extends LitElement {
  static get properties () {
    return {
      id: {type: 'string'},
      currentImage: {type: Number}
    }
  }

  constructor () {
    super()
    this.currentImage = 1
  }

  updated (changedProperties) {
    if (changedProperties.has('id')) {
      this.currentImage = 1
    }
  }

  render () {
    return html`<slot name="img${this.currentImage}" @slotchange=${this.onSlotChange}></slot>`
  }

  onSlotChange (e) {
    var img = this.shadowRoot.querySelector('slot').assignedElements()[0]
    if (img) img.addEventListener('error', this.onError.bind(this))
  }

  onError (e) {
    this.currentImage = this.currentImage + 1
  }
}

customElements.define('app-img-fallbacks', ImgFallbacks)
