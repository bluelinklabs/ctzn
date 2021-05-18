import { LitElement, html } from '../../vendor/lit/lit.min.js'
import { repeat } from '../../vendor/lit/directives/repeat.js'
import { AVATAR_URL } from '../lib/const.js'
import * as session from '../lib/session.js'
import * as displayNames from '../lib/display-names.js'
import { emit } from '../lib/dom.js'

export class MembersList extends LitElement {
  static get properties () {
    return {
      members: {type: Array},
      myFollows: {type: Array},
      canban: {type: Boolean}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.members = undefined
    this.myFollows = []
    this.canban = false
  }

  async load () {
    if (session.isActive()) {
      let f = await session.ctzn.user.table('ctzn.network/follow').list().catch(e => [])
      this.myFollows = f.map(f => f.value.subject.userId)
    }
  }

  updated (changedProperties) {
    if (changedProperties.has('members') && changedProperties.get('members') != this.members) {
      this.load()
    }
  }

  // rendering
  // =

  render () {
    if (!this.members) {
      return html`<span class="spinner"></span>`
    }
    return html`
      ${repeat(this.members, member => {
        const userId = member.value.user.userId
        const [username, domain] = userId.split('@')
        return html`
          <div class="flex items-center px-2 py-2 border-t border-gray-200">
            <a class="ml-1 mr-3" href="/${userId}" title=${userId}>
              <img class="lazyload block rounded-md w-10 h-10 object-cover shadow-sm" data-src=${AVATAR_URL(userId)}>
            </a>
            <div class="flex-1 min-w-0">
              <div class="truncate">
                <a class="font-medium hov:hover:underline" href="/${userId}" title=${userId}>
                  ${displayNames.render(userId)}
                </a>
                <span class="hidden sm:inline text-sm text-gray-500">${domain}</span>
              </div>
              <div class="text-sm text-gray-500 font-medium">
                <span class="mr-1">Joined ${(new Date(member.value.joinDate)).toLocaleDateString()}</span>
                ${member.value.roles?.length ? html`
                  ${repeat(member.value.roles, role => html`
                    <span class="font-semibold px-1 rounded shadow-sm text-white text-xs bg-${role === 'admin' ? 'pink-700' : 'indigo-700'}">${role}</span>
                  `)}
                ` : ''}
              </div>
            </div>
            <div>
              ${this.renderControls(member)}
            </div>
          </div>
        `
      })}
    `
  }

  renderControls (member) {
    if (member.value.user.userId === session?.info?.userId) {
      return html`
        <span class="font-semibold px-1 rounded shadow-sm text-sm bg-gray-100">This is you</span>
      `
    }
    if (session.isActive()) {
      return html`
        ${this.canban ? html`
          <button class="text-sm rounded py-1 px-2 hov:hover:bg-gray-50" @click=${e => this.onClickBan(e, member)}>
            <span class="fas fa-fw fa-ban"></span>
            Ban
          </button>
        ` : ''}
        ${this.myFollows.includes(member.value.user.userId) ? html`
          <app-button btn-class="text-sm font-medium px-4 py-0.5 rounded-full" @click=${e => this.onClickUnfollow(e, member)} label="Unfollow">
          </app-button>
        ` : html`
          <app-button primary btn-class="text-sm font-medium px-4 py-0.5 rounded-full" @click=${e => this.onClickFollow(e, member)} label="Follow">
          </app-button>
        `}
      `
    }
    return ''
  }

  // events
  // =

  async onClickBan (e, member) {
    e.preventDefault()
    emit(this, 'ban', {detail: {member: member.value.user}})
  }

  async onClickFollow (e, member) {
    e.preventDefault()
    await session.ctzn.user.table('ctzn.network/follow').create({
      subject: member.value.user
    })
    this.myFollows.push(member.value.user.userId)
    this.requestUpdate()
  }

  async onClickUnfollow (e, member) {
    e.preventDefault()
    await session.ctzn.user.table('ctzn.network/follow').delete(member.value.user.userId)
    this.myFollows.splice(this.myFollows.indexOf(member.value.user.userId))
    this.requestUpdate()
  }
}

customElements.define('app-members-list', MembersList)