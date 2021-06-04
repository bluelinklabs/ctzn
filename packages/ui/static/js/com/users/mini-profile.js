import { LitElement, html } from '../../../vendor/lit/lit.min.js'
import { repeat } from '../../../vendor/lit/directives/repeat.js'
import { unsafeHTML } from '../../../vendor/lit/directives/unsafe-html.js'
import { AVATAR_URL, BLOB_URL } from '../../lib/const.js'
import * as session from '../../lib/session.js'
import { makeSafe, linkify } from '../../lib/strings.js'
import { emojify } from '../../lib/emojify.js'
import '../button.js'
import '../img-fallbacks.js'

export class UserList extends LitElement {
  static get properties () {
    return {
      userId: {type: String, attribute: 'user-id'},
      profile: {type: Object}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.userId = undefined
    this.profile = undefined
  }

  updated (changedProperties) {
    if (changedProperties.has('userId') && this.userId !== changedProperties.get('userId')) {
      this.load()
    }
  }

  async load () {
    this.profile = undefined
    this.profile = (await session.api.db(this.userId).table('ctzn.network/profile').get('self'))?.value
  }

  // rendering
  // =

  render () {
    if (!this.profile) {
      return html``
    }
    return html`
      <div class="flex items-center">
        <a href="/${this.userId}" title=${this.profile.displayName}>
          <img
            class="avatar inline-block object-cover mr-2"
            src=${AVATAR_URL(this.userId)}
            style="width: 40px; height: 40px"
          >
        </a>
        <div class="flex-1 truncate leading-tight">
          <a class="display-name text-lg font-medium" href="/${this.userId}" title=${this.profile.displayName}>
            ${unsafeHTML(emojify(makeSafe(this.profile.displayName)))}
          </a>
        </div>
      </div>
    `
  }
}

customElements.define('app-mini-profile', UserList)
