import { LitElement, html } from '../../vendor/lit/lit.min.js'
import * as toast from '../com/toast.js'
import * as contextMenu from '../com/context-menu.js'
import { PageEditorPopup } from '../com/popups/page-editor.js'
import { joinPath } from '../lib/strings.js'
import * as session from '../lib/session.js'
import { decodeBase64 } from '../lib/strings.js'
import { shortDate } from '../lib/time.js'
import { writeToClipboard } from '../lib/clipboard.js'
import { AVATAR_URL } from '../lib/const.js'
import { emit } from '../lib/dom.js'
import '../com/header.js'
import '../com/button.js'
import '../com/custom-html.js'
import '../com/subnav.js'

class CtznPageView extends LitElement {
  static get properties () {
    return {
      currentPath: {type: String, attribute: 'current-path'},
      authorProfile: {type: Object},
      subject: {type: Object},
      pageRecord: {type: Object},
      pageContent: {type: Object},
      canEdit: {type: Boolean},
      loadError: {type: Object}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.authorProfile = undefined
    this.subject = undefined
    this.pageRecord = undefined
    this.pageContent = undefined
    this.canEdit = false
    this.loadError = undefined
  }


  async load () {
    this.scrollToOnLoad = undefined
    let pathname = window.location.pathname
    let [userId, schemaDomain, schemaName, key] = pathname.split('/').filter(Boolean)

    try {
      this.canEdit = false
      this.pageRecord = undefined
      this.pageContent = undefined
      this.authorProfile = await session.ctzn.getProfile(userId)
      this.subject = {
        authorId: userId,
        pageId: key,
        dbUrl: joinPath(this.authorProfile.dbUrl, schemaDomain, schemaName, key)
      }

      this.pageRecord = await session.ctzn.db(userId).table('ctzn.network/page').get(key)
      console.log(this.pageRecord)
      if (this.pageRecord?.value?.content?.blobName) {
        document.title = `${this.pageRecord.value.title || 'Page'} by ${this.authorProfile?.value.displayName || userId} | CTZN`
        let base64buf = (await session.ctzn.getBlobByHomeServer(userId, this.pageRecord.value.content.blobName))?.buf
        if (base64buf) this.pageContent = decodeBase64(base64buf)
        else this.pageContent = ''
      } else {
        this.loadError = 'Page not found'
        document.title = '404 Not Found | CTZN'
      }

      if (session.isActive() && this.subject?.authorId) {
        if (this.subject.authorId === session.info?.userId) {
          this.canEdit = true
        } else {
          const perm = await session.ctzn.getCommunityUserPermission(
            this.subject.authorId,
            session.info.userId,
            'ctzn.network/perm-manage-pages'
          ).catch(e => undefined)
          if (!!perm) {
            this.canEdit = true
          }
        }
      }
    } catch (e) {
      this.loadError = e
      document.title = 'Page not available | CTZN'
    }
  }

  async refresh () {
    await this.load()
  }

  updated (changedProperties) {
    if (changedProperties.get('currentPath')) {
      this.load()
    }
  }

  // rendering
  // =

  render () {
    return html`
      <app-header></app-header>
      <div>
        ${this.renderCurrentView()}
      </div>
    `
  }

  renderHeader () {
    if (!this.subject) {
      return ''
    }
    const SUBNAV_ITEMS = [
      {back: true, label: html`<span class="fas fa-angle-left"></span>`},
      {path: location.pathname, label: 'View page'}
    ]
    return html`
      <app-subnav
        mobile-only
        nav-cls=""
        .items=${SUBNAV_ITEMS}
        current-path=${location.pathname}
      ></app-subnav>
      <div class="border-b border-gray-200">
        <main class="wide flex items-center py-2 text-gray-500 text-sm px-2 sm:px-0">
          <a href="/${this.subject.authorId}" class="mr-2">
            <img
              class="block w-5 h-5 object-cover rounded"
              src=${AVATAR_URL(this.subject.authorId)}
            >
          </a>
          <a
            href="/${this.subject.authorId}/pages"
            class="font-bold text-gray-500 text-sm truncate mr-3 hov:hover:underline"
          >
            ${this.authorProfile?.value?.displayName || this.subject.authorId}
          </a>
          <span class="fas fa-chevron-right text-gray-500 mr-3" style="font-size: 10px"></span>
          <span class="font-bold text-gray-500 text-sm truncate mr-3">
            ${this.pageRecord?.value?.title || this.subject.pageId}
          </span>
          <span class="ml-auto mobile-hidden">
            Updated
            ${this.pageRecord?.value ? shortDate(this.pageRecord.value.updatedAt || this.pageRecord.value.createdAt) : ''}
          </span>
          ${this.canEdit ? html`
            <app-button
              transparent
              class="ml-1 mobile-hidden"
              btn-class="text-xs px-3 py-1"
              icon="fas fa-pen mr-1"
              label="Edit"
              @click=${this.onClickEdit}
            ></app-button>
            <app-button
              transparent
              class="mobile-hidden"
              btn-class="text-xs px-3 py-1 hov:hover:text-red-600"
              icon="far fa-trash-alt"
              @click=${this.onClickDelete}
            ></app-button>
          ` : ''}
        </main>
        <main class="wide mobile-only-flex items-center py-1 text-gray-500 bg-gray-50 border-t border-gray-200 text-sm px-2">
          <span class="">
            Updated
            ${this.pageRecord?.value ? shortDate(this.pageRecord.value.updatedAt || this.pageRecord.value.createdAt) : ''}
          </span>
          ${this.canEdit ? html`
            <app-button
              transparent
              class="ml-auto"
              btn-class="text-xs px-3 py-1"
              icon="fas fa-pen mr-1"
              label="Edit"
              @click=${this.onClickEdit}
            ></app-button>
            <app-button
              transparent
              btn-class="text-xs px-3 py-1 hov:hover:text-red-600"
              icon="far fa-trash-alt"
              @click=${this.onClickDelete}
            ></app-button>
          ` : ''}
        </main>
      </div>
    `
  }

  renderCurrentView () {
    if (this.loadError) {
      return this.renderError()
    }
    if (!this.authorProfile) {
      return this.renderLoading()
    }
    return this.renderPage()
  }

  renderError () {
    return html`
      <div class="text-gray-500 py-44 text-center my-5">
        <div class="fas fa-exclamation-triangle text-6xl text-gray-300 mb-8"></div>
        <div>There was an error while trying to load this content.</div>
        <pre class="py-2">${this.loadError.toString()}</pre>
      </div>
    `
  }

  renderLoading () {
    return html`
      ${this.renderHeader()}
      <main>
        <div class="py-32 text-center text-gray-400">
          <span class="spinner h-7 w-7"></span>
        </div>
      </main>
    `
  }

  renderPage () {
    return html`
      ${this.renderHeader()}
      <main class="wide px-3 sm:px-0">
        <div class="min-h-screen">
          ${typeof this.pageContent === 'undefined' ? html`
            <span class="spinner"></span>
          ` : this.pageContent ? html`
            <app-custom-html
              context="page"
              .contextState=${{page: {userId: this.subject.authorId}}}
              .html=${this.pageContent}
            ></app-custom-html>
          ` : html`
            <em>This page is empty</em>
          `}
        </div>
      </main>
    `
  }

  renderNotFound () {
    return html`
      <div class="bg-gray-100 text-gray-500 py-44 text-center my-5">
        <div class="fas fa-exclamation-triangle text-6xl text-gray-300 mb-8"></div>
        <div>404 Not Found</div>
      </div>
    `
  }

  // events
  // =

  async onClickEdit (e) {
    var res = await PageEditorPopup.create({
      userId: this.subject.authorId,
      pageRecord: this.pageRecord,
      pageContent: this.pageContent,
      context: 'page',
      contextState: {page: {userId: this.userId}},
      placeholder: 'Create your page here!',
      canSave: this.canEdit
    })
    if (res.id !== this.pageRecord?.value?.id) {
      emit(this, 'navigate-to', {detail: {url: `/${this.subject.authorId}/ctzn.network/page/${res.id}`}})
    } else {
      this.load()
    }
  }

  async onClickDelete () {
    if (!this.canEdit) return
    if (!confirm('Are you sure you want to delete this page?')) {
      return
    }
    try {
      if (this.subject.authorId === session.info.userId) {
        await session.ctzn.user.table('ctzn.network/page').delete(this.subject.pageId)
        toast.create('Page deleted')
        emit(this, 'navigate-to', {detail: {url: `/${this.subject.authorId}/pages`}})
      } else {
        const res = await session.ctzn.db(this.subject.authorId).method(
          'ctzn.network/delete-page-method',
          {id: this.subject.pageId}
        )
        if (res.pending()) {
          toast.create('Delete is queued, check back later')
        } else {
          toast.create('Page deleted')
          emit(this, 'navigate-to', {detail: {url: `/${this.subject.authorId}/pages`}})
        }
      }
    } catch (e) {
      console.log(e)
      toast.create(e.toString(), 'error')
    }
  }

  // onClickMenu (e) {
  //   e.preventDefault()
  //   e.stopPropagation()
  //   const rect = e.currentTarget.getClientRects()[0]
  //   let items = [
  //     {
  //       icon: 'fas fa-fw fa-link',
  //       label: 'Copy link',
  //       click: () => {
  //         writeToClipboard(window.location.toString())
  //         toast.create('Copied to clipboard')
  //       }
  //     }
  //   ]
  //   if (this.canEdit) {
  //     items.push('-')
  //     items.push({
  //       icon: 'fas fa-fw fa-trash',
  //       label: 'Delete post',
  //       click: () => {
  //         if (!confirm('Are you sure you want to delete this post?')) {
  //           return
  //         }
  //         this.onDeletePost()
  //       }
  //     })
  //   }
  //   contextMenu.create({
  //     x: rect.right,
  //     y: rect.bottom,
  //     right: true,
  //     roomy: true,
  //     noBorders: true,
  //     style: `padding: 4px 0; font-size: 13px`,
  //     items
  //   })
  // }
}

customElements.define('app-page-view', CtznPageView)
