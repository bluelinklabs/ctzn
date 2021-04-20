import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import * as session from '../lib/session.js'

class AppSession extends LitElement {
  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.isLoggedIn = true
    session.onChange(() => {
      this.isLoggedIn = session.isActive()
      this.requestUpdate()
    })
  }

  render () {
    if (!this.isLoggedIn) {
      return html`<div class="bg-red-200 font-medium px-4 py-2 sm:rounded text-lg text-red-700">You are not currently logged in.</div>`
    }
    return html``
  }
}
customElements.define('app-session', AppSession)