import { LitElement, html } from '../../vendor/lit/lit.min.js'
import { Behave, BehaveHooks } from '../../vendor/behave.js'

BehaveHooks.add(['keydown'], function(data){
  autosizeTextarea(data.editor.element, data.lines.total)
});

function autosizeTextarea (el, numLines = undefined) {
  el.style.height = Math.max(numLines * 21, 80)+'px'
}

function countNewlines (el) {
  return el.value.split('\n').length
}

export class CodeTextarea extends LitElement {
  static get properties () {
    return {
      textareaClass: {type: String, attribute: 'textarea-class'},
      value: {type: String},
      disabled: {type: Boolean}
    }
  }
  
  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.behave = undefined
    this.textareaClass = ''
    this.value = ''
    this.disabled = false
  }

  async connectedCallback () {
    super.connectedCallback()
    await this.updateComplete
    if (!this.behave) {
      const el = this.querySelector('textarea')
      this.behave = new Behave({
        textarea: el,
        replaceTab: true,
        softTabs: true,
        tabSize: 2,
        autoOpen: true,
        overwrite: true,
        autoStrip: true,
        autoIndent: true,
        fence: false
      })
      autosizeTextarea(el, countNewlines(el))
    }
  }

  disconnectedCallback () {
    super.disconnectedCallback()
    this.behave?.destroy?.()
  }

  // rendering
  // =

  render () {
    return html`
      <textarea
        class="${this.textareaClass} whitespace-nowrap"
        spellcheck="false"
        ?disabled=${this.disabled}
      >${this.value}</textarea>
    `
  }
}

customElements.define('app-code-textarea', CodeTextarea)
