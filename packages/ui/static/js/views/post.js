import { LitElement, html } from '../../vendor/lit/lit.min.js'
import * as toast from '../com/toast.js'
import * as contextMenu from '../com/context-menu.js'
import { joinPath, ucfirst } from '../lib/strings.js'
import * as session from '../lib/session.js'
import * as displayNames from '../lib/display-names.js'
import { writeToClipboard } from '../lib/clipboard.js'
import { AVATAR_URL, FULL_POST_URL } from '../lib/const.js'
import '../com/header.js'
import '../com/button.js'
import '../com/thread.js'
import '../com/user-list.js'
import '../com/subnav.js'

class CtznPostView extends LitElement {
  static get properties () {
    return {
      currentPath: {type: String, attribute: 'current-path'},
      authorProfile: {type: Object},
      subject: {type: Object},
      post: {type: Object},
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
    this.post = undefined
    this.loadError = undefined
    this.scrollToOnLoad = undefined
  }

  get communityUserId () {
    return this.post?.value?.community?.userId
  }

  get isMyPost () {
    if (!session.isActive() || !this.post?.author.userId) {
      return false
    }
    return session.info?.userId === this.post?.author.userId
  }

  async load () {
    this.scrollToOnLoad = undefined
    let pathname = window.location.pathname
    let [userId, schemaDomain, schemaName, key] = pathname.split('/').filter(Boolean)

    try {
      this.post = undefined
      this.authorProfile = await session.ctzn.getProfile(userId)
      this.subject = {
        authorId: userId,
        dbUrl: joinPath(this.authorProfile.dbUrl, schemaDomain, schemaName, key)
      }
    } catch (e) {
      this.loadError = e
    }
    document.title = `${ucfirst(schemaName)} by ${this.authorProfile?.value.displayName || userId} | CTZN`
  }

  async refresh () {
    await this.querySelector('app-thread')?.load()
  }

  async pageLoadScrollTo (y) {
    await this.requestUpdate()
    this.scrollToOnLoad = y
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
    const SUBNAV_ITEMS = [
      {back: true, label: html`<span class="fas fa-angle-left"></span>`},
      {path: location.pathname, label: 'View post'},
      {rightAlign: true, click: this.onClickMenu.bind(this), label: html`<span class="fas fa-ellipsis-h cursor-pointer hov:hover:text-gray-700 text-xl text-gray-600"></span>`} 
    ]
    return html`
      <app-subnav
        nav-cls="sm:relative sm:border sm:border-t-0 sm:border-gray-300"
        .items=${SUBNAV_ITEMS}
        current-path=${location.pathname}
      ></app-subnav>
      <div class="context-menu-container"></div>
    `
  }

  renderRightSidebar () {
    return html`
      <nav class="pt-4">
        <app-user-list
          id="profile-card"
          class="block sticky top-18"
          cols="1"
          .ids=${[this.authorProfile.userId]}
        ></app-user-list>
      </nav>
    `
  }

  renderCurrentView () {
    if (this.loadError) {
      return this.renderError()
    }
    if (!this.authorProfile) {
      return this.renderLoading()
    }
    return this.renderThread()
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
      <main>
        ${this.renderHeader()}
        <div class="py-32 text-center text-gray-400">
          <span class="spinner h-7 w-7"></span>
        </div>
      </main>
    `
  }

  renderThread () {
    return html`
      <main class="col2 mb-32">
        <div class="">
          ${this.renderHeader()}
          <div class="min-h-screen sm:bg-transparent sm:pb-2">
            ${this.subject ? html`
              <app-thread
                class="block sm:border sm:border-t-0 sm:border-gray-300 sm:pb-1"
                .subject=${this.subject}
                @load=${this.onLoadThread}
              ></app-thread>
            ` : ''}
          </div>
        </div>
        ${this.renderRightSidebar()}
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

  onLoadThread (e) {
    this.post = e.detail.post
    if (this.scrollToOnLoad) {
      window.scrollTo(0, this.scrollToOnLoad)
    } else {
      this.querySelector('app-thread')?.scrollHighlightedPostIntoView()
    }
  }

  onClickBack (e) {
    e.preventDefault()
    if (window.history.length > 1) {
      window.history.back()
    } else {
      window.location = '/'
    }
  }

  onClickMenu (e) {
    e.preventDefault()
    e.stopPropagation()
    let items = [
      {
        icon: 'fas fa-fw fa-link',
        label: 'Copy link',
        click: () => {
          writeToClipboard(FULL_POST_URL(this.post))
          toast.create('Copied to clipboard')
        }
      }
    ]
    if (this.isMyPost) {
      items.push('-')
      items.push({
        icon: 'fas fa-fw fa-trash',
        label: 'Delete post',
        click: () => {
          if (!confirm('Are you sure you want to delete this post?')) {
            return
          }
          this.onDeletePost()
        }
      })
    }
    if (this.communityUserId && session.isInCommunity(this.communityUserId)) {
      items.push(
        session.ctzn.view(
          'ctzn.network/community-user-permission-view',
          this.communityUserId,
          session.info.userId,
          'ctzn.network/perm-community-remove-post'
        ).then(perm => {
          if (perm) {
            return html`
              <div class="dropdown-item" @click=${() => this.onClickModeratorRemove()}>
                <i class="fas fa-times fa-fw"></i>
                Remove post (moderator)
              </div>
            `
          } else {
            return ''
          }
        })
      )
    }

    let parent, x, y
    if (matchMedia('(max-width: 640px)').matches) {
      let rect = e.currentTarget.getClientRects()[0]
      x = rect.right
      y = rect.bottom
    } else {
      parent = this.querySelector('.context-menu-container')
      let rect = parent.getClientRects()[0]
      x = rect.width
      y = 0
    }

    contextMenu.create({
      parent,
      x,
      y,
      right: true,
      roomy: true,
      noBorders: true,
      style: `padding: 4px 0; font-size: 13px`,
      items
    })
  }

  async onDeletePost () {
    try {
      await session.ctzn.user.table('ctzn.network/post').delete(this.post.key)
      toast.create('Post deleted')
      this.load()
    } catch (e) {
      console.log(e)
      toast.create(e.toString(), 'error')
    }
  }

  async onClickModeratorRemove () {
    contextMenu.destroy()
    if (!confirm('Are you sure you want to remove this post?')) {
      return
    }
    try {
      await session.ctzn.db(this.communityUserId).method(
        'ctzn.network/community-remove-content-method',
        {contentUrl: this.post.url}
      )
      this.load()
    } catch (e) {
      console.log(e)
      toast.create(e.toString(), 'error')
    }
  }
}

customElements.define('app-post-view', CtznPostView)
