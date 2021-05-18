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
    let parentClass = this.btnClass || this.className || ''
    let colors = 'bg-white hov:hover:bg-gray-100'
    if (this.hasAttribute('primary')) {
      colors = 'bg-blue-600 text-white hov:hover:bg-blue-700'
      if (this.disabled) {
        colors = 'bg-blue-400 text-blue-50'
      }
    } else if (this.hasAttribute('transparent')) {
      colors = 'hov:hover:bg-gray-100'
      if (this.disabled) {
        colors = 'bg-gray-100'
      }
    } else if (this.hasAttribute('color')) {
      const color = this.getAttribute('color')
      colors = `bg-${color}-600 text-white hov:hover:bg-${color}-700`
      if (this.disabled) {
        colors = `bg-${color}-400 text-${color}-50`
      }
    } else if (this.disabled) {
      colors = 'bg-gray-100 text-gray-500'
    }
    
    let paddings = ''
    if (!/p(x|l|r)-/.test(parentClass)) paddings += 'px-4 '
    if (!/p(y|t|b)-/.test(parentClass)) paddings += 'py-2'

    let shadow = 'shadow-sm'
    let borders = `border border-gray-300`
    if (/border/.test(parentClass)) borders = ''
    else if (this.hasAttribute('primary')) borders = 'border border-blue-800'
    else if (this.hasAttribute('transparent')) { borders = ''; shadow = '' }
    else if (this.hasAttribute('color')) borders = `border border-${this.getAttribute('color')}-800`
    return `rounded ${colors} ${paddings} ${borders} ${shadow} ${parentClass} ${this.disabled ? 'cursor-default' : ''}`
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
