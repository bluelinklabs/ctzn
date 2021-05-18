import { LitElement, html } from '../../vendor/lit/lit.min.js'
import { repeat } from '../../vendor/lit/directives/repeat.js'
import { CreateItemPopup } from '../com/popups/create-item.js'
import { ViewItemPopup } from '../com/popups/view-item.js'
import { ManageItemClasses } from '../com/popups/manage-item-classes.js'
import * as session from '../lib/session.js'
import * as displayNames from '../lib/display-names.js'
import { AVATAR_URL, ITEM_CLASS_ICON_URL } from '../lib/const.js'

export class ItemClassesList extends LitElement {
  static get properties () {
    return {
      userId: {type: String, attribute: 'user-id'},
      currentItemClass: {type: String},
      itemClasses: {type: Array},
      items: {type: Array},
      canManageItemClasses: {type: Boolean},
      canCreateItem: {type: Boolean}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.setAttribute('ctzn-elem', '1')
    this.userId = undefined
    this.currentItemClass = undefined
    this.itemClasses = undefined
    this.items = undefined
    this.members = undefined
    this.canManageItemClasses = false
    this.canCreateItem = false
  }

  setContextState (state) {
    if (state?.page?.userId) {
      if (!this.userId) {
        this.userId = state.page.userId
      }
    }
  }

  get currentItems () {
    if (this.currentItemClass) {
      return this.items.filter(item => item.value.classId === this.currentItemClass.value.id)
    }
    return this.items
  }

  async load () {
    this.itemClasses = undefined
    this.items = undefined
    this.members = undefined
    this.canManageItemClasses = false
    this.canCreateItem = false

    this.itemClasses = await session.ctzn.db(this.userId).table('ctzn.network/item-class').list()
    console.log(this.itemClasses)
    this.items = await session.ctzn.db(this.userId).table('ctzn.network/item').list()
    console.log(this.items)

    this.members = await session.ctzn.listAllMembers(this.userId)
    if (this.amIAMember) {
      let [perm1, perm2] = await Promise.all([
        session.ctzn.getCommunityUserPermission(
          this.userId,
          session.info.userId,
          'ctzn.network/perm-manage-item-classes'
        ),
        session.ctzn.getCommunityUserPermission(
          this.userId,
          session.info.userId,
          'ctzn.network/perm-create-item'
        ),
      ])
      this.canManageItemClasses = !!perm1
      this.canCreateItem = !!perm2
    }
  }

  get amIAMember () {
    return session.isActive() && !!this.members?.find?.(m => m.value.user.userId === session.info.userId)
  }

  updated (changedProperties) {
    if (changedProperties.has('userId') && changedProperties.get('userId') != this.userId) {
      this.load()
    }
  }

  // rendering
  // =

  render () {
    if (this.currentItemClass) {
      const cls = this.currentItemClass
      return html`
        <div
          class="relative bg-white mb-1 py-5 px-2 sm:rounded text-center"
        >
          <div class="absolute text-2xl" style="top: 10px; left: 10px">
            <span
              class="fas fa-fw fa-angle-left sm:cursor-pointer"
              @click=${this.onClickBack}
            ></span>
          </div>
          <div class="text-center">
            <img
              src=${ITEM_CLASS_ICON_URL(this.userId, cls.value.id)}
              class="inline-block object-cover h-8 w-8"
            >
          </div>
          <div class="text-xl font-medium">${cls.displayName || cls.value.id}</div>
          <div class="text-gray-700">
            ${cls.value.description}
          </div>
          ${this.canCreateItem ? html`
            <div class="mt-1">
              <app-button
                btn-class="text-base py-1 rounded-2xl"
                label="Generate"
                @click=${this.onClickGenerateItem}
              ></app-button>
            </div>
            ` : ''}
        </div>
        ${this.renderItems()}
      `
    }
    return this.renderItemClasses()
  }

  renderItemClasses () {
    if (!this.itemClasses) {
      return html`<span class="spinner"></span>`
    }
    let total = this.itemClasses.length + (this.canManageItemClasses ? 1 : 0)
    return html`
      ${this.itemClasses.length === 0 ? html`
        <div class="bg-gray-50 py-12 text-center">
          <div class="text-gray-500">This community has no virtual items.</div>
          ${this.canManageItemClasses ? html`
            <app-button
              btn-class="rounded-full mt-6"
              label="Create an item class"
              @click=${this.onClickManageItemClasses}
            ></app-button>
          ` : ''}
        </div>
      ` : html`
        <div class="grid grid-2col">
          ${repeat(this.itemClasses, (cls, i) => {
            return html`
              <div
                class="bg-white flex flex-col justify-center px-6 py-4 sm:cursor-pointer hov:hover:bg-gray-50 sm:text-center ${itemClassBorders(i, total)}"
                @click=${e => this.onClickViewItemClass(e, cls)}
              >
                <div class="sm:text-center">
                  <img
                    src=${ITEM_CLASS_ICON_URL(this.userId, cls.value.id)}
                    class="inline-block object-cover h-8 w-8"
                  >
                </div>
                <div class="text-xl font-medium">${cls.value.displayName || cls.value.id}</div>
                <div class="text-gray-700">
                  ${cls.value.description}
                </div>
              </div>
            `
          })}
          ${this.canManageItemClasses ? html`
            <div
              class="bg-white flex flex-col justify-center px-6 py-4 sm:cursor-pointer hov:hover:bg-gray-50 sm:text-center ${itemClassBorders(this.itemClasses.length, total)}"
              @click=${this.onClickManageItemClasses}
            >
              <div class="text-xl font-medium">Manage</div>
              <div class="text-gray-700">Admin tools</div>
            </div>
          ` : ''}
        </div>
      `}
    `
  }

  renderItems () {
    if (!this.items) {
      return html`<span class="spinner"></span>`
    }
    const cls = this.currentItemClass
    return html`
      ${this.currentItems.length === 0 ? html`
        <div class="bg-gray-100 text-gray-500 py-44 text-center">
          <div class="far fa-gem text-6xl text-gray-300 mb-8"></div>
          <div>This community has not issued any ${cls.value.displayName || cls.value.id}!</div>
        </div>
      ` : html`
        <div>
          ${repeat(this.currentItems, item => item.key, item => {
            return html`
              <div
                class="flex items-center px-3 py-3 cursor-pointer border-t border-gray-200 hov:hover:bg-gray-50"
                @click=${e => this.onClickViewItem(e, item)}
              >
                <img src=${AVATAR_URL(item.value.owner.userId)} class="block rounded w-8 h-8 mr-2">
                <span class="flex-1 truncate">
                  <span>${displayNames.render(item.value.owner.userId)}</span>
                  <span class="hidden text-gray-500 sm:inline">${item.value.owner.userId}</span>
                </span>
                <span class="pr-1">
                  <img
                    src=${ITEM_CLASS_ICON_URL(this.userId, cls.value.id)}
                    class="inline-block object-cover h-4 w-4"
                  >
                  ${item.value.qty}
                </span>
              </div>
            `
          })}
        </div>
      `}
    `
  }

  // events
  // =

  async onClickManageItemClasses () {
    await ManageItemClasses.create({
      communityId: this.userId,
      itemClasses: this.itemClasses
    })
    this.load()
  }

  onClickBack (e) {
    this.currentItemClass = undefined
  }

  onClickViewItemClass (e, itemClass) {
    this.currentItemClass = itemClass
  }

  async onClickGenerateItem (e) {
    await CreateItemPopup.create({
      communityId: this.userId,
      itemClassId: this.currentItemClass.value.id,
      members: this.members
    })
    this.load()
  }

  async onClickViewItem (e, item) {
    await ViewItemPopup.create({
      communityId: this.userId,
      item: item,
      members: this.members
    })
    this.load()
  }
}

customElements.define('ctzn-item-classes-list', ItemClassesList)

function itemClassBorders (index, total) {
  let lim = total + (total % 2) - 2
  if (index >= lim) {
    if (index % 2 === 0) {
      return `${index == total - 2 ? 'border-b lg:border-b-0' : ''} lg:border-r border-gray-200`
    } else {
      return `${index == total - 2 ? 'border-b lg:border-b-0' : ''}`
    }
  }
  if (index % 2 === 0) {
    return 'lg:border-r border-b border-gray-200'
  } else {
    return 'border-b border-gray-200'
  }
}