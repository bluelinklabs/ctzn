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

export class UsersListPopup extends BasePopup {
  constructor (opts) {
    super()
    this.title = opts.title
    this.userIds = opts.userIds
  }

  static get properties () {
    return {}
  }

  // management
  //

  static async create (opts) {
    return BasePopup.create(UsersListPopup, opts)
  }

  static destroy () {
    return BasePopup.destroy('users-list-popup')
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
      <div class="text-2xl font-semibold mb-4">${this.title || 'Users'}</div>
      ${repeat(this.userIds, userId => html`
        <div class="flex items-center mb-4">
          <a href="/${userId}" title=${userId}>
            <img class="block mr-3 rounded-full shadow w-8 h-8" src=${AVATAR_URL(userId)}>
          </a>
          <a class="cursor-pointer font-semibold hov:hover:underline leading-tight text-lg" href="/${userId}" title=${userId}>${displayNames.render(userId)}</a>
        </div>
      `)}
    `
  }

  // events
  // =

}

customElements.define('users-list-popup', UsersListPopup)