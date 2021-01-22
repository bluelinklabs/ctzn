import { LitElement, html } from '../vendor/lit-element/lit-element.js'
import { ViewThreadPopup } from './com/popups/view-thread.js'
import { EditProfilePopup } from './com/popups/edit-profile.js'
import * as toast from './com/toast.js'
import { create as createRpcApi } from './lib/rpc-api.js'
import { pluralize } from './lib/strings.js'
import css from '../css/user.css.js'
import './com/header.js'
import './com/feed.js'
import './com/user-list.js'

class CtznUser extends LitElement {
  static get properties () {
    return {
      profile: {type: Object},
      userProfile: {type: Object},
      currentView: {type: String},
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
    this.currentView = 'feed'
    this.followers = undefined
    this.following = undefined
    this.isEmpty = false

    this.userId = (new URL(location)).pathname.split('/')[1]

    this.load()
  }

  get amIFollowing () {
    return !!this.followers?.find?.(id => id === this.profile.userId)
  }

  get isFollowingMe () {
    return !!this.following?.find?.(f => f.value.subject.userId === this.profile.userId)
  }

  get userUrl () {
    return `${(new URL(location)).origin}/${this.userId}`
  }

  async load () {
    this.api = await createRpcApi()
    this.profile = await this.api.accounts.whoami()
    console.log(this.profile)
    this.userProfile = await this.api.profiles.get(this.userId)
    const [userProfile, followers, following] = await Promise.all([
      this.api.profiles.get(this.userId),
      this.api.follows.listFollowers(this.userId).then(res => res.followerIds),
      this.api.follows.listFollows(this.userId)
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

  setView (str) {
    this.currentView = str
  }

  // rendering
  // =

  render () {
    const nFollowers = this.followers?.length || 0
    const nFollowing = this.following?.length || 0
    const setView = (str) => e => {
      e.preventDefault()
      this.setView(str)
    }
    return html`
      <link rel="stylesheet" href="/css/fontawesome.css">
      <main>
        <ctzn-header .api=${this.api} .profile=${this.profile}></ctzn-header>
        <div class="profile-banner">
          <a href="/${this.userId}" title=${this.userProfile?.value.displayName} @click=${setView('feed')}>
            <img class="avatar" src="/${this.userId}/avatar">
          </a>
          <h2 class="display-name">
            <a href="/${this.userId}" title=${this.userProfile?.value.displayName} @click=${setView('feed')}>
              ${this.userProfile?.value.displayName}
            </a>
          </h2>
          <h2 class="username">
            <a href="/${this.userId}" title="${this.userId}" @click=${setView('feed')}>
              ${this.userId}
            </a>
          </h2>
          ${this.userProfile?.value.description ? html`
            <p class="bio">${this.userProfile?.value.description}</p>
          ` : ''}
          <p class="stats">
            <a class="stat" @click=${setView('followers')}><span class="stat-number">${nFollowers}</span> ${pluralize(nFollowers, 'Follower')}</a>
            &middot;
            <a class="stat" @click=${setView('following')}><span class="stat-number">${nFollowing}</span> Following</a>
          </p>
        </div>
        ${this.renderCurrentView()}
      </main>
    `
  }

  renderRightSidebar () {
    const displayName = this.userProfile?.value.displayName || this.userId
    return html`
      <div class="sidebar">
        <div class="sticky">
          <section class="user-controls">
            ${this.profile ? html`
              ${this.profile.userId === this.userId ? html`
                <button class="primary" @click=${this.onClickEditProfile}>Edit profile</button>
              ` : html`
                ${this.amIFollowing === true ? html`
                  <button @click=${this.onClickUnfollow}>Unfollow ${displayName}</button>
                ` : this.amIFollowing === false ? html`
                  <button class="primary" @click=${this.onClickFollow}>Follow ${displayName}</button>
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
    if (this.currentView === 'followers') {
      return html`
        <div class="twocol">
          <div>
            <h3>${this.followers?.length} ${pluralize(this.followers?.length, 'follower')}</h3>
            <ctzn-user-list .api=${this.api} .profile=${this.profile} .ids=${this.followers}></ctzn-user-list>
          </div>
          ${this.renderRightSidebar()}
        </div>
      `
    } else if (this.currentView === 'following') {
      return html`
        <div class="twocol">
          <div>
            <h3>Following ${this.following?.length} ${pluralize(this.following?.length, 'account')}</h3>
            <ctzn-user-list .api=${this.api} .profile=${this.profile} .ids=${this.following.map(f => f.value.subject.userId)}></ctzn-user-list>
          </div>
          ${this.renderRightSidebar()}
        </div>
      `      
    }
    return html`
      <div class="twocol">
        <div>
          ${this.isEmpty ? this.renderEmptyMessage() : ''}
          <ctzn-feed
            .source=${this.userId}
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
    let newProfile = await EditProfilePopup.create(this.userId, this.userProfile.value)
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
    await this.api.follows.follow(this.userId)
    this.followers = await this.api.follows.listFollowers(this.userId).then(res => res.followerIds)
  }

  async onClickUnfollow (e) {
    await this.api.follows.unfollow(this.userId)
    this.followers = await this.api.follows.listFollowers(this.userId).then(res => res.followerIds)
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
