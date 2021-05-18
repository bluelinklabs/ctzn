/* globals beaker */
import { html } from '../../../vendor/lit/lit.min.js'
import { BasePopup } from './base.js'
import * as session from '../../lib/session.js'
import '../button.js'

// exported api
// =

export class CreateCommunityPopup extends BasePopup {
  static get properties () {
    return {
      currentError: {type: String},
      isCreating: {type: Boolean},
      username: {type: String},
      displayName: {type: String},
      description: {type: String}
    }
  }

  constructor (opts) {
    super()
    this.currentError = undefined
    this.isCreating = false
    this.username = ''
    this.displayName = ''
    this.description = ''
  }

  get shouldShowHead () {
    return false
  }

  get maxWidth () {
    return '520px'
  }

  // management
  //

  static async create (opts) {
    return BasePopup.create(CreateCommunityPopup, opts)
  }

  static destroy () {
    return BasePopup.destroy('create-community-popup')
  }

  // rendering
  // =

  renderBody () {
    return html`
      <form class="px-2" @submit=${this.onSubmit}>
        <h2 class="text-3xl py-4">Create a community</h2>

        <section class="mb-2">
          <label class="block font-semibold p-1" for="username-input">Community ID</label>
          <input
            required
            type="text"
            id="username-input"
            name="username"
            class="block box-border w-full border border-gray-300 rounded p-3"
            placeholder="e.g. 'friends' or 'cool-hackers'"
            value=${this.username}
            @keyup=${this.onKeyupUsername}
          />
        </section>

        <section class="mb-2">
          <label class="block font-semibold p-1" for="displayName-input">Display name</label>
          <input
            required
            type="text"
            id="displayName-input"
            name="displayName"
            class="block box-border w-full border border-gray-300 rounded p-3"
            placeholder="e.g. 'Friends' or 'Cool Hackers'"
            value=${this.displayName}
            @keyup=${this.onKeyupDisplayName}
          />
        </section>

        <section class="mb-2">
          <label class="block font-semibold p-1" for="description-input">Description</label>
          <input
            type="text"
            id="description-input"
            name="description"
            class="block box-border w-full border border-gray-300 rounded p-3"
            placeholder="e.g. 'A cool place for cool people'"
            value=${this.description}
            @keyup=${this.onKeyupDescription}
          />
        </section>

        ${this.currentError ? html`
          <div class="error">${this.currentError}</div>
        ` : ''}

        <div class="flex justify-between border-t border-gray-200 mt-4 pt-4">
          <app-button @click=${this.onReject} tabindex="2" label="Cancel"></app-button>
          <app-button
            primary
            btn-type="submit"
            tabindex="1"
            ?disabled=${this.isCreating || !this.username || !this.displayName}
            ?spinner=${this.isCreating}
            label="Create Community"
          ></app-button>
        </div>
      </form>
    `
  }

  firstUpdated () {
    this.querySelector('input').focus()
  }

  // events
  // =

  onKeyupUsername (e) {
    this.username = e.currentTarget.value.trim().replace(/[^A-z0-9-]/gi, '').slice(0, 64)
    if (e.currentTarget.value !== this.username) {
      e.currentTarget.value = this.username
    }
    this.requestUpdate()
  }

  onKeyupDisplayName (e) {
    this.displayName = e.currentTarget.value.slice(0, 64)
    if (e.currentTarget.value !== this.displayName) {
      e.currentTarget.value = this.displayName
    }
    this.requestUpdate()
  }

  onKeyupDescription (e) {
    this.description = e.currentTarget.value.slice(0, 256)
    if (e.currentTarget.value !== this.description) {
      e.currentTarget.value = this.description
    }
    this.requestUpdate()
  }

  async onSubmit (e) {
    e.preventDefault()
    e.stopPropagation()

    if (this.isCreating) return
    this.isCreating = true

    let res
    this.currentError = undefined
    try {
      res = await session.api.communities.create({
        username: this.username,
        displayName: this.displayName,
        description: this.description
      })
    } catch (e) {
      let error = e.toString()
      if (error.includes('Validation Error')) {
        if (error.includes('/username')) {
          this.currentError = 'Username must be 2 to 64 characters long, only include characters or numbers, and start with a letter.'
        } else if (error.includes('/displayName')) {
          this.currentError = 'Display name must be 1 to 64 characters long.'
        } else if (error.includes('/desc')) {
          this.currentError = 'Description must be 256 characters or less.'
        } else {
          this.currentError = error
        }
      } else {
        this.currentError = error
      }
      return
    } finally {
      this.isCreating = false
    }
    await session.loadSecondaryState()
    this.dispatchEvent(new CustomEvent('resolve', {detail: res}))
  }
}

customElements.define('create-community-popup', CreateCommunityPopup)