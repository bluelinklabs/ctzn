import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import * as session from '../lib/session.js'

class IssueView extends LitElement {
  static get properties () {
    return {
      id: {type: String},
      issue: {type: Object},
      currentError: {type: String},
      isAttemptingRecovery: {type: Boolean},
      wasRecoverySuccessful: {type: Boolean},
      wasDismissed: {type: Boolean}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.id = undefined
    this.issue = undefined
    this.currentError = undefined
    this.isAttemptingRecovery = undefined
    this.wasRecoverySuccessful = undefined
    this.wasDismissed = undefined
  }

  updated (changedProperties) {
    if (changedProperties.has('id')) {
      this.load()
    }
  }

  async load () {
    await session.setup()
    const issues = await session.api.server.listIssues()
    const issue = issues.find(issue => issue.id === this.id)
    if (issue) this.issue = issue
    console.log(this.issue, this.id, issues)
  }

  render () {
    if (this.wasDismissed === true) {
      return html`
        <div class="px-3 pt-2 pb-3 mb-0.5 border-b-2 border-pink-600">
          <a class="cursor-pointer" href="/admin/issues">
            <span class="fas fa-fw fa-arrow-left"></span>
          </a>
        </div>
        <div class="px-4 py-3 mt-2 mb-1 rounded bg-pink-100 text-pink-800 font-medium">
          <span class="fas fa-fw fa-check"></span> Issue dismissed
        </div>
      `
    }
    if (typeof this.issue === 'undefined') {
      return html`<div>Loading...</div>`
    }
    return html`
      <div class="px-3 pt-2 pb-3 mb-0.5 border-b-2 border-pink-600">
        <a class="cursor-pointer" href="/admin/issues">
          <span class="fas fa-fw fa-arrow-left"></span>
        </a>
      </div>
      ${this.currentError ? html`
        <div class="bg-red-100 text-red-700 sm:rounded px-3 py-2 mb-1">
          <span class="fas fa-exclamation-triangle fa-fw"></span> ${this.currentError}
        </div>
      ` : ''}
      <div class="px-3 pt-3 pb-4">
        <div class="text-sm font-semibold text-gray-800">Description</div>
        <div class="mb-4 text-2xl font-semibold">${this.issue.entries[0].description}</div>
        <div class="flex">
          <div class="mr-6">
            <div class="text-sm font-semibold text-gray-800">Repetitions</div>
            <div class="mb-4">${this.issue.entries.length}</div>
          </div>
          <div class="flex-1">
            <div class="text-sm font-semibold text-gray-800">Issue ID</div>
            <div class="mb-4">${this.issue.id}</div>
          </div>
        </div>
        <div class="text-sm font-semibold text-gray-800">Cause</div>
        <div class="mb-4 px-3 py-2 bg-gray-50 rounded font-mono text-sm whitespace-pre">${this.issue.entries[0].cause}</div>
        <div class="text-sm font-semibold text-gray-800">Error</div>
        <div class="px-3 py-2 bg-gray-50 rounded font-mono text-sm whitespace-pre">${this.issue.entries[0].error}</div>
        <div class="pt-4">
          ${this.issue.entries[0].canRecover ? html`
            <button
              class="rounded mr-2 px-3 py-1 border border-gray-300 shadow-sm hover:bg-gray-50"
              @click=${this.onClickAttemptRecovery}
            >
              Attempt recovery
            </button>
          ` : html`
            <span class="inline-block rounded mr-2 px-3 py-1 bg-gray-100 text-gray-700 border border-gray-200">
              Automated recovery not possible
            </span>
          `}
          <button
            class="rounded mr-2 px-3 py-1 border border-gray-300 shadow-sm hover:bg-gray-50"
            @click=${this.onClickDismiss}
          >
            Dismiss issue
          </button>
          <button
            class="rounded mr-2 px-3 py-1 border border-gray-300 shadow-sm hover:bg-gray-50"
            @click=${this.onClickDismissAndIgnore}
          >
            Dismiss and ignore
          </button>
        </div>
        ${this.isAttemptingRecovery ? html`
          <div class="px-4 py-3 mt-2 rounded bg-pink-100 text-pink-800 font-medium">
            Attempting to recover...
          </div>
        ` : ''}
        ${this.wasRecoverySuccessful === true ? html`
          <div class="px-4 py-3 mt-2 rounded bg-green-100 text-green-800 font-medium">
            <span class="fas fa-fw fa-check"></span> Recovery appears to have been successful
          </div>
        ` : ''}
        ${this.wasRecoverySuccessful === false ? html`
          <div class="px-4 py-3 mt-2 rounded bg-yellow-100 text-yellow-800 font-medium">
            <span class="fas fa-fw fa-exclamation-triangle"></span> Recovery appears to have failed
          </div>
        ` : ''}
      </div>
    `
  }

  // events
  // =

  async onClickAttemptRecovery (e) {
    if (this.isAttemptingRecovery) return
    this.isAttemptingRecovery = true
    this.wasRecoverySuccessful = undefined
    await session.api.server.recoverIssue(this.id)
    await new Promise(r => setTimeout(r, 2000)) // give a second to attempt recovery
    await this.load()
    this.isAttemptingRecovery = false
    this.wasRecoverySuccessful = !this.issue
  }

  async onClickDismiss (e) {
    if (!confirm('Are you sure?')) return
    await session.api.server.dismissIssue(this.id)
    await this.load()
    this.wasDismissed = true
  }

  async onClickDismissAndIgnore (e) {
    if (!confirm('Are you sure?')) return
    await session.api.server.dismissIssue(this.id, {ignoreFuture: true})
    await this.load()
    this.wasDismissed = true
  }
}
customElements.define('app-issue-view', IssueView)