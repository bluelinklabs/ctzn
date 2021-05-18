import { html } from '../../vendor/lit/lit.min.js'
import { createWidgetBaseClass } from './base.js'
import { makeSafe } from '../lib/strings.js'

// exported api
// =

export const name = 'ctzn-iframe'
export const validElements = 'ctzn-iframe[src]'

export function setup (win, doc, editor) {
  class CtznIframe extends createWidgetBaseClass(win) {
    static get observedAttributes () {
      return ['src']
    }

    renderHeader () {
      return html`
        <strong>Embedded Page (iframe)</strong>
      `
    }

    renderFooter () {
      return html`          
        <span class="link" @click=${e => this.onClickSrc(e)}>${this.src}</span>
      `
    }

    onClickEdit (e) {
      doPropertiesDialog(this, editor)
    }

    onClickSrc (e) {
      e.preventDefault()
      e.stopPropagation()
      window.open(this.src)
    }
  }
  win.customElements.define('ctzn-iframe', CtznIframe)
}

export function insert (editor) {
  doPropertiesDialog(null, editor)
}

// internal methods
// =

function doPropertiesDialog (el, editor) {
  editor.windowManager.open({
    title: 'Embedded page (iframe)',
    body: {
      type: 'panel',
      items: [
        {
          type: 'input',
          name: 'src',
          label: 'URL',
          placeholder: 'The URL of the page'
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
      src: el?.src || ''
    },
    onSubmit: (dialog) => {
      var data = dialog.getData()

      try {
        new URL(data.src)
      } catch (e) {
        editor.windowManager.alert('Invalid URL. Make sure you copied the link correctly!', function(){});
        return
      }
      
      if (!el) {
        editor.insertContent(`<ctzn-iframe src="${makeSafe(data.src)}"></ctzn-iframe>`)
      }
      else {
        editor.undoManager.transact(() => {
          el.src = data.src
          editor.dom.setAttribs(el, data)
        })
        editor.nodeChanged()
      }
      dialog.close()
    }
  })
}