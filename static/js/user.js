import { LitElement, html } from '../vendor/lit-element/lit-element.js'
import { ViewThreadPopup } from './com/popups/view-thread.js'
import { EditProfilePopup } from './com/popups/edit-profile.js'
import * as toast from './com/toast.js'
import { create as createRpcApi } from './lib/rpc-api.js'
import { pluralize } from './lib/strings.js'
import css from '../css/user.css.js'
import './com/header-session.js'
import './com/feed.js'
import './com/img-fallbacks.js'

class CtznUser extends LitElement {
  static get properties () {
    return {
      profile: {type: Object},
      userProfile: {type: Object},
      followers: {type: Array},
      following: {type: Array},
      isEmpty: {type: Boolean}
    }
  }

  static get styles () {
    return css
  }

  constructor () {
    super()
    this.profile = undefined
    this.userProfile = undefined
    this.followers = undefined
    this.following = undefined
    this.isEmpty = false

    this.username = (new URL(location)).pathname.split('/')[1]

    this.load()
  }

  get amIFollowing () {
    return !!this.followers?.find?.(url => url === this.profile.url)
  }

  get isFollowingMe () {
    return !!this.following?.find?.(f => f.value.subjectUrl === this.profile.url)
  }

  get userUrl () {
    return `${(new URL(location)).origin}/${this.username}`
  }

  async load () {
    this.api = await createRpcApi()
    this.profile = await this.api.accounts.whoami()
    console.log(this.profile)
    this.userProfile = await this.api.profiles.get(this.username)
    const [userProfile, followers, following] = await Promise.all([
      this.api.profiles.get(this.username),
      this.api.follows.listFollowers(this.username).then(res => res.followerUrls),
      this.api.follows.listFollows(this.username)
    ])
    this.userProfile = userProfile
    this.followers = followers
    this.following = following
    console.log({userProfile, followers, following})
  }

  get isLoading () {
    let queryViewEls = Array.from(this.shadowRoot.querySelectorAll('ctzn-record-feed'))
    return !!queryViewEls.find(el => el.isLoading)
  }

  // rendering
  // =

  render () {
    const nFollowers = this.followers?.length || 0
    const nFollowing = this.following?.length || 0
    return html`
      <link rel="stylesheet" href="/css/fontawesome.css">
      <main>
        <header>
          <div class="brand">
            <a href="/" title="CTZN">CTZN</a>
          </div>
          <ctzn-header-session .api=${this.api} .profile=${this.profile}></ctzn-header-session>
        </header>
        <div class="profile-banner">
          <img class="avatar" src="/${this.username}/avatar">
          <h2 class="display-name">${this.userProfile?.value.displayName}</h2>
          <h2 class="username">@${this.username}</h2>
          ${this.userProfile?.value.description ? html`
            <p class="bio">${this.userProfile?.value.description}</p>
          ` : ''}
          <p class="stats">
            <span class="stat"><span class="stat-number">${this.followers?.length}</span> ${pluralize(nFollowers, 'Follower')}</span>
            &middot;
            <span class="stat"><span class="stat-number">${this.following?.length}</span> Following</span>
          </p>
        </div>
        ${this.renderCurrentView()}
      </main>
    `
  }

  renderRightSidebar () {
    return html`
      <div class="sidebar">
        <div class="sticky">
          <section class="user-controls">
            ${this.profile ? html`
              ${this.profile.username === this.username ? html`
                <button class="primary" @click=${this.onClickEditProfile}>Edit profile</button>
              ` : html`
                ${this.amIFollowing === true ? html`
                  <button @click=${this.onClickUnfollow}>Unfollow @${this.username}</button>
                ` : this.amIFollowing === false ? html`
                  <button class="primary" @click=${this.onClickFollow}>Follow @${this.username}</button>
                ` : ``}
              `}
            ` : html`
              TODO logged out UI
            `}
          </section>
        </div>
      </div>
    `
  }

  renderCurrentView () {
    if (!this.api) {
      return ''
  }
    return html`
      <div class="twocol">
        <div>
          ${this.isEmpty ? this.renderEmptyMessage() : ''}
          <ctzn-feed
            .source=${this.username}
            .api=${this.api}
            .profile=${this.profile}
            limit="50"
            @load-state-updated=${this.onFeedLoadStateUpdated}
            @view-thread=${this.onViewThread}
            @publish-reply=${this.onPublishReply}
          ></ctzn-feed>
        </div>
        ${this.renderRightSidebar()}
      </div>
    `
  }

  renderEmptyMessage () {
    return html`
      <div class="empty">
        <div>${this.userProfile.value.displayName} hasn't posted anything yet.</div>
      </div>
    `
  }

  // events
  // =

  onFeedLoadStateUpdated (e) {
    if (typeof e.detail?.isEmpty !== 'undefined') {
      this.isEmpty = e.detail.isEmpty
    }
    this.requestUpdate()
  }

  async onClickEditProfile (e) {
    let newProfile = await EditProfilePopup.create(this.username, this.userProfile.value)
    try {
      await this.api.profiles.put(newProfile.profile)
      this.userProfile.value = newProfile.profile
      if (newProfile.uploadedAvatar) {
        toast.create('Uploading avatar...')
        await this.api.profiles.putAvatar(newProfile.uploadedAvatar.base64buf)
      }
      toast.create('Profile updated', 'success')
      this.requestUpdate()

      if (newProfile.uploadedAvatar) {
        setTimeout(() => location.reload(), 1e3)
      }
    } catch (e) {
      toast.create(e.message, 'error')
      console.error(e)
    }
  }

  async onClickFollow (e) {
    await this.api.follows.follow(this.userUrl)
    this.followers = await this.api.follows.listFollowers(this.username).then(res => res.followerUrls)
  }

  async onClickUnfollow (e) {
    await this.api.follows.unfollow(this.userUrl)
    this.followers = await this.api.follows.listFollowers(this.username).then(res => res.followerUrls)
  }

  onViewThread (e) {
    ViewThreadPopup.create({
      api: this.api,
      subjectUrl: e.detail.subject.url,
      profile: this.profile
    })
  }

  onPublishReply (e) {
    toast.create('Reply published', '', 10e3)
    this.load()
  }
}

customElements.define('ctzn-user', CtznUser)
