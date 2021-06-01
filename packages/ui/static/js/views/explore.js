import { LitElement, html } from '../../vendor/lit/lit.min.js'
import { repeat } from '../../vendor/lit/directives/repeat.js'
import { GeneralPopup } from '../com/popups/general.js'
import * as session from '../lib/session.js'
import '../com/header.js'
import '../com/button.js'
import '../com/suggestions-sidebar.js'
import '../com/subnav.js'

class CtznExploreView extends LitElement {
  static get properties () {
    return {
      currentPath: {type: String, attribute: 'current-path'},
      currentCommunity: {type: String},
      popularCommunities: {type: Array}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.popularCommunities = undefined
    session.onSecondaryState(() => this.requestUpdate())
  }

  async load () {
    document.title = `Explore | CTZN`
    this.popularCommunities = (await session.api.view.get('ctzn.network/views/popular-communities')).communities
    console.log(this.popularCommunities)
  }

  updated (changedProperties) {
    if (changedProperties.has('currentPath') && this.currentPath !== changedProperties.get('currentPath')) {
      let [_1, _2, currentCommunity] = this.currentPath.split('/').filter(Boolean)
      this.currentCommunity = currentCommunity ? decodeURIComponent(currentCommunity) : undefined
    }
  }

  async refresh () {
    this.popularCommunities = (await session.api.view.get('ctzn.network/views/popular-communities')).communities
  }

  isMember (communityName) {
    return session.myCommunities?.includes(communityName)
  }

  // rendering
  // =

  render () {
    return html`
      <app-header
        current-path=${this.currentPath}
      ></app-header>
      <main class="col2">
        <div>
          ${this.currentCommunity ? html`
            <h2 class="content-header flex items-center text-2xl tracking-tight font-bold p-4">
              <a class="link fas fa-fw fa-angle-left" href="/explore"></a>
              ${this.currentCommunity}
              <app-button
                transparent
                class="ml-auto"
                btn-class="px-1 py-0 link text-xl"
                icon=${this.isMember(this.currentCommunity) ? '' : 'fas fa-plus'}
                label=${this.isMember(this.currentCommunity) ? 'Leave' : 'Join'}
                @click=${e => this.onToggleCommunity(e, this.currentCommunity)}
              ></app-button>
            </h2>
            <app-posts-feed
              class="block"
              view="ctzn.network/views/feed"
              audience=${this.currentCommunity}
            ></app-posts-feed>
          ` : html`
            <h2 class="content-header text-2xl tracking-tight font-bold p-4">My Communities</h2>
            <div class="communities-list">
              ${repeat(session.myCommunities || [], c => c, c => this.renderCommunityBtn(c))}
              <span class="link community" @click=${this.onClickNewCommunity}>New Community</span>
            </div>
            <h2 class="content-header text-2xl tracking-tight font-bold p-4">Popular Communities</h2>
            <div class="communities-list">
              ${repeat(this.popularCommunities || [], c => c.name, c => this.renderCommunityBtn(c.name))}
            </div>
          `}
        </div>
        ${this.renderRightSidebar()}
      </main>
    `
  }

  renderCommunityBtn (name) {
    return html`
      <a class="community" href="/explore/community/${encodeURIComponent(name)}">
        ${name}
        <span class="link fas fa-${this.isMember(name) ? 'minus' : 'plus'}" @click=${e => this.onToggleCommunity(e, name)}></span>
      </a>
    `
  }

  renderRightSidebar () {
    return html`
      <nav>
        <app-suggestions-sidebar></app-suggestions-sidebar>
      </nav>
    `
  }

  // events
  // =

  async onClickNewCommunity (e) {
    e.preventDefault()
    e.stopPropagation()

    const res = await GeneralPopup.create({
      maxWidth: '400px',
      render () {
        const onCancel = e => this.onReject()
        const onAdd = e => {    
          const value = this.querySelector('input').value
          this.dispatchEvent(new CustomEvent('resolve', {detail: {value}}))
        }
        const onKeydownInput = e => {
          if (e.code === 'Enter' || e.code === 'NumpadEnter') onAdd()
        }
        return html`
          <div class="font-semibold p-1">New community name:</div>
          <input
            class="block border border-gray-300 box-border mb-2 px-3 py-2 rounded w-full"
            @keydown=${onKeydownInput}
          >
          <div class="flex justify-between">
            <app-button btn-class="py-1" label="Cancel" @click=${onCancel}></app-button>
            <app-button btn-class="py-1" primary label="Add" @click=${onAdd}></app-button>
          </div>
        `
      },
      firstUpdated () {
        this.querySelector('input')?.focus()
      }
    }).catch(e => undefined)

    if (!session.myCommunities?.includes?.(res.value)) {
      session.myCommunities.push(res.value)
      await session.modifyProfile(v => Object.assign(v, {communities: session.myCommunities}))
      this.requestUpdate()
    }
  }

  async onToggleCommunity (e, name) {
    e.preventDefault()
    e.stopPropagation()
    if (!this.isMember(name)) {
      session.myCommunities.push(name)
    } else {
      session.myCommunities.splice(session.myCommunities.indexOf(name), 1)
    }
    await session.modifyProfile(v => Object.assign(v, {communities: session.myCommunities}))
    this.requestUpdate()
  }
}

customElements.define('app-explore-view', CtznExploreView)