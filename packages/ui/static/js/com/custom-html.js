import { LitElement, html } from '../../vendor/lit/lit.min.js'
import { unsafeHTML } from '../../vendor/lit/directives/unsafe-html.js'
import * as ctznHtml from '../lib/ctzn-html.js'
import * as session from '../lib/session.js'
import { decodeBase64 } from '../lib/strings.js'

import '../ctzn-tags/card.js'
import '../ctzn-tags/code.js'
import '../ctzn-tags/iframe.js'
import '../ctzn-tags/post-view.js'
import '../ctzn-tags/comments-feed.js'
import '../ctzn-tags/posts-feed.js'
import '../ctzn-tags/comment-view.js'
import '../ctzn-tags/followers-list.js'
import '../ctzn-tags/following-list.js'
import '../ctzn-tags/community-memberships-list.js'
import '../ctzn-tags/community-members-list.js'
import '../ctzn-tags/dbmethods-feed.js'
import '../ctzn-tags/owned-items-list.js'
import '../ctzn-tags/item-classes-list.js'
import '../ctzn-tags/pages-list.js'

export class CustomHtml extends LitElement {
  static get properties () {
    return {
      context: {type: String},
      contextState: {type: Object},
      userId: {type: String},
      blobName: {type: String},
      html: {type: String},
      loadedHtml: {type: String},
      currentError: {type: String}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.context = undefined
    this.contextState = {}
    this.userId = undefined
    this.blobName = undefined
    this.html = undefined
    this.loadedHtml = undefined
    this.currentError = undefined
  }
  
  async updated (changedProperties) {
    if (changedProperties.has('userId') || changedProperties.has('blobName') || changedProperties.has('html')) {
      if (this.html || (this.userId && this.blobName)) {
        this.load()
      }
    }
    if (changedProperties.has('loadedHtml')) {  
      await this.updateComplete
      this.htmlChanged()
    }
  }
  
  async load () {
    this.currentError = undefined
    if (this.html) {
      this.loadedHtml = this.html
      return
    }
    try {
      let base64buf = (await session.ctzn.getBlobByHomeServer(this.userId, this.blobName))?.buf
      if (base64buf) this.loadedHtml = decodeBase64(base64buf)
      else this.loadedHtml = ''
    } catch (e) {
      this.currentError = e.toString()
    }
  }

  htmlChanged () {
    let ctznElems = Array.from(this.querySelectorAll('[ctzn-elem]'))
    for (let el of ctznElems) {
      if (el.setContextState) {
        el.setContextState(this.contextState, this.context)
      }
    }
  }

  // rendering
  // =

  render () {
    if (this.currentError){
      return html`
        <div class="bg-red-100 p-6 mb-1 text-red-600">${this.currentError}</div>
      `
    }
    if (typeof this.loadedHtml === 'undefined') {
      return html`
        <div class="bg-white mb-1 sm:rounded p-6 text-center">
          <span class="spinner w-6 h-6 text-gray-400"></span>
        </div>`
    }
    return html`
      ${unsafeHTML(ctznHtml.sanitize(this.loadedHtml, this.context))}
    `
  }
}

customElements.define('app-custom-html', CustomHtml)
