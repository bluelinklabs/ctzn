import { LitElement, html } from '../../../vendor/lit/lit.min.js'
import { repeat } from '../../../vendor/lit/directives/repeat.js'
import { AVATAR_URL } from '../../lib/const.js'
import * as session from '../../lib/session.js'
import * as displayNames from '../../lib/display-names.js'
import * as userIds from '../../lib/user-ids.js'

export class SimpleUserList extends LitElement {
  static get properties () {
    return {
      ids: {type: Array},
      myFollows: {type: Array},
      emptyMessage: {type: String, attribute: 'empty-message'}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.ids = []
    this.myFollows = []
    this.emptyMessage = 'No users found.'
  }

  async load () {
    if (session.isActive()) {
      let f = await session.api.user.table('ctzn.network/follow').list().then(res => res.entries, e => [])
      this.myFollows = f.map(f => f.value.subject.userId)
    }
  }

  updated (changedProperties) {
    if (changedProperties.has('ids') && changedProperties.get('ids') != this.ids) {
      this.load()
    }
  }

  // rendering
  // =

  render () {
    if (!this.ids) {
      return html`<span class="spinner"></span>`
    }
    return html`
      ${this.ids.length === 0 ? html`
        <div class="empty px-3 py-3">
          ${this.emptyMessage}
        </div>
      ` : ''}
      ${repeat(this.ids, (userId, i) => {
        return html`
          <div class="user flex items-center px-2 py-2">
            <a class="ml-1 mr-3" href="/${userId}" title=${userId}>
              <img class="avatar block w-10 h-10 object-cover" src=${AVATAR_URL(userId)}>
            </a>
            <div class="flex-1 min-w-0 truncate">
              <a class="display-name hov:hover:underline" href="/${userId}" title=${userId}>
                ${displayNames.render(userId)}
              </a>
              <span class="hidden sm:inline user-id">
                @${userIds.render(userId)}
            </span>
            </div>
            <div>
              ${this.renderControls(userId)}
            </div>
          </div>
        `
      })}
    `
  }

  renderControls (userId) {
    if (userId === session?.info?.userId) {
      return html`
        <span class="font-semibold px-1 rounded shadow-sm text-sm bg-gray-100">This is you</span>
      `
    }
    if (session.isActive()) {
      return html`
        ${this.myFollows.includes(userId) ? html`
          <app-button btn-class="text-sm font-medium px-4 py-0.5 rounded-full" @click=${e => this.onClickUnfollow(e, userId)} label="Unfollow">
          </app-button>
        ` : html`
          <app-button primary btn-class="text-sm font-medium px-4 py-0.5 rounded-full" @click=${e => this.onClickFollow(e, userId)} label="Follow">
          </app-button>
        `}
      `
    }
    return ''
  }

  // events
  // =

  async onClickFollow (e, userId) {
    e.preventDefault()
    const userInfo = await session.api.getProfile(userId)
    console.log(userInfo)
    await session.api.user.table('ctzn.network/follow').create({
      subject: {userId, dbUrl: userInfo.dbUrl}
    })
    this.myFollows.push(userId)
    this.requestUpdate()
  }

  async onClickUnfollow (e, userId) {
    e.preventDefault()
    await session.api.user.table('ctzn.network/follow').delete(userId)
    this.myFollows.splice(this.myFollows.indexOf(userId), 1)
    this.requestUpdate()
  }
}

customElements.define('app-simple-user-list', SimpleUserList)
