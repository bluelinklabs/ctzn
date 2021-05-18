import { html, render } from '../../vendor/lit/lit.min.js'

export const penSvg = html`<svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="pen" class="svg-inline--fa fa-pen fa-w-16" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M290.74 93.24l128.02 128.02-277.99 277.99-114.14 12.6C11.35 513.54-1.56 500.62.14 485.34l12.7-114.22 277.9-277.88zm207.2-19.06l-60.11-60.11c-18.75-18.75-49.16-18.75-67.91 0l-56.55 56.55 128.02 128.02 56.55-56.55c18.75-18.76 18.75-49.16 0-67.91z"></path></svg>`

export function createBaseClass (win, doc, editor) {
  return class EditorComponent extends win.HTMLElement {
    constructor () {
      super()
      this.setAttribute('ctzn-elem', '1')
      this.setAttribute('contenteditable', false)
      this.attachShadow({mode: 'open'})
      
      if (this.constructor.observedAttributes) {
        for (let attrName of this.constructor.observedAttributes) {
          Object.defineProperty(this, attrName, {
            get: () => {
              return this.getAttribute(attrName)
            },
            set: (v) => {
              if (v === false || typeof v === 'undefined') {
                this.removeAttribute(attrName)
              } else {
                this.setAttribute(attrName, v)
              }
            }
          })
        }
      }

      this.updateDom()
    }

    connectedCallback () {
      this.updateDom()
    }

    updateDom () {
      render(this.render(), this.shadowRoot)
      this.updated()
    }

    render () {
      return html`
        TODO - override render()
      `
    }

    updated () {
      // optional override
    }

    attributeChangedCallback (name, oldValue, newValue) {
      this.updateDom()
    }
  }
}

export function createWidgetBaseClass (win, doc, editor) {
  return class EditorWidgetComponent extends createBaseClass(win) {
    render () {
      const footer = this.renderFooter()
      return html`
        <style>
        :host {
          display: block;
          background: #fff;
          border-radius: 0.25rem;
          border: 1px solid #ccc;
          padding: 1rem;
        }
        footer {
          font-size: 90%;
        }
        .link {
          color: blue;
          text-decoration: none;
          cursor: pointer;
        }
        .link:hover {
          text-decoration: underline;
        }
        footer .link {
          color: gray;
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
        </style>
        <header>
          ${this.renderHeader()}
          <span class="btn" @click=${e => this.onClickEdit(e)}>${penSvg}</span>
        </header>
        ${footer ? html`<footer>${footer}</footer>` : ''}
      `
    }

    renderHeader () {
      // override me
      return html`header todo`
    }

    renderFooter () {
      // override me
    }

    onClickEdit (e) {
      // override me
    }
  }
}