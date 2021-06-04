import {LitElement, html} from '../../vendor/lit/lit.min.js'
import toastCSS from '../../css/com/toast.css.js'

// exported api
// =

export function create (message, type = '', time = 3000, button = null) {
  // destroy existing
  destroy()

  // render toast
  document.body.appendChild(new Toast({message, type, button}))
  setTimeout(destroy, time)
}

export function destroy () {
  var toast = document.querySelector('app-toast')

  if (toast) {
    // fadeout before removing element
    toast.shadowRoot.querySelector('.toast-wrapper').classList.add('hidden')
    setTimeout(() => toast.remove(), 500)
  }
}

// internal
// =

class Toast extends LitElement {
  constructor ({message, type, button}) {
    super()
    this.message = message
    this.type = type
    this.button = button
  }

  render () {
    const onButtonClick = this.button ? (e) => {
      e.preventDefault()
      e.stopPropagation()
      destroy()
      this.button.click(e)
    } : undefined
    return html`
    <div id="toast-wrapper" class="toast-wrapper ${this.button ? '' : 'nomouse'}" @click=${destroy}>
      <p class="toast ${this.type}">${this.message} ${this.button ? html`<a class="toast-btn" @click=${onButtonClick}>${this.button.label}</a>` : ''}</p>
    </div>
    `
  }
}
Toast.styles = toastCSS

customElements.define('app-toast', Toast)
