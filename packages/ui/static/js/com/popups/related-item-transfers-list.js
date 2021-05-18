import { html } from '../../../vendor/lit/lit.min.js'
import { repeat } from '../../../vendor/lit/directives/repeat.js'
import { AVATAR_URL, ITEM_CLASS_ICON_URL } from '../../lib/const.js'
import { BasePopup } from './base.js'
import * as displayNames from '../../lib/display-names.js'

// exported api
// =

export class RelatedItemTransfersListPopup extends BasePopup {
  constructor (opts) {
    super()
    this.communityId = opts.communityId
    this.relatedItemTransfers = opts.relatedItemTransfers
  }

  static get properties () {
    return {}
  }

  // management
  //

  static async create (opts) {
    return BasePopup.create(RelatedItemTransfersListPopup, opts)
  }

  static destroy () {
    return BasePopup.destroy('related-item-transfers-list-popup')
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
      ${repeat(this.relatedItemTransfers, tfx => html`
        <div class="flex align-center mb-4">
          <a href="/${tfx.dbmethodCall.authorId}" title=${tfx.dbmethodCall.authorId}>
            <img class="block mr-3 rounded-full shadow w-12 h-12" src=${AVATAR_URL(tfx.dbmethodCall.authorId)}>
          </a>
          <div>
            <div><a class="cursor-pointer font-semibold hov:hover:underline leading-tight text-lg" href="/${tfx.dbmethodCall.authorId}" title=${tfx.dbmethodCall.authorId}>${displayNames.render(tfx.dbmethodCall.authorId)}</a></div>
            <div>
              Gifted
              <span
                class="inline-block border border-gray-300 px-1 py-0.5 rounded mt-1 text-sm font-semibold"
              >
                <img
                  class="inline relative w-4 h-4 object-cover mr-1"
                  src=${ITEM_CLASS_ICON_URL(this.communityId, tfx.itemClassId)}
                  style="top: -1px"
                >
                ${tfx.qty}
              </span>
              ${tfx.itemClassId}
            </div>
          </div>
        </div>
      `)}
    `
  }

  // events
  // =

}

customElements.define('related-item-transfers-list-popup', RelatedItemTransfersListPopup)