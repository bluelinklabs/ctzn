import { LitElement, html } from '../vendor/lit-element/lit-element.js'
import { repeat } from '../vendor/lit-element/lit-html/directives/repeat.js'
import { ViewThreadPopup } from './com/popups/view-thread.js'
import * as toast from './com/toast.js'
import { create as createRpcApi } from './lib/rpc-api.js'
// import { getAvailableName } from './fs.js'
import { pluralize, getOrigin, createResourceSlug } from './lib/strings.js'
// import { typeToQuery } from './records.js'
import * as QP from './lib/qp.js'
import css from '../css/main.css.js'
import './com/post-composer.js'
import './com/record-feed.js'
import './com/sites-list.js'
import './com/img-fallbacks.js'

createRpcApi('ws://localhost:3000/').then(api => {
  window.api = api
})

// const PATH_QUERIES = {
//   search: {
//     discussion: [
//       typeToQuery('microblogpost'),
//       typeToQuery('comment')
//     ]
//   },
//   all: [typeToQuery('microblogpost'), typeToQuery('comment')],
//   notifications: [
//     typeToQuery('microblogpost'),
//     typeToQuery('comment'),
//     typeToQuery('subscription'),
//     typeToQuery('tag'),
//     typeToQuery('vote')
//   ]
// }
const TITLE = document.title

class CtznApp extends LitElement {
  static get properties () {
    return {
      session: {type: Object},
      profile: {type: Object},
      unreadNotificationCount: {type: Number},
      suggestedSites: {type: Array},
      latestTags: {type: Array},
      isComposingPost: {type: Boolean},
      searchQuery: {type: String},
      tagFilter: {type: Array},
      isEmpty: {type: Boolean},
      numNewItems: {type: Number}
    }
  }

  static get styles () {
    return css
  }

  constructor () {
    super()
    this.session = undefined
    this.profile = undefined
    this.unreadNotificationCount = 0
    this.suggestedSites = undefined
    this.latestTags = []
    this.isComposingPost = false
    this.searchQuery = ''
    this.tagFilter = undefined
    this.isEmpty = false
    this.numNewItems = 0
    this.loadTime = Date.now()
    this.notificationsClearTime = +localStorage.getItem('notificationsClearTime') || 1
    this.cachedNotificationsClearTime = this.notificationsClearTime

    this.configFromQP()
    this.load().then(() => {
      this.loadSuggestions()
    })

    setInterval(this.checkNewItems.bind(this), 5e3)
    setInterval(this.checkNotifications.bind(this), 5e3)

    window.addEventListener('popstate', (event) => {
      this.configFromQP()
    })
  }

  configFromQP () {
    this.searchQuery = QP.getParam('q', '')
    this.tagFilter = QP.getParam('tag') ? [QP.getParam('tag')] : undefined
    
    if (this.searchQuery) {
      this.updateComplete.then(() => {
        this.shadowRoot.querySelector('.search-ctrl input').value = this.searchQuery
      })
    }
  }

  async load ({clearCurrent} = {clearCurrent: false}) {
    if (!this.session) {
      this.session = await beaker.session.get({
        permissions: {
          publicFiles: [
            {path: '/subscriptions/*.goto', access: 'write'},
            {path: '/microblog/*.md', access: 'write'},
            {path: '/comments/*.md', access: 'write'},
            {path: '/tags/*.goto', access: 'write'},
            {path: '/votes/*.goto', access: 'write'}
          ]
        }
      })
    }
    if (!this.session) {
      return this.requestUpdate()
    }
    this.profile = this.session.user
    this.checkNotifications()
    if (this.shadowRoot.querySelector('ctzn-record-feed')) {
      this.loadTime = Date.now()
      this.numNewItems = 0
      this.shadowRoot.querySelector('ctzn-record-feed').load({clearCurrent})
    }
    if (location.pathname === '/notifications') {
      this.notificationsClearTime = Date.now()
      localStorage.setItem('notificationsClearTime', '' + this.notificationsClearTime)
      setTimeout(() => {this.unreadNotificationCount = 0}, 2e3)
    }
    if (this.latestTags.length === 0) {
      let {tagRecords} = await beaker.index.gql(`
        query {
          tagRecords: records (
            paths: ["/tags/*.goto"]
            links: {paths: ["/microblog/*.md", "/comments/*.md"]}
            sort: "crtime"
            reverse: true
            limit: 50
          ) {
            metadata
          }
        }
      `)
      this.latestTags = Array.from(new Set(tagRecords.map(r => r.metadata['tag/id'])))
    }
  }

  async checkNewItems () {
    if (!this.session) return
    if (location.pathname === '/notifications') {
      this.numNewItems = this.unreadNotificationCount
      return
    }
    if (location.pathname === '/search') return
    var query = PATH_QUERIES[location.pathname.slice(1) || 'all']
    if (!query) return
    var {count} = await beaker.index.gql(`
      query NewItems ($paths: [String!]!, $loadTime: Long!) {
        count: recordCount(
          paths: $paths
          after: {key: "crtime", value: $loadTime}
        )
      }
    `, {paths: query, loadTime: this.loadTime})
    this.numNewItems = count
  }

  async checkNotifications () {
    if (!this.session) return
    var {count} = await beaker.index.gql(`
      query Notifications ($profileUrl: String!, $clearTime: Long!) {
        count: recordCount(
          paths: ["/microblog/*.md", "/comments/*.md", "/subscriptions/*.goto", "/tags/*.goto", "/votes/*.goto"]
          links: {origin: $profileUrl}
          excludeOrigins: [$profileUrl]
          indexes: ["local", "network"],
          after: {key: "crtime", value: $clearTime}
        )
      }
    `, {profileUrl: this.profile.url, clearTime: this.notificationsClearTime})
    this.unreadNotificationCount = count
    if (this.unreadNotificationCount > 0) {
      document.title = `${TITLE} (${this.unreadNotificationCount})`
    } else {
      document.title = TITLE
    }
  }

  async loadSuggestions () {
    if (!this.session) return
    const getSite = async (url) => {
      let {site} = await beaker.index.gql(`
        query Site ($url: String!) {
          site(url: $url) {
            url
            title
            description
            subCount: backlinkCount(paths: ["/subscriptions/*.goto"] indexes: ["local", "network"])
          }
        }
      `, {url})
      return site
    }
    let {allSubscriptions, mySubscriptions} = await beaker.index.gql(`
      query Subs ($origin: String!) {
        allSubscriptions: records(paths: ["/subscriptions/*.goto"] limit: 100 sort: "crtime" reverse: true) {
          metadata
        }
        mySubscriptions: records(paths: ["/subscriptions/*.goto"] origins: [$origin]) {
          metadata
        }
      }
    `, {origin: this.profile.url})
    var currentSubs = new Set(mySubscriptions.map(sub => (getOrigin(sub.metadata.href))))
    currentSubs.add(getOrigin(this.profile.url))
    var candidates = allSubscriptions.filter(sub => !currentSubs.has((getOrigin(sub.metadata.href))))
    var suggestedSiteUrls = candidates.reduce((acc, candidate) => {
      var url = candidate.metadata.href
      if (!acc.includes(url)) acc.push(url)
      return acc
    }, [])
    suggestedSiteUrls.sort(() => Math.random() - 0.5)
    var suggestedSites = await Promise.all(suggestedSiteUrls.slice(0, 12).map(url => getSite(url).catch(e => undefined)))
    suggestedSites = suggestedSites.filter(site => site && site.title)
    if (suggestedSites.length < 12) {
      let {moreSites} = await beaker.index.gql(`
        query { moreSites: sites(indexes: ["network"] limit: 12) { url } }
      `)
      moreSites = moreSites.filter(site => !currentSubs.has(site.url))

      // HACK
      // the network index for listSites() currently doesn't pull from index.json
      // (which is stupid but it's the most efficient option atm)
      // so we need to call getSite()
      // -prf
      moreSites = await Promise.all(moreSites.map(s => getSite(s.url).catch(e => undefined)))
      suggestedSites = suggestedSites.concat(moreSites).filter(Boolean)
    }
    suggestedSites.sort(() => Math.random() - 0.5)
    this.suggestedSites = suggestedSites.slice(0, 12)
  }

  get isLoading () {
    let queryViewEls = Array.from(this.shadowRoot.querySelectorAll('ctzn-record-feed'))
    return !!queryViewEls.find(el => el.isLoading)
  }

  // rendering
  // =

  render () {
    return html`
      <link rel="stylesheet" href="/css/fontawesome.css">
      <div class="tags-bar">
        <span class="fas fa-tag"></span>
        ${repeat(this.latestTags, tag => tag, tag => html`
          <a class="tag" href="/?tag=${encodeURIComponent(tag)}">${tag}</a>
        `)}
      </div>
      <main>
        ${this.renderCurrentView()}
      </main>
    `
  }

  renderRightSidebar () {
    const navItem = (path, label) => html`
      <a class=${location.pathname === path ? 'current' : ''} href=${path}>${label}</a>
    `
    let n = this.unreadNotificationCount > 0 ? html` <sup>${this.unreadNotificationCount}</sup>` : ''
    return html`
      <div class="sidebar">
        <div class="sticky">
          <div class="search-ctrl">
            <span class="fas fa-search"></span>
            ${!!this.searchQuery ? html`
              <a class="clear-search" @click=${this.onClickClearSearch}><span class="fas fa-times"></span></a>
            ` : ''}
            <input @keyup=${this.onKeyupSearch} placeholder="Search" value=${this.searchQuery}>
          </div>
          <section class="nav">
            ${navItem('/', html`<span class="fas fa-fw fa-stream"></span> Timeline`)}
            ${navItem('/notifications', html`<span class="far fa-fw fa-bell"></span> Notifications${n}`)}
          </section>
          ${this.suggestedSites?.length > 0 ? html`
            <section class="suggested-sites">
              <h3>Suggested Sites</h3>
              ${repeat(this.suggestedSites.slice(0, 3), site => html`
                <div class="site">
                  <div class="title">
                    <a href=${site.url} title=${site.title} target="_blank">${site.title}</a>
                  </div>
                  <div class="subscribers">
                    ${site.subCount} ${pluralize(site.subCount, 'subscriber')}
                  </div>
                  ${site.subscribed ? html`
                    <button class="transparent" disabled><span class="fas fa-check"></span> Subscribed</button>
                  ` : html`
                    <button @click=${e => this.onClickSuggestedSubscribe(e, site)}>Subscribe</button>
                  `}
                </div>
              `)}
            </section>
          ` : ''}
        </div>
      </div>
    `
  }

  renderCurrentView () {
    if (!this.session) return this.renderIntro()
    if (!this.profile) return ''
    var hasSearchQuery = !!this.searchQuery
    if (hasSearchQuery) {
      return html`
        <div class="twocol">
          <div>
            ${this.renderSites('all')}
            <h3 class="feed-heading">Discussion</h3>
            <ctzn-record-feed
              .pathQuery=${PATH_QUERIES.search.discussion}
              .filter=${this.searchQuery}
              limit="50"
              empty-message="No results found${this.searchQuery ? ` for "${this.searchQuery}"` : ''}"
              @load-state-updated=${this.onFeedLoadStateUpdated}
              @view-thread=${this.onViewThread}
              @publish-reply=${this.onPublishReply}
              profile-url=${this.profile ? this.profile.url : ''}
            ></ctzn-record-feed>
          </div>
          ${this.renderRightSidebar()}
        </div>
      `
    } else {
      return html`
        <div class="twocol">
          <div>
            ${this.tagFilter ? html`
              <h2>#${this.tagFilter[0]} <a href="/"><span class="fas fa-times"></span></a></h2>
            ` : html`
              <div class="composer">
                <img class="thumb" src="${this.profile?.url}/thumb">
                ${this.isComposingPost ? html`
                  <ctzn-post-composer
                    drive-url=${this.profile?.url || ''}
                    @publish=${this.onPublishPost}
                    @cancel=${this.onCancelPost}
                  ></ctzn-post-composer>
                ` : html`
                  <div class="compose-post-prompt" @click=${this.onComposePost}>
                    What's new?
                  </div>
                `}
              </div>
            `}
            ${this.isEmpty ? this.renderEmptyMessage() : ''}
            <div class="reload-page ${this.numNewItems > 0 ? 'visible' : ''}" @click=${e => this.load()}>
              ${this.numNewItems} new ${pluralize(this.numNewItems, 'update')}
            </div>
            <ctzn-record-feed
              .pathQuery=${PATH_QUERIES[location.pathname.slice(1) || 'all']}
              .tagQuery=${this.tagFilter}
              .notifications=${location.pathname === '/notifications' ? {unreadSince: this.cachedNotificationsClearTime} : undefined}
              limit="50"
              @load-state-updated=${this.onFeedLoadStateUpdated}
              @view-thread=${this.onViewThread}
              @view-tag=${this.onViewTag}
              @publish-reply=${this.onPublishReply}
              profile-url=${this.profile ? this.profile.url : ''}
            ></ctzn-record-feed>
          </div>
          ${this.renderRightSidebar()}
        </div>
      `
    }
  }

  renderSites (id) {
    var listing = ({
      all: 'all',
      'my-sites': 'mine',
      subscriptions: 'subscribed',
      subscribers: 'subscribers'
    })[id]
    var title = ({
      all: 'Sites',
      'my-sites': 'My sites',
      subscriptions: 'My subscriptions',
      subscribers: 'Subscribed to me'
    })[id]
    var allSearch = !!this.searchQuery && id === 'all'
    return html`
      ${title ? html`<h3 class="feed-heading">${title}</h3>` : ''}
      <ctzn-sites-list
        listing=${listing}
        filter=${this.searchQuery || ''}
        .limit=${allSearch ? 6 : undefined}
        empty-message="No results found${this.searchQuery ? ` for "${this.searchQuery}"` : ''}"
        .profile=${this.profile}
      ></ctzn-sites-list>
    `
  }

  renderEmptyMessage () {
    if (this.searchQuery) {
      return html`
        <div class="empty">
            <div class="fas fa-search"></div>
          <div>No results found for "${this.searchQuery}"</div>
        </div>
      `
    }
    if (location.pathname.startsWith('/notifications')) {
      return html`
        <div class="empty">
          <div class="fas fa-bell"></div>
          <div>No notifications</div>
        </div>
      `
    }
    if (this.tagFilter) {
      return html`
        <div class="empty">
          <div class="fas fa-hashtag"></div>
          <div>No posts found in "#${this.tagFilter[0]}"</div>
        </div>
      `
    }
    return html`
      <div class="empty">
        <div class="fas fa-stream"></div>
        <div>Subscribe to sites to see what's new</div>
      </div>
    `
  }

  renderIntro () {
    return html`
      <div class="intro">
        <div class="explainer">
          <img src="/thumb">
          <h3>Welcome to Beaker Timeline!</h3>
          <p>Share posts on your feed and stay connected with friends.</p>
          <p>(You know. Like Twitter.)</p>
        </div>
        <div class="sign-in">
          <button class="primary" @click=${this.onClickSignin}>Sign In</button> to get started
        </div>
      </div>
    `
  }

  // events
  // =

  onFeedLoadStateUpdated (e) {
    if (typeof e.detail?.isEmpty !== 'undefined') {
      this.isEmpty = e.detail.isEmpty
    }
    this.requestUpdate()
  }

  onKeyupSearch (e) {
    if (e.code === 'Enter') {
      window.location = `/search?q=${e.currentTarget.value.toLowerCase()}`
    }
  }

  onClickClearSearch (e) {
    window.location = '/'
  }

  onViewThread (e) {
    ViewThreadPopup.create({
      recordUrl: e.detail.record.url,
      profileUrl: this.profile.url,
      onViewTag: this.onViewTag.bind(this)
    })
  }

  onViewTag (e) {
    window.location = `/?tag=${encodeURIComponent(e.detail.tag)}`
  }

  onComposePost (e) {
    this.isComposingPost = true
  }

  onCancelPost (e) {
    this.isComposingPost = false
  }

  onPublishPost (e) {
    this.isComposingPost = false
    toast.create('Post published', '', 10e3)
    this.load()
  }

  onPublishReply (e) {
    toast.create('Reply published', '', 10e3)
    this.load()
  }

  async onClickSuggestedSubscribe (e, site) {
    e.preventDefault()
    site.subscribed = true
    this.requestUpdate()

    var drive = beaker.hyperdrive.drive(this.profile.url)
    var slug = createResourceSlug(site.url, site.title)
    var filename = await getAvailableName('/subscriptions', slug, drive, 'goto') // avoid collisions
    await drive.writeFile(`/subscriptions/${filename}`, '', {metadata: {
      href: site.url,
      title: site.title
    }})
    // wait 1s then replace/remove the suggestion
    setTimeout(() => {
      this.suggestedSites = this.suggestedSites.filter(s => s !== site)
    }, 1e3)
  }

  async onClickSignin () {
    await beaker.session.request({
      permissions: {
        publicFiles: [
          {path: '/subscriptions/*.goto', access: 'write'},
          {path: '/microblog/*.md', access: 'write'},
          {path: '/comments/*.md', access: 'write'},
          {path: '/tags/*.goto', access: 'write'},
          {path: '/votes/*.goto', access: 'write'}
        ]
      }
    })
    location.reload()
  }
}

customElements.define('ctzn-app', CtznApp)
