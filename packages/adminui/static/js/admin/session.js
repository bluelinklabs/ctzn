import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import * as session from '../lib/session.js'

class AppSession extends LitElement {
  static get properties () {
    return {
      currentError: {type: String}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.currentError = undefined
    this.isLoggedIn = true
    session.onChange(() => {
      this.isLoggedIn = session.isActive()
      this.requestUpdate()
    })
  }

  render () {
    if (!this.isLoggedIn) {
      return html`
        <div class="bg-yellow-200 font-medium px-4 py-2 sm:rounded text-lg text-yellow-700">You are not currently logged in.</div>
        <form class="flex items-center my-1" @submit=${this.onSubmit}>
          <input type="text" name="username" placeholder="Username" class="bg-white px-2 py-1 rounded mr-1">
          <input type="password" name="password" placeholder="Password" class="bg-white px-2 py-1 rounded mr-1">
          <button class="bg-blue-600 text-white px-2 py-1" type="submit">Login</button>
        </form>
        ${this.currentError ? html`
          <div class="bg-red-200 font-medium px-4 py-2 sm:rounded text-lg text-red-700">${this.currentError}</div>
        ` : ''}
      `
    }
    return html``
  }

  // events
  // =

  async onSubmit (e) {
    e.preventDefault()
    e.stopPropagation()
    
    this.currentError = undefined
    try {
      await session.doLogin({
        username: e.currentTarget.username.value,
        password: e.currentTarget.password.value
      })
    } catch (e) {
      this.currentError = e.toString()
    }
  }
}
customElements.define('app-session', AppSession)