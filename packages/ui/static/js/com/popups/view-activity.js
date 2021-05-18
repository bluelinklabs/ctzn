/* globals beaker */
import { html } from '../../../vendor/lit/lit.min.js'
import { repeat } from '../../../vendor/lit/directives/repeat.js'
import { asyncReplace } from '../../../vendor/lit/directives/async-replace.js'
import { BasePopup } from './base.js'
import { AVATAR_URL, ITEM_CLASS_ICON_URL } from '../../lib/const.js'
import * as displayNames from '../../lib/display-names.js'
import { relativeDate } from '../../lib/time.js'
import { extractSchemaId } from '../../lib/strings.js'
import * as session from '../../lib/session.js'
import '../button.js'
import '../../ctzn-tags/post-view.js'

const _itemCache = {}

// exported api
// =

export class ViewActivityPopup extends BasePopup {
  static get properties () {
    return {
      activity: {type: Object},
      isDataOpen: {type: Boolean}
    }
  }

  constructor (opts) {
    super()
    this.activity = opts.activity
    this.isDataOpen = false
    this.load()
  }

  async load () {
  }

  get shouldShowHead () {
    return false
  }

  get shouldCloseOnEscape () {
    return true
  }

  get shouldCloseOnOuterClick () {
    return true
  }

  get maxWidth () {
    return '520px'
  }

  // management
  //

  static async create (opts) {
    return BasePopup.create(ViewActivityPopup, opts)
  }

  static destroy () {
    return BasePopup.destroy('view-activity-popup')
  }

  // rendering
  // =

  renderBody () {
    let [domain, methodName] = this.activity.call.method.split('/')
    methodName = methodName.replace(/(^(.)|[\-](.))/g, (match, _, char1, char2) => (char1 || char2).toUpperCase())
    const renderMethod = this[`render${methodName}`]

    return html`
      <div class="mb-2">
        <div class="flex items-center mb-2 px-1">
          <div class="flex-1 truncate">
            In
            <a class="text-blue-600 hov:hover:underline" href="/${this.activity.call.database.userId}" title=${this.activity.call.database.userId}>
              ${displayNames.render(this.activity.call.database.userId)}
            </a>
          </div>
          <div>
            <span class="text-sm text-gray-600">${relativeDate(this.activity.result.createdAt)}</span>
          </div>
        </div>
        <div class="bg-gray-50 p-2 rounded">
          <a class="flex items-center bg-white rounded p-2 bg-white border border-gray-300 hov:hover:bg-gray-50" href="/${this.activity.authorId}">
            <img class="block h-8 object-fit rounded w-8 mr-2" src=${AVATAR_URL(this.activity.authorId)}>
            <div class="flex-1 truncate">
              <span class="font-medium">${displayNames.render(this.activity.authorId)}</span>
            </div>
          </a>
          ${renderMethod ? renderMethod.call(this) : html`
            <div class="bg-gray-100 mb-2 px-3.5 py-4 rounded text-gray-600">
              ☹️ I don't know how to render this activity!
            </div>
          `}
        </div>
      </div>

      <div class="flex mt-4">
        <app-button
          transparent
          btn-class="px-3 py-1 text-gray-600"
          label="Activity data"
          icon=${this.isDataOpen ? 'fas fa-caret-up' : 'fas fa-caret-down'}
          @click=${this.onClickDataToggle}
        ></app-button>
        <span class="flex-1"></span>
        <app-button
          btn-class="px-3 py-1"
          label="Close"
          @click=${this.onResolve}
        ></app-button>
      </div>

      ${this.isDataOpen ? html`
        <div class="mt-1 bg-gray-50 rounded p-2 text-sm text-gray-600 font-mono whitespace-pre overflow-x-auto">${JSON.stringify(this.activity, null, 2)}</div>
      ` : ''}
    `
  }

  renderCommunityDeleteBanMethod () {
    const {bannedUser} = this.activity.call.args
    return html`
      <div class="flex rounded p-2 bg-white border border-gray-300 mt-1">
        <div class="block w-8 mr-2 text-center">
          <span class="fas fa-user"></span>
        </div>
        <div class="flex-1">
          lifted the ban on
        </div>
      </div>
      <a class="flex items-center rounded p-2 bg-white border border-gray-300 mt-1 hov:hover:bg-gray-50" href="/${bannedUser.userId}">
        <img class="block h-8 object-fit rounded w-8 mr-2" src=${AVATAR_URL(bannedUser.userId)}>
        <div class="flex-1 truncate">
          <span class="font-medium">${displayNames.render(bannedUser.userId)}</span>
        </div>
      </a>
    `
  }

  renderCommunityInviteMemberMethod () {
    const {invitedUser} = this.activity.call.args
    return html`
      <div class="flex rounded p-2 bg-white border border-gray-300 mt-1">
        <div class="block w-8 mr-2 text-center">
          <span class="fas fa-check"></span>
        </div>
        <div class="flex-1">
          invited to the community:
        </div>
      </div>
      <a class="flex items-center rounded p-2 bg-white border border-gray-300 mt-1 hov:hover:bg-gray-50" href="/${invitedUser.userId}">
        <img class="block h-8 object-fit rounded w-8 mr-2" src=${AVATAR_URL(invitedUser.userId)}>
        <div class="flex-1 truncate">
          <span class="font-medium">${displayNames.render(invitedUser.userId)}</span>
        </div>
      </a>
    `
  }
  
  renderCommunityRemoveMemberMethod () {
    const {ban, banReason, member} = this.activity.call.args
    return html`
      <div class="flex rounded p-2 bg-white border border-gray-300 mt-1">
        <div class="block w-8 mr-2 text-center">
          <span class="fas fa-ban"></span>
        </div>
        <div class="flex-1">
          ${ban ? 'banned' : 'removed'} from the community:
        </div>
      </div>
      <a class="flex items-center rounded p-2 bg-white border border-gray-300 mt-1 hov:hover:bg-gray-50" href="/${member.userId}">
        <img class="block h-8 object-fit rounded w-8 mr-2" src=${AVATAR_URL(member.userId)}>
        <div class="flex-1 truncate">
          <span class="font-medium">${displayNames.render(member.userId)}</span>
        </div>
      </a>
      ${banReason ? html`
        <div class="border border-gray-300 mt-1 px-3 py-2 rounded text-gray-600 text-sm">
          Reason: ${banReason}
        </div>
      ` : ''}
    `
  }

  renderCommunityPutBanMethod () {
    const {reason, bannedUser} = this.activity.call.args
    return html`
      <div class="flex rounded p-2 bg-white border border-gray-300 mt-1">
        <div class="block w-8 mr-2 text-center">
          <span class="fas fa-ban"></span>
        </div>
        <div class="flex-1">
          banned from the community:
        </div>
      </div>
      <a class="flex items-center rounded p-2 bg-white border border-gray-300 mt-1 hov:hover:bg-gray-50" href="/${bannedUser.userId}">
        <img class="block h-8 object-fit rounded w-8 mr-2" src=${AVATAR_URL(bannedUser.userId)}>
        <div class="flex-1 truncate">
          <span class="font-medium">${displayNames.render(bannedUser.userId)}</span>
        </div>
      </a>
      ${reason ? html`
        <div class="border border-gray-300 mt-1 px-3 py-2 rounded text-gray-600 text-sm">
          Reason: ${reason}
        </div>
      ` : ''}
    `
  }
  
  renderCommunityUpdateConfigMethod () {
    return html`
      <div class="flex rounded p-2 bg-white border border-gray-300 mt-1">
        <div class="block w-8 mr-2 text-center">
          <span class="fas fa-list"></span>
        </div>
        <div class="flex-1">
          updated the settings for:
        </div>
      </div>
      <a class="flex items-center rounded p-2 bg-white border border-gray-300 mt-1 hov:hover:bg-gray-50" href="/${this.activity.call.database.userId}">
        <img class="block h-8 object-fit rounded w-8 mr-2" src=${AVATAR_URL(this.activity.call.database.userId)}>
        <div class="flex-1 truncate">
          <span class="font-medium">${displayNames.render(this.activity.call.database.userId)}</span>
        </div>
      </a>
      <div class="border border-gray-300 mt-1 px-3 py-2 rounded text-gray-600 text-sm">
        ${repeat(Object.entries(this.activity.call.args), ([key, value]) => html`
          <div class="font-semibold">${key}:</div>
          <div class="text-black text-base">${value}</div>
        `)}
      </div>
    `
  }
    
  renderCreateItemMethod () {
    const {classId, qty, owner} = this.activity.call.args
    return html`
      <div class="flex rounded p-2 bg-white border border-gray-300 mt-1">
        <div class="block w-8 mr-2 text-center">
          <span class="far fa-gem"></span>
        </div>
        <div class="flex-1">
          created
          <span class="font-semibold text-gray-800 text-sm">
            <img
              src=${ITEM_CLASS_ICON_URL(this.activity.call.database.userId, classId)}
              class="relative inline-block w-4 h-4 object-cover"
              style="top: -2px"
            >
            ${qty}
          </span>
          <span class="text-black">${classId}</span>
          for
        </div>
      </div>
      <a class="flex items-center rounded p-2 bg-white border border-gray-300 mt-1 hov:hover:bg-gray-50" href="/${owner.userId}">
        <img class="block h-8 object-fit rounded w-8 mr-2" src=${AVATAR_URL(owner.userId)}>
        <div class="flex-1 truncate">
          <span class="font-medium">${displayNames.render(owner.userId)}</span>
        </div>
      </a>
    `
  }
  
  renderCreateItemClassMethod () {
    const {classId} = this.activity.call.args
    return html`
      <div class="flex rounded p-2 bg-white border border-gray-300 mt-1">
        <div class="block w-8 mr-2 text-center">
          {<span class="far fa-fw fa-gem"></span>}
        </div>
        <div class="flex-1">
          created the item class
          <img
            src=${ITEM_CLASS_ICON_URL(this.activity.call.database.userId, classId)}
            class="relative inline-block w-4 h-4 object-cover"
            style="top: -2px"
          >
          <span class="text-black">${classId}</span>
        </div>
      </div>
    `
  }
  
  renderDeleteItemClassMethod () {
    const {classId} = this.activity.call.args
    return html`
      <div class="flex rounded p-2 bg-white border border-gray-300 mt-1">
        <div class="block w-8 mr-2 text-center">
          <span class="fas fa-times"></span>
        </div>
        <div class="flex-1">
          deleted the item class
          <img
            src=${ITEM_CLASS_ICON_URL(this.activity.call.database.userId, classId)}
            class="relative inline-block w-4 h-4 object-cover"
            style="top: -2px"
          >
          <span class="text-black">${classId}</span>
        </div>
      </div>
    `
  }
  
  renderDestroyItemMethod () {
    const {itemKey, qty} = this.activity.call.args
    const [classId] = itemKey.split(':')
    return html`
      <div class="flex rounded p-2 bg-white border border-gray-300 mt-1">
        <div class="block w-8 mr-2 text-center">
          <span class="far fa-gem"></span>
        </div>
        <div class="flex-1">
          destroyed
          <span class="font-semibold text-gray-800 text-sm">
            <img
              src=${ITEM_CLASS_ICON_URL(this.activity.call.database.userId, classId)}
              class="relative inline-block w-4 h-4 object-cover"
              style="top: -2px"
            >
            ${qty}
          </span>
          <span class="text-black">${classId}</span>
        </div>
      </div>
    `
  }
  
  renderPutAvatarMethod () {
    return html`
      <div class="flex rounded p-2 bg-white border border-gray-300 mt-1">
        <div class="block w-8 mr-2 text-center">
          <span class="far fa-image"></span>
        </div>
        <div class="flex-1">
          updated the avatar for
        </div>
      </div>
      <a class="flex items-center rounded p-2 bg-white border border-gray-300 mt-1 hov:hover:bg-gray-50" href="/${this.activity.call.database.userId}">
        <img class="block h-8 object-fit rounded w-8 mr-2" src=${AVATAR_URL(this.activity.call.database.userId)}>
        <div class="flex-1 truncate">
          <span class="font-medium">${displayNames.render(this.activity.call.database.userId)}</span>
        </div>
      </a>
    `
  }
  
  renderPutBlobMethod () {
    const {blobName} = this.activity.call.args.target
    return html`
      <div class="flex rounded p-2 bg-white border border-gray-300 mt-1">
        <div class="block w-8 mr-2 text-center">
          <span class="far fa-image"></span>
        </div>
        <div class="flex-1">
          updated the ${blobName} blob for
        </div>
      </div>
      <a class="flex items-center rounded p-2 bg-white border border-gray-300 mt-1 hov:hover:bg-gray-50" href="/${this.activity.call.database.userId}">
        <img class="block h-8 object-fit rounded w-8 mr-2" src=${AVATAR_URL(this.activity.call.database.userId)}>
        <div class="flex-1 truncate">
          <span class="font-medium">${displayNames.render(this.activity.call.database.userId)}</span>
        </div>
      </a>
    `
  }
  
  renderPutItemClassMethod () {
    const {classId} = this.activity.call.args
    return html`
      <div class="flex rounded p-2 bg-white border border-gray-300 mt-1">
        <div class="block w-8 mr-2 text-center">
          {<span class="far fa-fw fa-gem"></span>}
        </div>
        <div class="flex-1">
          set up the item class
          <img
            src=${ITEM_CLASS_ICON_URL(this.activity.call.database.userId, classId)}
            class="relative inline-block w-4 h-4 object-cover"
            style="top: -2px"
          >
          <span class="text-black">${classId}</span>
        </div>
      </div>
    `
  }
  
  renderPutProfileMethod () {
    const {displayName, description} = this.activity.call.args
    return html`
      <div class="flex rounded p-2 bg-white border border-gray-300 mt-1">
        <div class="block w-8 mr-2 text-center">
          <span class="fas fa-user"></span>
        </div>
        <div class="flex-1">
          updated the profile for:
        </div>
      </div>
      <a class="flex items-center rounded p-2 bg-white border border-gray-300 mt-1 hov:hover:bg-gray-50" href="/${this.activity.call.database.userId}">
        <img class="block h-8 object-fit rounded w-8 mr-2" src=${AVATAR_URL(this.activity.call.database.userId)}>
        <div class="flex-1 truncate">
          <span class="font-medium">${displayNames.render(this.activity.call.database.userId)}</span>
        </div>
      </a>
      <div class="border border-gray-300 mt-1 px-3 py-2 rounded text-gray-600 text-sm">
        <div class="font-semibold">Display Name:</div>
        <div class="text-black text-lg font-medium">${displayName}</div>
        <div class="font-semibold">Description:</div>
        <div class="text-black text-base">${description}</div>
      </div>
    `
  }
  
  renderTransferItemMethod () {
    const {itemKey, qty, recp} = this.activity.call.args
    const [classId] = itemKey.split(':')
    return html`
      <div class="flex rounded p-2 bg-white border border-gray-300 mt-1">
        <div class="block w-8 mr-2 text-center">
          <span class="far fa-gem"></span>
        </div>
        <div class="flex-1">
          gave
          <span class="font-semibold text-gray-800 text-sm">
            <img
              src=${ITEM_CLASS_ICON_URL(this.activity.call.database.userId, classId)}
              class="relative inline-block w-4 h-4 object-cover"
              style="top: -2px"
            >
            ${qty}
          </span>
          <span class="text-black">${classId}</span>
          to
        </div>
      </div>
      <a class="flex items-center rounded p-2 bg-white border border-gray-300 mt-1 hov:hover:bg-gray-50" href="/${recp.userId}">
        <img class="block h-8 object-fit rounded w-8 mr-2" src=${AVATAR_URL(recp.userId)}>
        <div class="flex-1 truncate">
          <span class="font-medium">${displayNames.render(recp.userId)}</span>
        </div>
      </a>
      ${this.activity.call.args.relatedTo ? html`
        <div class="font-medium px-2 py-1 text-gray-700 text-sm">For:</div>
        <div class="bg-white border border-gray-300 px-2 reply rounded hov:hover:bg-gray-50">
          ${asyncReplace(this.renderSubject(this.activity.call.args.recp.userId, this.activity.call.args.relatedTo.dbUrl))}
        </div>
      ` : ''}
    `
  }
  
  renderUpdateItemClassMethod () {
    const {classId} = this.activity.call.args
    return html`
      <div class="flex rounded p-2 bg-white border border-gray-300 mt-1">
        <div class="block w-8 mr-2 text-center">
          {<span class="far fa-fw fa-gem"></span>}
        </div>
        <div class="flex-1">
          updated the item class
          <img
            src=${ITEM_CLASS_ICON_URL(this.activity.call.database.userId, classId)}
            class="relative inline-block w-4 h-4 object-cover"
            style="top: -2px"
          >
          <span class="text-black">${classId}</span>
        </div>
      </div>
    `
  }

  async *renderSubject (authorId, dbUrl) {
    if (!_itemCache[dbUrl]) {
      yield html`Loading...`
    }

    const schemaId = extractSchemaId(dbUrl)
    let record
    if (schemaId === 'ctzn.network/post') {
      record = _itemCache[dbUrl] ? _itemCache[dbUrl] : await session.ctzn.getPost(authorId, dbUrl)
      _itemCache[dbUrl] = record
      yield html`
        <ctzn-post-view
          class="block py-2"
          .post=${record}
          mode="content-only"
        ></ctzn-post-view>
      `
    } else if (schemaId === 'ctzn.network/comment') {
      record = _itemCache[dbUrl] ? _itemCache[dbUrl] : await session.ctzn.getComment(authorId, dbUrl)
      _itemCache[dbUrl] = record
      yield html`
        <ctzn-post-view
          class="block py-2"
          .post=${record}
          mode="content-only"
        ></ctzn-post-view>
      `
    }
  }

  // events
  // =

  onClickDataToggle (e) {
    this.isDataOpen = !this.isDataOpen
  }
}

customElements.define('view-activity-popup', ViewActivityPopup)
