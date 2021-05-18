import { LitElement, html } from '../../vendor/lit/lit.min.js'
import { repeat } from '../../vendor/lit/directives/repeat.js'
import { makeUnsafe } from '../lib/strings.js'

export class Code extends LitElement {
  constructor () {
    super()
    this.setAttribute('ctzn-elem', '1')
    this.classList.add('mb-1')
  }

  get codeLines () {
    return this.textContent.trim().split('\n').map(makeUnsafe)
  }

  render () {
    return html`
      <style>
        :host {
          display: block;
          background: #fff;
          padding: 0.2rem;
        }
        slot {
          display: none;
        }
        .rendered-code {
          overflow-x: scroll;
          background-color: #F3F4F6; /*bg-gray-100*/
          padding: 0.4rem;
          border-radius: 5px;
          counter-reset: line;
        }
        .rendered-code > :last-child {
          margin-bottom: 0 !important;
        }
        .rendered-code > code {
          display: block;
          white-space: pre;
          color: #1F2937 /*text-gray-800*/;
          background-color: transparent;
        }
        .rendered-code > code::before {
          display: inline-block;
          text-align: right;
          width: 2ch;
          margin-right: 1ch;
          color: #9CA3AF /*text-gray-400*/;
          counter-increment: line;
          content: counter(line);
        }
      </style>
      <div class="rendered-code">
        ${repeat(this.codeLines, line => html`<code>${line}</code>`)}
      </div>
      <slot></slot>
    `
  }
}

customElements.define('ctzn-code', Code)
