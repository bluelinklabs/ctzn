import {LitElement, html, css} from '../../vendor/lit-element/lit-element.js'

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
Toast.styles = css`
:host {
  --toast-min-width: 350px;
  --toast-padding: 10px 15px;
  --toast-font-size: 16px;
}

.toast-wrapper {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 20000;
  transition: opacity 0.1s ease;
}
.toast-wrapper.hidden {
  opacity: 0;
}
.toast {
  position: relative;
  min-width: min(calc(100% - 40px), var(--toast-min-width));
  max-width: min(450px, calc(100vw - 70px));
  background: #ddd;
  margin: 0;
  padding: var(--toast-padding);
  border-radius: 4px;
  font-size: var(--toast-font-size);
  color: #fff;
  background: rgba(0, 0, 0, 0.75);
  -webkit-font-smoothing: antialiased;
  font-weight: 600;
  box-sizing: border-box;
}
.toast.error {
  padding-left: 38px;
}
.toast.success {
  padding-left: 48px;
}
.toast.success:before,
.toast.error:before {
  position: absolute;
  left: 18px;
  top: 5px;
  display: block;
  font-family: -apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", Ubuntu, Cantarell, "Oxygen Sans", "Helvetica Neue", sans-serif;
  font-size: 22px;
  font-weight: bold;
}
.toast.primary {
  background: var(--color-blue);
}
.toast.success {
  background: #26b33e;
}
.toast.success:before {
  content: '✓';
}
.toast.error {
  background: #c72e25;
}
.toast.error:before {
  content: '!';
}
.toast .toast-btn {
  position: absolute;
  right: 15px;
  color: inherit;
  text-decoration: underline;
  cursor: pointer;
}
`

customElements.define('app-toast', Toast)
