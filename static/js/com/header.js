import {LitElement, html} from '../../vendor/lit-element/lit-element.js'
import * as contextMenu from './context-menu.js'
import css from '../../css/com/header.css.js'

const CHECK_NOTIFICATIONS_INTERVAL = 5e3

export class Header extends LitElement {
  static get properties () {
    return {
      api: {type: Object},
      profile: {type: Object},
      unreadNotificationsCount: {type: Number}
    }
  }

  static get styles () {
    return css
  }

  constructor () {
    super()
    this.api = undefined
    this.profile = undefined
    this.unreadNotificationsCount = 0
    setInterval(this.checkNotifications.bind(this), CHECK_NOTIFICATIONS_INTERVAL)
  }

  updated (changedProperties) {
    if (changedProperties.has('api')) {
      this.checkNotifications()
    }
  }

  async checkNotifications () {
    if (!this.api) return
    const clearedAt = await this.api.notifications.getNotificationsClearedAt()
    const gt = String(Number(new Date(clearedAt)))
    this.unreadNotificationsCount = await this.api.notifications.count({gt})
  }

  getNavClass (str) {
    return str === location.pathname ? 'current' : ''
  }

  render () {
    return html`
      <link rel="stylesheet" href="/css/fontawesome.css">
      <header>
        <a href="/" class=${this.getNavClass('/')}>
          <span class="fas navicon fa-stream"></span>
          Home
        </a>
        <a href="/notifications" class=${this.getNavClass('/notifications')}>
          <span class="far navicon fa-bell"></span>
          Notifications ${this.unreadNotificationsCount > 0 ? `(${this.unreadNotificationsCount})` : ''}
        </a>
        <span class="spacer"></span>
        ${this.renderSessionCtrls()}
      </header>
    `
  }

  renderSessionCtrls () {
    if (this.profile) {
      return html`
        <button class="primary" @click=${this.onClickNewPost}>New Post</button>
        <a class="profile ${this.getNavClass('/' + this.profile.userId)}" href="/${this.profile.userId}">
          <img src="/${this.profile.userId}/avatar">
          ${this.profile.userId}
        </a>
        <a @click=${this.onClickSessionMenu}><span class="fas fa-caret-down"></span></a>
      `
    } else if (this.profile === null) {
      return html`
        <a href="/login">Login</a>
        <a href="/signup"><strong>Signup</strong></a>
      `
    }
  }

  // events
  // =

  async onClickNewPost (e) {
    e.preventDefault()
    window.location = '/?composer'
  }

  onClickSessionMenu (e) {
    e.preventDefault()
    e.stopPropagation()
    const rect = e.currentTarget.getClientRects()[0]
    contextMenu.create({
      x: rect.right,
      y: rect.bottom,
      right: true,
      roomy: true,
      items: [
        {
          label: 'Log out',
          click: async () => {
            await this.api.accounts.logout()
            location.reload()
          }
        }
      ]
    })
  }
}

customElements.define('ctzn-header', Header)
