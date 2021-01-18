import { LitElement, html } from '../vendor/lit-element/lit-element.js'
import { create as createRpcApi } from './lib/rpc-api.js'
import css from '../css/login.css.js'
import './com/header-session.js'

class CtznLogin extends LitElement {
  static get properties () {
    return {
      session: {type: Object},
      isLoggingIn: {type: Boolean},
      currentError: {type: String}
    }
  }

  static get styles () {
    return css
  }

  constructor () {
    super()
    this.api = undefined
    this.session = undefined
    this.isLoggingIn = false
    this.currentError = undefined
    this.load()
  }

  async load () {
    this.api = await createRpcApi()
    this.session = await this.api.accounts.whoami()
  }

  firstUpdated () {
    this.shadowRoot.querySelector('input#username').focus()
  }

  // rendering
  // =

  render () {
    return html`
      <link rel="stylesheet" href="/css/fontawesome.css">
      <main>
        <header>
          <div class="brand">
            <a href="/" title="CTZN">CTZN</a>
          </div>
          <ctzn-header-session .api=${this.api} .session=${this.session}></ctzn-header-session>
        </header>
        <div class="login-form">
          <form @submit=${this.onSubmit}>
            <h2>Login</h2>
            <div class="form-control">
              <label for="username">Username</label>
              <input id="username" name="username" required>
            </div>
            <div class="form-control">
              <label for="password">Password</label>
              <input id="password" type="password" name="password" required>
            </div>
            ${this.currentError ? html`
              <div class="error">${this.currentError}</div>
            ` : ''}
            <div class="submit-controls">
              <a href="/forgot-password">Forgot Password</a>
              <button class="primary big" type="submit" ?disable=${this.isLoggingIn}>
                ${this.isLoggingIn ? html`<span class="spinner"></span>` : `Login`}
              </button>
            </div>
          </form>
        </div>
      </main>
    `
  }

  // events
  // =

  async onSubmit (e) {
    e.preventDefault()
    this.isLoggingIn = true
    this.currentError = undefined
    let creds = {
      username: e.target.username.value,
      password: e.target.password.value
    }
    try {
      const sess = await this.api.accounts.login(creds)
      localStorage.sessionId = sess.sessionId
      window.location = '/'
    } catch (e) {
      this.currentError = e.data
    }
    this.isLoggingIn = false
  }

}

customElements.define('ctzn-login', CtznLogin)
