import { html } from '../../vendor/lit/lit.min.js'
import { createWidgetBaseClass } from './base.js'
import { makeSafe } from '../lib/strings.js'

// exported api
// =

export const name = 'ctzn-following-list'
export const validElements = 'ctzn-following-list[user-id]'

export function setup (win, doc, editor) {
  class CtznFollowingList extends createWidgetBaseClass(win) {
    static get observedAttributes () {
      return ['user-id']
    }

    renderHeader () {
      return html`
        <strong>Following List</strong>
        of
        ${this['user-id'] ? html`
          <span class="link" @click=${e => this.onClickUser(e)}>${this['user-id']}</span>
        ` : html`
          this user
        `}
      `
    }

    onClickEdit (e) {
      doPropertiesDialog(this, editor)
    }

    onClickUser (e) {
      e.preventDefault()
      e.stopPropagation()
      window.open(`/${this['user-id']}`)
    }
  }
  win.customElements.define('ctzn-following-list', CtznFollowingList)
}

export function insert (editor) {
  editor.insertContent(`<ctzn-following-list></ctzn-following-list>`)
}

// internal methods
// =

function doPropertiesDialog (el, editor) {
  editor.windowManager.open({
    title: 'Following list',
    body: {
      type: 'panel',
      items: [
        {
          type: 'input',
          name: 'user-id',
          label: 'User ID',
          placeholder: 'Whose followed users to show? (Defaults to the profile being viewed.)'
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
      'user-id': el?.['user-id'] || ''
    },
    onSubmit: (dialog) => {
      var data = dialog.getData()

      data.limit = parseInt(data.limit) || ''
      
      if (!el) {
        let attrs = []
        if (data['user-id']) attrs.push(`user-id="${makeSafe(data['user-id'])}"`)
        editor.insertContent(`<ctzn-following-list ${attrs.join(' ')}></ctzn-following-list>`)
      }
      else {
        editor.undoManager.transact(() => {
          for (let k in data) {
            if (!data[k]) {
              el[k] = undefined
              delete data[k]
            } else {
              el[k] = data[k]
            }
          }
          editor.dom.setAttribs(el, data)
        })
        editor.nodeChanged()
      }
      dialog.close()
    }
  })
}