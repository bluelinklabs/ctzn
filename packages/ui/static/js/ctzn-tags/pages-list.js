import { LitElement, html } from '../../vendor/lit/lit.min.js'
import { repeat } from '../../vendor/lit/directives/repeat.js'
import * as session from '../lib/session.js'
import { PageEditorPopup } from '../com/popups/page-editor.js'
import '../com/button.js'

export class PagesList extends LitElement {
  static get properties () {
    return {
      userId: {type: String, attribute: 'user-id'},
      pages: {type: Array},
      canEdit: {type: Boolean}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.setAttribute('ctzn-elem', '1')
    this.pages = undefined
    this.canEdit = false
  }

  setContextState (state) {
    if (state?.page?.userId) {
      if (!this.userId) {
        this.userId = state.page.userId
      }
    }
  }

  updated (changedProperties) {
    if (changedProperties.has('userId') && this.userId !== changedProperties.get('userId')) {
      this.load()
    }
  }

  async load () {
    this.canEdit = false
    this.pages = undefined
    this.pages = await session.ctzn.db(this.userId).table('ctzn.network/page').list()
    if (session.isActive()) {
      if (this.userId === session.info?.userId) {
        this.canEdit = true
      } else {
        const perm = await session.ctzn.getCommunityUserPermission(
          this.userId,
          session.info.userId,
          'ctzn.network/perm-manage-pages'
        ).catch(e => undefined)
        if (!!perm) {
          this.canEdit = true
        }
      }
    }
  }

  // rendering
  // =

  render () {
    if (typeof this.pages === 'undefined') {
      return html`
        <div class="px-5 py-3">
          <span class="text-lg font-medium mr-1">Pages</span>
          <span class="spinner text-gray-500"></span>
        </div>
      `
    }
    return html`
      <div class="">
        <div class="px-5 py-3">
          <div class="flex items-center justify-between">
            <span>
              <span class="text-lg font-medium mr-1">Pages</span>
              <span class="text-gray-500 font-bold">${this.pages?.length || '0'}</span>
            </span>
            ${this.canEdit ? html`
              <span class="tooltip-left" data-tooltip="Create New Page">
                <app-button
                  transparent
                  btn-class="py-1"
                  icon="fas fa-plus"
                  @click=${this.onClickNew}
                ></app-button>
              </span>
            ` : ''}
          </div>
        </div>
        ${repeat(this.pages || [], page => page.key, page => html`
          <div class="px-4 py-2 border-t border-gray-200">
            <a
              class="text-blue-600 font-medium hov:hover:underline"
              href="/${this.userId}/ctzn.network/page/${page.key}"
            >${page.value.title}</a>
          </div>
        `)}
      </div>
    `
  }

  // events
  // =

  async onClickNew (e) {
    e.preventDefault()
    e.stopPropagation()

    await PageEditorPopup.create({
      userId: this.userId,
      context: 'page',
      contextState: {page: {userId: this.userId}},
      placeholder: 'Create your page here!',
      canSave: this.canEdit
    })
    this.load()
  }
}

customElements.define('ctzn-pages-list', PagesList)
