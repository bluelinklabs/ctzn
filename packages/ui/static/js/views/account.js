import { LitElement, html } from '../../vendor/lit/lit.min.js'
import * as session from '../lib/session.js'
import * as toast from '../com/toast.js'
import '../com/header.js'
import '../com/button.js'

class CtznAccount extends LitElement {
  static get properties () {
    return {
      isChangingPassword: {type: Boolean},
      isProcessing: {type: Boolean},
      userHasPasswordChangeCode: {type: Boolean}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    document.title = `Account | CTZN`
    this.isChangingPassword = false
    this.isProcessing = false
    this.userHasPasswordChangeCode = false
  }

  // rendering
  // =

  render () {
    return html`
      ${this.renderCurrentView()}
    `
  }

  renderCurrentView () {
    if (!session.isActive()) {
      return html`
        <app-header></app-header>
        <main>
          <div class="text-gray-500 py-44 text-center my-5">
            <div class="fas fa-exclamation-triangle text-6xl text-gray-300 mb-8"></div>
            <div>You must sign in to access your account settings.</div>
          </div>
        </main>
      `
    }
    return html`
      <app-header></app-header>
      <main>
        <div class="mx-auto my-6 sm:my-12 max-w-lg px-8 sm:py-8 bg-white sm:rounded-2xl sm:border border-gray-300">
          <h2 class="mb-2 text-2xl">Account</h2>
          <div class="mb-4">
            Signed in as: ${session.info.userId}
          </div>
          ${this.isChangingPassword && this.userHasPasswordChangeCode ? html`
            <div class="bg-gray-50 bg-white p-4 rounded-2xl">
              <div class="bg-white border p-4 rounded-2xl shadow-md mb-4">
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
                  class="block w-full box-border p-4 border border-gray-300 rounded"
                  required
                >
              </div>
              <div class="flex">
                <app-button label="Cancel" @click=${this.onClickCancelChangePassword} ?disabled=${this.isProcessing}></app-button>
                <div class="flex-1"></div>
                <app-button
                  primary
                  label="Save"
                  @click=${this.onClickSaveNewPassword}
                  ?disabled=${this.isProcessing}
                  ?spinner=${this.isProcessing}
                ></app-button>
              </div>
            </div>
          ` : this.isChangingPassword ? html`
            <div class="bg-gray-50 bg-white p-4 rounded-2xl">
              <div class="bg-white border p-4 rounded-2xl shadow-md mb-4 text-center">
                To change your password, we need to send a password-change code to your email address.
              </div>
              <div class="flex">
                <app-button label="Cancel" @click=${this.onClickCancelChangePassword} ?disabled=${this.isProcessing}></app-button>
                <div class="flex-1"></div>
                <app-button btn-class="mr-2" label="I have a code" @click=${e => {this.userHasPasswordChangeCode = true}} ?disabled=${this.isProcessing}></app-button>
                <app-button
                  primary
                  label="Send code"
                  @click=${this.onClickSendPasswordChangeCode}
                  ?disabled=${this.isProcessing}
                  ?spinner=${this.isProcessing}
                ></app-button>
              </div>
            </div>
          ` : html`
            <div>
              <app-button label="Change Password" @click=${e => {this.isChangingPassword = true}}></app-button>
            </div>
          `}
        </div>
      </main>
    `
  }

  // events
  // =

  onClickCancelChangePassword () {
    this.isProcessing = false
    this.userHasPasswordChangeCode = false
    this.isChangingPassword = false
  }

  async onClickSendPasswordChangeCode (e) {
    this.isProcessing = true
    try {
      await session.api.accounts.requestChangePasswordCode(session.info.username)
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
      await session.api.accounts.changePasswordUsingCode(session.info.username, passwordChangeCode, newPassword)
      toast.create('Password updated', 'success')
      this.isChangingPassword = false
      this.userHasPasswordChangeCode = false
    } catch (e) {
      console.error(e)
      toast.create(e.toString(), 'error')
    }
    this.isProcessing = false
  }
}

customElements.define('app-account-view', CtznAccount)
