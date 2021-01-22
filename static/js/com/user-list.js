import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { repeat } from '../../vendor/lit-element/lit-html/directives/repeat.js'
import css from '../../css/com/user-list.css.js'
import * as toast from './toast.js'
import { pluralize } from '../lib/strings.js'

export class UserList extends LitElement {
  static get properties () {
    return {
      api: {type: Object},
      profile: {type: Object},
      ids: {type: Array},
      profiles: {type: Array}
    }
  }

  static get styles () {
    return css
  }

  constructor () {
    super()
    this.api = undefined
    this.profile = undefined
    this.ids = undefined
    this.profiles = undefined
  }

  async load () {
    this.profiles = []
    for (let id of this.ids) {
      const profile = await this.api.profiles.get(id)
      this.profiles.push(profile)
      this.requestUpdate()

      const [followers, following] = await Promise.all([
        this.api.follows.listFollowers(id).then(res => res.followerIds),
        this.api.follows.listFollows(id)
      ])
      profile.numFollowers = followers.length
      profile.numFollowing = following.length
      profile.isFollowingMe = !!following.find(f => f.value.subject.userId === this.profile.userId)
      profile.amIFollowing = !!followers.find(f => f === this.profile.userId)
      this.requestUpdate()
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
    if (!this.profiles) {
      return html`<span class="spinner"></span>`
    }
    return html`
      <div class="profiles">
        ${repeat(this.profiles, profile => {
          const nFollowers = profile.numFollowers
          const nFollowing = profile.numFollowing
          const userId = (new URL(profile.url)).pathname.split('/')[1]
          return html`
            <div class="profile">
              <div class="header">
                <a class="avatar" href=${profile.url} title=${profile.value.displayName}>
                  <img src="${profile.url}/avatar">
                </a>
                ${this.renderProfileControls(profile)}
              </div>
              <div class="id">
                <a class="display-name" href=${profile.url} title=${profile.value.displayName}>
                  ${profile.value.displayName}
                </a>
                <a class="username" href=${profile.url} title=${profile.value.displayName}>
                  ${userId}
                </a>
              </div>
              <div class="description">${profile.value.description}</div>
              <div class="stats">
                <span class="stat"><span class="stat-number">${nFollowers}</span> ${pluralize(nFollowers, 'Follower')}</span>
                &middot;
                <span class="stat"><span class="stat-number">${nFollowing}</span> Following</span>
                ${profile.isFollowingMe ? html`
                  <span class="label">Follows you</span>
                ` : ''}
              </div>
            </div>
          `
        })}
      </div>
    `
  }

  renderProfileControls (profile) {
    if (!this.profile) return ''
    return html`
      <div class="ctrls">
        ${profile.userId === this.profile.userId ? html`
          <span class="label">This is you</span>
        ` : profile.amIFollowing ? html`
          <button @click=${e => this.onClickUnfollow(e, profile)}>Unfollow</button>
        ` : html`
          <button @click=${e => this.onClickFollow(e, profile)}>Follow</button>
        `}
      </div>
    `
  }

  // events
  // =

  async onClickFollow (e, profile) {
    e.preventDefault()
    await this.api.follows.follow(profile.userId)
    profile.amIFollowing = true
    this.requestUpdate()
  }

  async onClickUnfollow (e, profile) {
    e.preventDefault()
    await this.api.follows.unfollow(profile.userId)
    profile.amIFollowing = false
    this.requestUpdate()
  }
}

customElements.define('ctzn-user-list', UserList)