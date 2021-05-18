import { LitElement, html } from '../../vendor/lit/lit.min.js'
import * as toast from '../com/toast.js'
import * as session from '../lib/session.js'
import { ComposerPopup } from '../com/popups/composer.js'
import '../com/header.js'
import '../com/button.js'
import '../com/login.js'
import '../ctzn-tags/posts-feed.js'
import '../com/inbox.js'
import '../com/notifications-feed.js'
import '../com/post-composer.js'
import '../com/img-fallbacks.js'
import '../com/suggestions-sidebar.js'
import '../com/searchable-user-list.js'
import '../com/subnav.js'

class CtznMainView extends LitElement {
  static get properties () {
    return {
      currentPath: {type: String, attribute: 'current-path'},
      currentView: {type: String},
      searchQuery: {type: String},
      numUnreadNotifications: {type: Number},
      lastFeedFetch: {type: Number}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.searchQuery = ''
    this.numUnreadNotifications = 0
    this.lastFeedFetch = undefined

    const pathParts = (new URL(location)).pathname.split('/')
    this.currentView = pathParts[1] || 'feed'
  }

  async load () {
    document.title = `CTZN`
    if (!session.isActive()) {
      if (location.pathname !== '/') {
        window.location = '/'
      } else {
        document.body.classList.add('no-pad')
      }
      return this.requestUpdate()
    }
    const pathParts = (new URL(location)).pathname.split('/')
    this.currentView = pathParts[1] || 'feed'
    this.querySelector('ctzn-posts-feed')?.load()
  }

  async refresh () {
    await this.querySelector('ctzn-posts-feed')?.load()
  }

  async pageLoadScrollTo (y) {
    await this.requestUpdate()
    this.querySelector('ctzn-posts-feed')?.pageLoadScrollTo(y)
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
      return this.renderNoSession()
    }
    return this.renderWithSession()
  }

  renderNoSession () {
    return html`
      <div class="bg-gray-700 border-gray-200 fixed py-2 text-center text-gray-100 w-full" style="top: 0; left: 0">
        <span class="font-bold text-gray-50">Alpha Release</span>.
        This is a preview build of CTZN.
      </div>
      <div class="hidden lg:block" style="margin-top: 15vh">
        <div class="flex my-2 max-w-4xl mx-auto">
          <div class="flex-1 py-20 text-gray-800 text-lg">
            <h1 class="font-semibold mb-1 text-6xl tracking-widest">CTZN<span class="font-bold text-3xl text-gray-500 tracking-normal" data-tooltip="Alpha Version">α</span></h1>
            <div class="mb-6 text-gray-500 text-2xl tracking-tight">(Pronounced "Citizen")</div>
            <div class="mb-8 text-2xl">
              Build your community in a decentralized<br>social network.
            </div>
            <div class="mb-6 text-blue-600 hov:hover:underline">
              <a href="https://github.com/pfrazee/ctzn" title="Learn more about CTZN" target="_blank">
                <span class="fas fa-external-link-alt fa-fw"></span>
                Learn more about CTZN
              </a>
            </div>
          </div>
          <div class="w-96">
            <app-login class="block border border-gray-300 overflow-hidden rounded-2xl shadow-xl"></app-login>
          </div>
        </div>
      </div>
      <div class="block lg:hidden">
        <div class="max-w-lg mx-auto bg-white sm:border sm:border-gray-300 sm:my-8 sm:rounded-2xl sm:shadow-xl">
          <div class="text-center pt-20 pb-14 text-gray-800 text-lg border-b border-gray-300">
            <h1 class="font-semibold mb-1 text-6xl tracking-widest">CTZN<span class="font-bold text-3xl text-gray-500 tracking-normal">α</span></h1>
            <div class="mb-6 text-gray-500 text-2xl tracking-tight">(Pronounced "Citizen")</div>
            <div class="mb-6 text-xl px-4">
              Build your community in a decentralized social network.
            </div>
            <div class="mb-6 text-blue-600 hov:hover:underline">
              <a href="https://github.com/pfrazee/ctzn" title="Learn more about CTZN" target="_blank">
                Learn more about CTZN
              </a>
            </div>
          </div>
          <div>
            <app-login></app-login>
          </div>
        </div>
      </div>
    `
  }

  renderWithSession () {
    const SUBNAV_ITEMS = [
      {menu: true, mobileOnly: true, label: html`<span class="fas fa-bars"></span>`},
      {path: '/', label: 'Feed'},
      {
        path: '/notifications',
        label: html`
          ${this.numUnreadNotifications > 0 ? html`
            <span class="inline-block text-sm px-2 bg-blue-600 text-white rounded-full">${this.numUnreadNotifications}</span>
          ` : ''}
          Notifications
        `
      },
      {path: '/search', label: 'Search'}
    ]
    if (this.currentView === 'inbox') {
      return html`
        <app-header
          current-path=${this.currentPath}
          @post-created=${e => this.load()}
          @unread-notifications-changed=${this.onUnreadNotificationsChanged}
        ></app-header>
        <main class="wide">
          <app-subnav
            mobile-only
            nav-cls=""
            .items=${SUBNAV_ITEMS}
            current-path=${this.currentPath}
          ></app-subnav>
          <h2 class="text-2xl tracking-tight font-bold p-4 border-l border-r border-gray-300 hidden lg:block">Inbox</h2>
          <app-inbox
            @load-state-updated=${this.onFeedLoadStateUpdated}
            @publish-reply=${this.onPublishReply}
          ></app-inbox>
        </main>
      `
    }
    return html`
      <app-header
        current-path=${this.currentPath}
        @post-created=${e => this.load()}
        @unread-notifications-changed=${this.onUnreadNotificationsChanged}
      ></app-header>
      <!-- <div class="rainbow-gradient" style="height: 1px"></div> -->
      <!-- <div class="rainbow-gradient-pattern" style="height: 4px"></div> -->
      <main class="col2">
        <div>
          <app-subnav
            mobile-only
            nav-cls=""
            .items=${SUBNAV_ITEMS}
            current-path=${this.currentPath}
          ></app-subnav>
          ${this.currentView === 'feed' ? html`
            ${this.renderMockComposer()}
            <h2 class="p-4 border-l border-r border-gray-300 hidden lg:flex items-baseline">
              <span class="text-2xl tracking-tight font-bold">What's new</span>
              <span class="ml-2 text-gray-400 text-sm tracking-tight">${this.lastFeedFetch ? `Updated ${this.lastFeedFetch}` : ''}</span>
            </h2>
            <ctzn-posts-feed
              class="block sm:border border-t border-gray-300"
              view="ctzn.network/feed-view"
              @publish-reply=${this.onPublishReply}
              @fetched-latest=${e => {this.lastFeedFetch = (new Date()).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}}
            ></ctzn-posts-feed>
          ` : this.currentView === 'search' ? html`
            <div class="bg-white sm:border sm:border-t-0 border-gray-300">
              <div class="text-sm px-3 py-3 text-gray-500">
                <span class="fas fa-info mr-1 text-xs"></span>
                Search is limited to your communities and follows.
              </div>
              <app-searchable-user-list></app-searchable-user-list>
            </div>
          ` : ''}
        </div>
        ${this.renderRightSidebar()}
      </main>
    `
  }

  renderMockComposer () {
    return html`
      <div class="sm:border-l sm:border-r border-gray-300 px-3 py-3 lg:hidden" @click=${this.onClickCreatePost}>
        <div class="flex items-center">
          <div
            class="flex-1 mr-1 py-1 px-3 bg-gray-100 text-gray-600 text-base rounded cursor-text"
          >What's new?</div>
          <app-button
            transparent
            btn-class="text-sm px-2 py-1 sm:px-4"
            label="Add Image"
            icon="far fa-image"
            @click=${e => this.onClickCreatePost(e, {intent: 'image'})}
          ></app-button>
        </div>
      </div>
    `
  }

  renderRightSidebar () {
    return html`
      <nav class="pt-6">
        <app-suggestions-sidebar></app-suggestions-sidebar>
      </nav>
    `
  }

  /* DEBUG - you can use this to test custom HTML as needed */
  renderHTMLDebug () {
    const testHtml = `
      <h1>Heading 1</h1>
      <p>Content</p>
      <h2>Heading 2</h2>
      <p>Content</p>
      <h3>Heading 3</h3>
      <p>Content</p>
      <h4>Heading 4</h4>
      <p>Content</p>
      <h5>Heading 5</h5>
      <p>Content</p>
      <h6>Heading 6</h6>
      <p>Content</p>
      <h1>Table</h1>
      <table>
        <tr><td>One</td><td>Two</td><td>Three</td></tr>
        <tr><td>One</td><td>Two</td><td>Three</td></tr>
        <tr><td>One</td><td>Two</td><td>Three</td></tr>
      </table>
      <ul>
        <li>One<ul>
          <li>Two</li>
        </ul>
        <li>Three</li>
        <li>Four</li>
      </ul>
      <ol>
        <li>One<ol>
          <li>Two</li>
        </ol>
        <li>Three</li>
        <li>Four</li>
      </ol>
      <blockquote>
        <p>This is a fancy quote</p>
      </blockquote>
      <pre>this is some
pre text</pre>
      <p>This is <code>code</code> and a <kbd>shift+s</kbd></p>
      <p>And <strong>bold</strong> <i>italic</i> <u>underline</u> and <del>strike</del></p>
      <a href="https://example.com">Link outside containing element</a>
      <p>A <a href="https://example.com">Link</a></p>
      <dl>
        <dt>One</dt><dd>Definition</dd>
        <dt>One</dt><dd>Definition</dd>
        <dt>One</dt><dd>Definition</dd>
      </dl>
      <h1>Code</h1>
      <ctzn-code>This is some
custom code</ctzn-code>
      <h1>Post</h1>
      <ctzn-post-view src="http://localhost:4000/pfrazee@dev1.localhost/ctzn.network/post/ff080bc59b95a9d0"></ctzn-post-view>
      <h1>Post expanded</h1>
      <ctzn-post-view mode="expanded" src="http://localhost:4000/pfrazee@dev1.localhost/ctzn.network/post/ff080bc59b95a9d0"></ctzn-post-view>
      <h1>Post content-only</h1>
      <ctzn-post-view mode="content-only" src="http://localhost:4000/pfrazee@dev1.localhost/ctzn.network/post/ff080bc59b95a9d0"></ctzn-post-view>
      <h1>Comment</h1>
      <ctzn-comment-view src="http://localhost:4000/pfrazee@dev1.localhost/ctzn.network/comment/ff080bc63c67dac0"></ctzn-comment-view>
      <h1>Comment content-only</h1>
      <ctzn-comment-view mode="content-only" src="http://localhost:4000/pfrazee@dev1.localhost/ctzn.network/comment/ff080bc63c67dac0"></ctzn-comment-view>
      <h1>Iframe</h1>
      <ctzn-iframe src="https://example.com"></ctzn-iframe>
      <h1>Card</h1>
      <ctzn-card>
        <h1>This is inside a card</h1>
        <p>Looks good.</p>
        <ctzn-post-view src="http://localhost:4000/pfrazee@dev1.localhost/ctzn.network/post/ff080bc59b95a9d0"></ctzn-post-view>
        <ctzn-iframe src="https://example.com"></ctzn-iframe>
        <ctzn-code>This is some
  custom code</ctzn-code>
      </ctzn-card>
      <h1>Posts feed</h1>
      <ctzn-posts-feed limit="3"></ctzn-posts-feed>
      <h1>ctzn-followers-list</h1>
      <ctzn-followers-list></ctzn-followers-list>
      <h1>ctzn-following-list</h1>
      <ctzn-following-list></ctzn-following-list>
      <h1>ctzn-community-memberships-list</h1>
      <ctzn-community-memberships-list></ctzn-community-memberships-list>
      <h1>ctzn-community-members-list</h1>
      <ctzn-community-members-list user-id="invite-only@dev1.localhost"></ctzn-community-members-list>
      <h1>ctzn-dbmethods-feed</h1>
      <ctzn-dbmethods-feed limit="3"></ctzn-dbmethods-feed>
      <h1>ctzn-owned-items-list</h1>
      <ctzn-owned-items-list></ctzn-owned-items-list>
      <h1>ctzn-item-classes-list</h1>
      <ctzn-item-classes-list user-id="invite-only@dev1.localhost"></ctzn-item-classes-list>
      <h1>ctzn-comments-feed</h1>
      <ctzn-comments-feed limit="3"></ctzn-comments-feed>
    `

    const post = {
      key: '',
      author: {userId: session.info.userId, displayName: session.info.displayName},
      value: {
        text: 'Debug',
        extendedText: testHtml,
        extendedTextMimeType: 'text/html',
        createdAt: (new Date()).toISOString()
      }
    }
    return html`
      <h1 class="font-bold mb-1">Profile Context</h1>
      <app-custom-html
        context="profile"
        .contextState=${{page: {userId: session.info.userId}}}
        .html=${testHtml}
      ></app-custom-html>
      <h1 class="font-bold mb-1">Post Context</h1>
      <div class="bg-white">
        <ctzn-post-view
          .post=${post}
          mode="expanded"
          .renderOpts=${{noclick: true, preview: true}}
        ></ctzn-post-view>
      </div>
    `
  }

  // events
  // =

  onKeyupSearch (e) {
    if (e.code === 'Enter') {
      window.location = `/search?q=${e.currentTarget.value.toLowerCase()}`
    }
  }

  onClickClearSearch (e) {
    window.location = '/'
  }

  onPublishReply (e) {
    toast.create('Reply published', '', 10e3)
    this.load()
  }

  async onClickCreatePost (e, opts = {}) {
    e.preventDefault()
    e.stopPropagation()
    try {
      await ComposerPopup.create({
        community: this.community,
        ...opts
      })
      toast.create('Post published', '', 10e3)
      this.load()
    } catch (e) {
      // ignore
      console.log(e)
    }
  }

  onUnreadNotificationsChanged (e) {
    this.numUnreadNotifications = e.detail.count
  }
}

customElements.define('app-main-view', CtznMainView)