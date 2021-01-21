import {LitElement, html} from '../../vendor/lit-element/lit-element.js'
import * as contextMenu from './context-menu.js'
import css from '../../css/com/header.css.js'

export class Header extends LitElement {
  static get properties () {
    return {
      profile: {type: Object}
    }
  }

  static get styles () {
    return css
  }

  constructor () {
    super()
    this.api = undefined
    this.profile = undefined
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
          Notifications
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
        <a class="profile ${this.getNavClass('/' + this.profile.username)}" href="/${this.profile.username}">
          <img src="/${this.profile.username}/avatar">
          ${this.profile.username}
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
