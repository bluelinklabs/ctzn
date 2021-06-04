import { LitElement, html } from '../../vendor/lit/lit.min.js'
import { ifDefined } from '../../vendor/lit/directives/if-defined.js'

export class Button extends LitElement {
  static get properties () {
    return {
      label: {type: String},
      icon: {type: String},
      href: {type: String},
      btnClass: {type: String, attribute: 'btn-class'},
      btnStyle: {type: String, attribute: 'btn-style'},
      disabled: {type: Boolean},
      spinner: {type: Boolean}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.btnClass = ''
    this.btnStyle = undefined
  }

  getClass () {
    let cls = this.btnClass || this.className || ''
    if (this.hasAttribute('primary')) {
      cls += ' primary'
      if (this.disabled) {
        cls += ' disabled'
      }
    } else if (this.hasAttribute('transparent')) {
      cls += ' transparent'
      if (this.disabled) {
        cls += ' disabled'
      }
    } else if (this.disabled) {
      cls = ' disabled'
    }
    
    let paddings = ''
    if (!/p(x|l|r)-/.test(cls)) paddings += 'px-4 '
    if (!/p(y|t|b)-/.test(cls)) paddings += 'py-2'

    return `${cls} ${paddings} ${this.disabled ? 'cursor-default' : ''}`
  }

  renderSpinner () {
    let colors = 'text-gray-500'
    if (this.hasAttribute('primary')) {
      colors = 'text-blue-300'
    }
    return html`<span class="spinner ${colors}"></span>`
  }

  renderLabel () {
    return html`${this.icon ? html`<span class=${this.icon}></span> ` : ''}${this.label}`
  }

  render () {
    if (this.href) {
      return html`
        <a
          href=${this.href}
          class="inline-block ${this.getClass()}"
          ?disabled=${this.disabled}
          style=${ifDefined(this.btnStyle)}
        >${this.spinner ? this.renderSpinner() : this.renderLabel()}</a>
      `
    }
    return html`
      <button
        type=${this.getAttribute('btn-type') || 'button'}
        tabindex=${this.getAttribute('tabindex')}
        class=${this.getClass()}
        ?disabled=${this.disabled}
        style=${ifDefined(this.btnStyle)}
      >${this.spinner ? this.renderSpinner() : this.renderLabel()}</button>
    `
  }
}

customElements.define('app-button', Button)
