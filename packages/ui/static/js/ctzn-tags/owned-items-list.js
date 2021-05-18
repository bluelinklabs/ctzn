import { LitElement, html } from '../../vendor/lit/lit.min.js'
import { repeat } from '../../vendor/lit/directives/repeat.js'
import { ViewItemPopup } from '../com/popups/view-item.js'
import * as session from '../lib/session.js'
import * as displayNames from '../lib/display-names.js'
import { ITEM_CLASS_ICON_URL } from '../lib/const.js'

export class OwnedItemsList extends LitElement {
  static get properties () {
    return {
      userId: {type: String, attribute: 'user-id'},
      ownedItems: {type: Array},
      databaseItems: {type: Array},
      isExpanded: {type: Boolean}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.setAttribute('ctzn-elem', '1')
    this.userId = undefined
    this.ownedItems = undefined
    this.databaseItems = undefined
    this.isExpanded = false
  }

  setContextState (state) {
    if (state?.page?.userId) {
      if (!this.userId) {
        this.userId = state.page.userId
      }
    }
  }

  get canToggleExpanded () {
    return this.databaseItems?.length
  }

  async load () {
    this.ownedItems = await session.ctzn.listOwnedItems(this.userId)

    const itemsByCommunity = {}
    for (let item of this.ownedItems) {
      if (!itemsByCommunity[item.databaseId]) {
        itemsByCommunity[item.databaseId]= {
          databaseId: item.databaseId,
          items: []
        }
      }
      itemsByCommunity[item.databaseId].items.push(item)
    }
    this.databaseItems = Object.values(itemsByCommunity)
    console.log('load', this.databaseItems)
  }

  updated (changedProperties) {
    if (changedProperties.has('userId') && changedProperties.get('userId') != this.userId) {
      this.load()
    }
  }

  getItemClassName (item) {
    return item.itemClass?.value.displayName || item.value.classId
  }

  // rendering
  // =

  render () {
    if (!this.databaseItems) {
      return html`<span class="spinner"></span>`
    }
    return html`
      <div class="bg-white sm:rounded px-3 py-3">
        <div
          class="flex items-center justify-between px-2 ${this.canToggleExpanded ? 'cursor-pointer hov:hover:text-blue-600' : ''}"
          @click=${this.canToggleExpanded ? this.onToggleExpanded : undefined}
        >
          <span>
            <span class="text-lg font-medium mr-1">Owned items</span>
            <span class="text-gray-500 font-bold">${this.databaseItems?.length || '0'}</span>
          </span>
          ${this.canToggleExpanded ? html`
            <span class="fas fa-angle-${this.isExpanded ? 'up' : 'down'}"></span>
          ` : ''}
        </div>
        ${this.isExpanded ? html`
          <div>
            ${repeat(this.databaseItems, database => database.databaseId, (database, i) => html`
              <div class="px-2 pb-1 pt-1 ${i === 0 ? '' : 'mt-2'}">
                <a href="/${database.databaseId}" class="hov:hover:underline">
                  <span class="">${displayNames.render(database.databaseId)}</span>
                  <span class="text-sm text-gray-600">${database.databaseId}</span>
                </a>
              </div>
              <div class="border border-gray-300 rounded">
                ${repeat(database.items, item => item.key, (item, i) => html`
                  <div
                    class="flex items-center px-3 py-3 text-sm ${i === 0 ? '' : 'border-t border-gray-200'} cursor-pointer hov:hover:bg-gray-50"
                    @click=${e => this.onClickViewItem(e, item)}
                  >
                    <span class="mr-2">
                      <img
                        src=${ITEM_CLASS_ICON_URL(database.databaseId, item.value.classId)}
                        class="block w-4 h-4 object-cover"
                      >
                    </span>
                    <span class="flex-1 truncate">
                      ${this.getItemClassName(item)}
                      <span class="text-sm text-gray-600">${item.itemClass?.value.description}</span>
                    </span>
                    <span class="px-1">
                      ${item.value.qty}
                    </span>
                  </div>
                `)}
              </div>
            `)}
          </div>
        ` : ''}
      </div>
    `
  }

  // events
  // =

  async onClickViewItem (e, item) {
    await ViewItemPopup.create({
      communityId: item.databaseId,
      item: item
    })
    this.load()
  }

  onToggleExpanded (e) {
    this.isExpanded = !this.isExpanded
  }
}

customElements.define('ctzn-owned-items-list', OwnedItemsList)