import { LitElement, html } from '../../vendor/lit/lit.min.js'
import * as session from '../lib/session.js'
import * as toast from '../com/toast.js'
import '../com/header.js'
import '../com/button.js'

class CtznForgotPassword extends LitElement {
  static get properties () {
    return {
      isProcessing: {type: Boolean},
      userHasPasswordChangeCode: {type: Boolean},
      isFinished: {type: Boolean},
      userId: {type: String}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.isProcessing = false
    this.userHasPasswordChangeCode = false
    this.isFinished = false
    this.userId = ''
  }

  async load () {
    document.title = `Forgot Password | CTZN`
    if (session.isActive()) {
      window.location = '/account'
    }
  }

  // rendering
  // =

  render () {
    return html`
      ${this.renderCurrentView()}
    `
  }

  renderCurrentView () {
    return html`
      <app-header></app-header>
      <main>
        <div class="mx-auto my-6 sm:my-12 max-w-lg px-8 sm:py-8 bg-white sm:rounded-2xl sm:border border-gray-300">
          <h2 class="mb-2 text-2xl">Forgot password</h2>
          ${this.isFinished ? html`
            <div class="bg-white border flex font-medium items-center mb-6 px-6 py-4 rounded-2xl shadow-md text-gray-700">
              <span class="fa-check-circle far mr-4 text-2xl text-green-600"></span>
              <span>Your password has been updated.</span>
            </div>
            <div class="text-center text-lg">
              You can now <a href="/" class="text-blue-600 hov:hover:underline">Log in</a> with your new password.
            </div>
          ` : this.userHasPasswordChangeCode ? html`
            <div class="bg-white border px-6 py-4 rounded-2xl shadow-md mb-6 text-center">
              Enter the code and your new password.
            </div>
            <label class="font-medium mb-2" for="passwordChangeCode">Code:</label>
            <input
              id="passwordChangeCode"
              class="block w-full box-border mb-2 p-4 border border-gray-300 rounded"
              placeholder="E.g. 000-0000-000"
              required
            >
            <label class="font-medium mb-2" for="newPassword">New password:</label>
            <input
              id="newPassword"
              type="password"
              class="block w-full box-border p-4 border border-gray-300 rounded mb-6"
              required
            >
            <div class="flex">
              <app-button label="Cancel" @click=${this.onClickCancel} ?disabled=${this.isProcessing}></app-button>
              <div class="flex-1"></div>
              <app-button
                primary
                label="Save"
                @click=${this.onClickSaveNewPassword}
                ?disabled=${this.isProcessing}
                ?spinner=${this.isProcessing}
              ></app-button>
            </div>
          ` : html`
            <div class="bg-white border px-6 py-4 rounded-2xl shadow-md mb-6 text-center">
              To change your password, we need to email a password-change code to you.
            </div>
            <label class="font-medium mb-2" for="userId">User ID:</label>
            <input
              id="userId"
              class="block w-full box-border p-4 border border-gray-300 rounded"
              placeholder="E.g. bob@ctzn.one"
              required
              @keyup=${e => {this.userId = e.currentTarget.value}}
            >
            <div class="mb-8 px-2 py-1 text-gray-600 text-sm">
              Note: this is your UserID, not your email address.
            </div>
            <div class="flex">
              <app-button label="Cancel" @click=${this.onClickCancel} ?disabled=${this.isProcessing}></app-button>
              <div class="flex-1"></div>
              <app-button
                btn-class="mr-2"
                label="I have a code"
                @click=${e => {this.userHasPasswordChangeCode = true}}
                ?disabled=${this.isProcessing || !this.userId}
              ></app-button>
              <app-button
                primary
                label="Send code"
                @click=${this.onClickSendPasswordChangeCode}
                ?disabled=${this.isProcessing || !this.userId}
                ?spinner=${this.isProcessing}
              ></app-button>
            </div>
          `}
        </div>
      </main>
    `
  }

  // events
  // =

  onClickCancel () {
    window.location = '/'
  }

  async onClickSendPasswordChangeCode (e) {
    this.isProcessing = true
    this.userId = this.querySelector('#userId').value
    try {
      await session.doRequestPasswordChangeCode(this.userId)
      toast.create('Check your inbox for the password change code', 'success')
      this.userHasPasswordChangeCode = true
    } catch (e) {
      console.error(e)
      toast.create(e.toString(), 'error')
    }
    this.isProcessing = false
  }

  async onClickSaveNewPassword (e) {
    this.isProcessing = true
    const passwordChangeCode = this.querySelector('#passwordChangeCode').value
    const newPassword = this.querySelector('#newPassword').value
    try {
      await session.doChangePasswordUsingCode(this.userId, passwordChangeCode, newPassword)
      toast.create('Password updated', 'success')
      this.isFinished = true
    } catch (e) {
      console.error(e)
      toast.create(e.toString(), 'error')
    }
    this.isProcessing = false
  }
}

customElements.define('app-forgot-password-view', CtznForgotPassword)
