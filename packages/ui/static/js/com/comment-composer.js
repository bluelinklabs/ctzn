/* globals beaker monaco */
import { LitElement, html } from '../../vendor/lit/lit.min.js'
import * as toast from './toast.js'
import * as session from '../lib/session.js'

class CommentComposer extends LitElement {
  static get properties () {
    return {
      isProcessing: {type: Boolean},
      autofocus: {type: Boolean},
      draftText: {type: String},
      placeholder: {type: String},
      community: {type: Object},
      subject: {type: Object},
      parent: {type: Object},
      modalMode: {type: Boolean, attribute: 'modal-mode'}
    }
  }

  constructor () {
    super()
    this.isProcessing = false
    this.autofocus = false
    this.draftText = ''
    this.placeholder = 'Write your comment. Remember to always be kind!'
    this.subject = undefined
    this.parent = undefined
    this.modalMode = false
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  get canPost () {
    return this.draftText.length > 0 && !this.isProcessing
  }

  firstUpdated () {
    if (this.autofocus) {
      this.querySelector('textarea').focus()
    }
  }

  // rendering
  // =

  render () {
    return html`
      <form @submit=${this.onSubmit}>
        <div class="mb-2">
          <textarea
            id="text"
            class="
              w-full box-border resize-none outline-none h-32 text-sm text-black
              ${this.modalMode ? 'border border-gray-300 px-3 py-2 h-56 rounded' : 'h-32 px-1'}
            "
            placeholder=${this.placeholder}
            @keyup=${this.onTextareaKeyup}
            @keydown=${this.onTextareaKeydown}
          ></textarea>
        </div>

        <div class="flex justify-between">
          <button
            class="inline-block rounded px-3 py-1 text-gray-500 bg-white hov:hover:bg-gray-100"
            @click=${this.onCancel}
            tabindex="4"
          >Cancel</button>
          <button
            type="submit"
            class="inline-block rounded px-3 py-1 shadow-sm text-white ${this.canPost ? 'bg-blue-600 hov:hover:bg-blue-700' : 'bg-blue-300 cursor-default'}"
            tabindex="3"
            ?disabled=${!this.canPost}
          >${this.isProcessing ? html`<span class="spinner"></span>` : 'Post comment'}</button>
        </div>
      </form>
    `
  }
  
  // events
  // =

  onTextareaKeyup (e) {
    this.draftText = e.currentTarget.value
  }

  onTextareaKeydown (e) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      this.onSubmit()
    }
  }

  onCancel (e) {
    e.preventDefault()
    e.stopPropagation()
    this.draftText = ''
    this.dispatchEvent(new CustomEvent('cancel'))
  }

  async onSubmit (e) {
    e?.preventDefault()
    e?.stopPropagation()

    if (!this.canPost) {
      return
    }
    this.isProcessing = true

    let res
    try {
      let root = this.subject || this.parent
      let reply = {
        root,
        parent: undefined
      }
      if (this.parent && this.parent.dbUrl !== root.dbUrl) {
        reply.parent = this.parent
      }
      res = await session.ctzn.user.table('ctzn.network/comment').create({
        text: this.querySelector('#text').value,
        reply,
        community: this.community,
        createdAt: (new Date()).toISOString()
      })
      console.log(res)
    } catch (e) {
      toast.create(e.message, 'error')
      this.isProcessing = false
      return
    }
    this.isProcessing = false
    
    this.draftText = ''
    this.querySelector('textarea').value = ''
    this.dispatchEvent(new CustomEvent('publish', {detail: res}))
  }
}

customElements.define('app-comment-composer', CommentComposer)
