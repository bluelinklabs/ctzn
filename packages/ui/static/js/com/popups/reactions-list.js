import { html } from '../../../vendor/lit/lit.min.js'
import { repeat } from '../../../vendor/lit/directives/repeat.js'
import { unsafeHTML } from '../../../vendor/lit/directives/unsafe-html.js'
import { AVATAR_URL } from '../../lib/const.js'
import { BasePopup } from './base.js'
import { makeSafe } from '../../lib/strings.js'
import { emojify } from '../../lib/emojify.js'
import * as displayNames from '../../lib/display-names.js'

// exported api
// =

export class ReactionsListPopup extends BasePopup {
  constructor (opts) {
    super()
    this.reactions = opts.reactions
    this.users = {}
    for (let reaction in opts.reactions) {
      for (let userId of opts.reactions[reaction]) {
        this.users[userId] = this.users[userId] || {reactions: []}
        this.users[userId].reactions.push(reaction)
      }
    }
  }

  static get properties () {
    return {}
  }

  // management
  //

  static async create (opts) {
    return BasePopup.create(ReactionsListPopup, opts)
  }

  static destroy () {
    return BasePopup.destroy('reactions-list-popup')
  }

  // rendering
  // =

  get shouldShowHead () {
    return false
  }

  get shouldCloseOnEscape () {
    return true
  }

  get shouldCloseOnOuterClick () {
    return true
  }

  renderBody () {
    return html`
      ${repeat(Object.keys(this.users), userId => html`
        <div class="flex align-center mb-4">
          <a href="/${userId}" title=${userId}>
            <img class="block mr-3 rounded-full shadow w-12 h-12" src=${AVATAR_URL(userId)}>
          </a>
          <div>
            <div><a class="cursor-pointer font-semibold hov:hover:underline leading-tight text-lg" href="/${userId}" title=${userId}>${displayNames.render(userId)}</a></div>
            <div class="reactions-list">Reacted ${repeat(this.users[userId].reactions, reaction => html`
              <span class="reaction mr-0.5 px-1 py-0.5">${unsafeHTML(emojify(makeSafe(reaction)))}</span>
            `)}</div>
          </div>
        </div>
      `)}
    `
  }

  // events
  // =

}

customElements.define('reactions-list-popup', ReactionsListPopup)