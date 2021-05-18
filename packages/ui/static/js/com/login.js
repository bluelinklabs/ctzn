import { LitElement, html } from '../../vendor/lit/lit.min.js'
import * as session from '../lib/session.js'
import './button.js'

class CtznLogin extends LitElement {
  static get properties () {
    return {
      isLoggingIn: {type: Boolean},
      currentError: {type: String}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.isLoggingIn = false
    this.currentError = undefined
  }

  firstUpdated () {
    this.querySelector('input#userid').focus()
  }

  // rendering
  // =

  render () {
    return html`
      <div class="py-6 px-8 bg-white">
        <form @submit=${this.onSubmit}>
          <h2 class="mb-6 text-xl font-semibold">Login</h2>
          <div class="mb-6">
            <label class="block w-full box-border mb-1" for="userid">Your UserID</label>
            <input class="block w-full box-border mb-1 p-4 border border-gray-300 rounded" id="userid" name="userid" required placeholder="E.g. bob@home.com">
          </div>
          <div class="mb-6">
            <label class="block w-full box-border mb-1" for="password">Password</label>
            <input class="block w-full box-border mb-1 p-4 border border-gray-300 rounded" id="password" type="password" name="password" required>
          </div>
          ${this.currentError ? html`
            <div class="bg-red-100 p-6 mb-4 text-red-600">${this.currentError}</div>
          ` : ''}
          <div class="flex justify-between items-center">
            <a href="/forgot-password">Forgot Password</a>
            <app-button
              primary
              btn-type="submit"
              ?disabled=${this.isLoggingIn}
              ?spinner=${this.isLoggingIn}
              label="Login"
            ></app-button>
          </div>
          <div class="relative text-center border-t border-gray-300 pt-8 mt-6">
            <span class="absolute bg-white px-3 text-gray-500" style="top: -14px; left: 50%; transform: translateX(-50%);">or</span>
            <app-button btn-class="py-2 px-8 font-semibold rounded-full" color="pink" label="Sign up" href="/signup"></app-button>
          </div>
        </form>
      </div>
    `
  }

  // events
  // =

  async onSubmit (e) {
    e.preventDefault()
    this.isLoggingIn = true
    this.currentError = undefined
    let creds = {
      userId: e.target.userid.value,
      password: e.target.password.value
    }
    if (!creds.userId.includes('@')) {
      this.currentError = html`
        <div class="mb-2 font-medium">Invalid UserID</div>
        <div class="mb-2 text-sm">Don't forget your server! Your UserID should look like an email.</div>
        <div class="text-sm">(Was it ${creds.userId}@ctzn.one?)</div>
      `
    } else {
      try {
        await session.doLogin(creds)
        window.location = '/'
      } catch (e) {
        console.log(e)
        this.currentError = e.data || e.message
      }
    }
    this.isLoggingIn = false
  }

}

customElements.define('app-login', CtznLogin)
