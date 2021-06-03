import { LitElement, html } from '../../vendor/lit/lit.min.js'
import { repeat } from '../../vendor/lit/directives/repeat.js'
import * as session from '../lib/session.js'
import './button.js'
import './img-fallbacks.js'

export class SuggestionsSidebar extends LitElement {
  static get properties () {
    return {
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
    this.load()
  }

  async load () {
    this.popularCommunities = (await session.api.view.get('ctzn.network/views/popular-communities')).communities
  }

  get suggestedCommunities () {
    if (!this.popularCommunities) return []
    let list = this.popularCommunities.slice()
    if (session.myCommunities) list = list.filter(v => !session.myCommunities.includes(v.name))
    return list.slice(0, 20).sort(() => Math.random() - 0.5)
  }

  isMember (communityName) {
    return session.myCommunities?.includes(communityName)
  }

  // rendering
  // =

  render () {
    const suggestedCommunities = this.suggestedCommunities
    return html`
      ${suggestedCommunities.length ? html`
        <section class="my-5">
          <h2 class="font-bold mb-2 text-lg">Popular Communities</h2>
          <div class="communities-list">
            ${repeat(this.suggestedCommunities || [], c => c, c => this.renderCommunityBtn(c.name))}
          </div>
        </section>
      ` : ''}
      <section class="sticky top-16 my-5 w-52">
        <div class="text-sm mb-6">
          <div class="text-base font-medium">
            <span class="fas fa-heart fa-fw mr-1"></span> Support CTZN!
          </div>
          <div class="py-1.5">
            CTZN is donation-driven software. Help us develop this network by joining our patreon.
          </div>
          <div>
            <a
              class="link hov:hover:underline cursor-pointer"
              href="https://patreon.com/paul_maf_and_andrew"
              target="_blank"
            >Join our Patreon</a>            
          </div>
        </div>
        <div class="text-sm">
          <div class="text-base font-medium">
            <span class="fas fa-video fa-fw mr-1"></span> Watch the dev stream
          </div>
          <div class="py-1.5">
            Follow CTZN's development by joining the daily livestream by the core team every weekday.
          </div>
          <div class="pb-1">
            <a
              class="link py-1 hov:hover:underline cursor-pointer"
              href="https://www.youtube.com/channel/UCSkcL4my2wgDRFvjQOJzrlg"
              target="_blank"
            >Subscribe on YouTube</a>
          </div>
          <div>
            <a
              class="link py-1 hov:hover:underline cursor-pointer"
              href="https://ctzn.network/dev-vlog"
              target="_blank"
            >Watch the archives</a>
          </div>
        </div>
      </section>
    `
  }

  renderCommunityBtn (name) {
    return html`
      <a class="community" href="/p/explore/community/${encodeURIComponent(name)}">
        ${name}
        <span class="link fas fa-${this.isMember(name) ? 'minus' : 'plus'}" @click=${e => this.onToggleCommunity(e, name)}></span>
      </a>
    `
  }

  // events
  // =

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

customElements.define('app-suggestions-sidebar', SuggestionsSidebar)
