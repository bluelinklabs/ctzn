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
      urls: {type: Array},
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
    this.urls = undefined
    this.profiles = undefined
  }

  async load () {
    this.profiles = []
    for (let url of this.urls) {
      const profile = await this.api.profiles.get(url)
      this.profiles.push(profile)
      this.requestUpdate()

      const [followers, following] = await Promise.all([
        this.api.follows.listFollowers(url).then(res => res.followerUrls),
        this.api.follows.listFollows(url)
      ])
      profile.numFollowers = followers.length
      profile.numFollowing = following.length
      profile.isFollowingMe = !!following.find(f => f.value.subjectUrl === this.profile.url)
      profile.amIFollowing = !!followers.find(f => f === this.profile.url)
      this.requestUpdate()
    }
  }

  updated (changedProperties) {
    if (changedProperties.has('urls') && changedProperties.get('urls') != this.urls) {
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
          const username = (new URL(profile.url)).pathname.split('/')[1]
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
                  @${username}
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
        ${profile.url === this.profile.url ? html`
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
    await this.api.follows.follow(profile.url)
    profile.amIFollowing = true
    this.requestUpdate()
  }

  async onClickUnfollow (e, profile) {
    e.preventDefault()
    await this.api.follows.unfollow(profile.url)
    profile.amIFollowing = false
    this.requestUpdate()
  }
}

customElements.define('ctzn-user-list', UserList)