import { html } from '../../vendor/lit/lit.min.js'
import { createBaseClass } from './base.js'

// exported api
// =

export const name = 'ctzn-card'

export function setup (win, doc, editor) {
  class CtznCard extends createBaseClass(win) {
    connectedCallback () {
      super.connectedCallback()
      // Make the content within <conditional-block> editable by wrapping the
      // content in a <div> with contenteditable on it.
      const cleanupContentEditable = () => {
        if (this.firstChild.contentEditable !== 'true') {
          const editableWrapper = document.createElement('div')
          editableWrapper.setAttribute('contenteditable', true)
          
          while (this.firstChild) {
            editableWrapper.appendChild(this.firstChild)
          }
          
          this.appendChild(editableWrapper)
        }
      }
      cleanupContentEditable()
    }

    render () {
      return html`
        <style>
        :host {
          display: block;
          background: #fff;
          border-radius: 6px;
          border: 1px solid #ccc;
          padding: 1rem;
          min-height: 20px;
        }
        .btn {
          display: inline-block;
          cursor: pointer;
          border-radius: 4px;
          padding: 0 8px;
        }
        .btn:hover {
          background: #eee;
        }
        .btn svg {
          width: 12px;
          color: #666;
        }
        slot {
          min-height: 20px;
        }
        </style>
        <slot></slot>
      `
    }
  }
  win.customElements.define('ctzn-card', CtznCard)
}

export function insert (editor) {
  editor.insertContent(`<ctzn-card></ctzn-card>`)
}

// internal methods
// =
