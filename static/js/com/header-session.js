import {LitElement, html} from '../../vendor/lit-element/lit-element.js'

export class HeaderSession extends LitElement {
  static get properties () {
    return {
      profile: {type: Object}
    }
  }

  createRenderRoot () {
    // no shadow dom
    return this
  }

  constructor () {
    super()
    this.api = undefined
    this.profile = undefined
  }

  render () {
    if (this.profile) {
      return html`
        <a href="/profile">${this.profile.username}</a> |
        <a href="#" @click=${this.onClickLogout}>Logout</a>
      `
    } else if (this.profile === null) {
      return html`
        <a href="/login">Login</a> |
        <a href="/signup">Signup</a>
      `
    }
  }

  // events
  // =

  async onClickLogout (e) {
    e.preventDefault()
    await this.api.accounts.logout()
    location.reload()
  }
}

customElements.define('ctzn-header-session', HeaderSession)
