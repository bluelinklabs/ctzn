import { html } from '../../vendor/lit/lit.min.js'
import { repeat } from '../../vendor/lit/directives/repeat.js'
import { createBaseClass, penSvg } from './base.js'

// exported api
// =

export const name = 'ctzn-code'

export function setup (win, doc, editor) {
  class CtznCode extends createBaseClass(win) {
    get codeLines () {
      const nodes = this.shadowRoot.querySelector('slot')?.assignedNodes() || []
      return nodes.map(n => n.textContent).join('\n').trim().split('\n')
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
          display: none;
        }
        header {
          padding-bottom: 8px;
        }
        .rendered-code {
          overflow-x: scroll;
          background-color: #F3F4F6; /*bg-gray-100*/
          padding: 0.8rem;
          border: 1px solid #D1D5DB /*border-gray-300*/;
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
        <header>
          <strong>Code snippet</strong>
          <span class="btn" @click=${e => this.onClickEdit(e)}>${penSvg}</span>
        </header>
        <div class="rendered-code">
          ${repeat(this.codeLines, line => html`<code>${line}</code>`)}
        </div>
        <slot></slot>
      `
    }

    onClickEdit (e) {
      doPropertiesDialog(this, editor)
    }
  }
  win.customElements.define('ctzn-code', CtznCode)
}

export function insert (editor) {
  doPropertiesDialog(null, editor)
}

// internal methods
// =

function doPropertiesDialog (el, editor) {
  editor.windowManager.open({
    title: 'Code snippet',
    size: 'large',
    body: {
      type: 'panel',
      items: [
        {
          type: 'textarea',
          name: 'code',
          placeholder: 'Insert your code snippet here'
        }
      ]
    },
    buttons: [
      {
        type: 'cancel',
        name: 'closeButton',
        text: 'Cancel'
      },
      {
        type: 'submit',
        name: 'submitButton',
        text: 'Save',
        primary: true
      }
    ],
    initialData: {
      code: el ? el.textContent : ''
    },
    onSubmit: (dialog) => {
      var data = dialog.getData()

      if (!el) {
        editor.insertContent(`<ctzn-code id="__new"><pre></pre></ctzn-code>`)
        let newEl = editor.$('#__new')
        newEl[0].querySelector('pre').textContent = data.code
        newEl[0].updateDom()
        editor.selection.select(newEl[0])
        newEl.removeAttr('id')
      }
      else {
        editor.undoManager.transact(() => {
          el.querySelector('pre').textContent = data.code
        })
        el.updateDom()
        editor.nodeChanged()
      }
      dialog.close()
    }
  })
}