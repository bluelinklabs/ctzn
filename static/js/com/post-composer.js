/* globals beaker monaco */
import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import * as toast from './toast.js'
import css from '../../css/com/post-composer.css.js'

const CHAR_LIMIT = 256

class PostComposer extends LitElement {
  static get properties () {
    return {
      api: {type: Object},
      placeholder: {type: String},
      draftText: {type: String, attribute: 'draft-text'},
      subject: {type: String},
      parent: {type: String},
      _visibility: {type: String}
    }
  }

  constructor () {
    super()
    this.api = undefined
    this.placeholder = 'What\'s new?'
    this.draftText = ''
    this.subject = undefined
    this.parent = undefined
  }

  static get styles () {
    return css
  }

  get canPost () {
    return this.draftText.length > 0 && this.draftText.length <= CHAR_LIMIT
  }

  firstUpdated () {
    this.shadowRoot.querySelector('textarea').focus()
  }

  get charLimitDanger () {
    if (this.draftText.length > CHAR_LIMIT) {
      return 'over'
    }
    if (this.draftText.length > CHAR_LIMIT - 50) {
      return 'close'
    }
    return 'fine'
  }

  // rendering
  // =

  render () {
    return html`
      <link rel="stylesheet" href=${(new URL('../../css/fontawesome.css', import.meta.url)).toString()}>
      <link rel="stylesheet" href=${(new URL('../vs/editor/editor.main.css', import.meta.url)).toString()}>
      <form @submit=${this.onSubmit}>
        <div class="editor">
          <textarea placeholder=${this.placeholder} @keyup=${this.onTextareaKeyup}></textarea>
        </div>

        <div class="actions">
          <div class="ctrls">
            <span class="char-limit ${this.charLimitDanger}">
              ${this.draftText.length} / ${CHAR_LIMIT}
            </span>
          </div>
          <div>
            <button @click=${this.onCancel} tabindex="4">Cancel</button>
            <button type="submit" class="primary" tabindex="3" ?disabled=${!this.canPost}>
              Post
            </button>
          </div>
        </div>
      </form>
    `
  }
  
  // events
  // =

  onTextareaKeyup (e) {
    this.draftText = e.currentTarget.value
  }

  onCancel (e) {
    e.preventDefault()
    e.stopPropagation()
    this.draftText = ''
    this.dispatchEvent(new CustomEvent('cancel'))
  }

  async onSubmit (e) {
    e.preventDefault()
    e.stopPropagation()

    if (!this.canPost) {
      return
    }

    let res
    try {
      if (this.subject || this.parent) {
        alert('todo')
        // TODO handle comments
        // let subject = this.subject
        // let parent = this.parent
        // if (subject === parent) parent = undefined // not needed
        // await drive.writeFile(`${folder}${filename}.md`, postBody, {
        //   metadata: {
        //     'comment/subject': subject ? normalizeUrl(subject) : undefined,
        //     'comment/parent': parent ? normalizeUrl(parent) : undefined
        //   }
        // })
      } else {
        res = await this.api.posts.create({text: this.draftText})
      }
    } catch (e) {
      toast.create(e.message, 'error')
      console.error(e)
      return
    }
    
    this.draftText = ''
    this.dispatchEvent(new CustomEvent('publish', {detail: res}))
  }
}

customElements.define('ctzn-post-composer', PostComposer)
