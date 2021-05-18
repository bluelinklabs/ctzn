import { LitElement, html } from '../../vendor/lit/lit.min.js'
import { repeat } from '../../vendor/lit/directives/repeat.js'
import * as session from '../lib/session.js'
import { getFollowedUsersCommunities } from '../lib/algorithms.js'
import { pluralize } from '../lib/strings.js'
import * as toast from './toast.js'
import './button.js'
import './img-fallbacks.js'

const SUGGESTED_COMMUNITIES = [
  {
    userId: 'alphatesters@ctzn.one',
    displayName: 'CTZN Alpha Testers',
    description: 'Find other CTZN alpha users and talk about what\'s going on with the network.'
  },
  {
    userId: 'welcome@ctzn.one',
    displayName: 'Welcome to CTZN',
    description: 'A place for new users to ask questions!'
  },
  {
    userId: 'ktzns@ctzn.one',
    displayName: 'KTZNs',
    description: 'A community for cat lovers.'
  },
  {
    userId: 'quotes@ctzn.one',
    displayName: 'Quotes',
    description: 'Share the wisdom, or lack thereof.'
  },
  {
    userId: 'gameboard@ctzn.one',
    displayName: 'Boardgames',
    description: 'A place to share what you\'ve been playing.'
  },
  {
    userId: 'P2P@ctzn.one',
    displayName: 'P2P',
    description: 'A place to chat about P2P, Federated, and Decentralised Systems!'
  },
  {
    userId: 'mlai@ctzn.one',
    displayName: 'Machine Learning & artificial intelligence',
    description: 'A space for ML & AI discussions.'
  },
  {
    userId: 'rustaceans@ctzn.one',
    displayName: 'Rustaceans',
    description: 'Rustaceans are people who use Rust, contribute to Rust, or are interested in the development of Rust.'
  },
  {
    userId: 'python@ctzn.one',
    displayName: 'Python',
    description: 'Python programming language'
  },
  {
    userId: 'GeminiEnthusiasts@ctzn.one',
    displayName: 'Gemini Protocol Enthusiasts',
    description: 'Community for people who love the Gemeni protocol.'
  },
  {
    userId: 'sports@ctzn.one',
    displayName: 'Sports',
    description: 'A place all around sports.'
  },
  {
    userId: 'Hamradio@ctzn.one',
    displayName: 'Hamradio',
    description: 'Hamradio Community'
  }
]

export class SuggestionsSidebar extends LitElement {
  static get properties () {
    return {
      suggestedCommunities: {type: Array}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.suggestedCommunities = undefined
    this.load()
  }

  async load () {
    if (!this.suggestedCommunities) {
      if (session.isActive() && session.myCommunities) {
        let suggestedCommunities = SUGGESTED_COMMUNITIES.filter(c => !session.isInCommunity(c.userId))

        let moreSuggestions = await getFollowedUsersCommunities({cachedOnly: true})
        if (!moreSuggestions) {
          // wait a few seconds for the page to finish loading, as this query can slow down the UI
          await new Promise(r => setTimeout(r, 10e3))
          moreSuggestions = await getFollowedUsersCommunities({cachedOnly: false})
        }

        if (moreSuggestions?.length) {
          suggestedCommunities = suggestedCommunities.concat(moreSuggestions)
          suggestedCommunities = suggestedCommunities.filter((entry, index) => {
            return suggestedCommunities.findIndex(entry2 => entry2.userId === entry.userId) === index
          })
        }

        suggestedCommunities = suggestedCommunities.sort(() => Math.random() - 0.5).slice(0, 3)
        for (let suggestedCommunity of suggestedCommunities) {
          if (!suggestedCommunity.displayName) {
            session.ctzn.getProfile(suggestedCommunity.userId).then(profile => {
              suggestedCommunity.displayName = profile.value.displayName
              suggestedCommunity.description = profile.value.description
              this.requestUpdate()
            })
          }
        }
        this.suggestedCommunities = suggestedCommunities
      } else {
        session.onSecondaryState(this.load.bind(this))
      }
    }
  }

  // rendering
  // =

  render () {
    return html`
      ${this.suggestedCommunities?.length ? html`
        <section class="px-3 py-2">
          <h4 class="font-bold mb-2 text-lg">Suggested communities</h4>
          ${repeat(this.suggestedCommunities, community => community.userId, community => {
            const hasJoined = session.isInCommunity(community.userId)
            let tooltipIds = community.members?.slice(0, 4).join(', ')
            if (community.members?.length > 4) tooltipIds += `, + ${community.members?.length - 4} more`
            return html`
              <div class="text-sm py-3">
                <div class="text-base font-medium truncate leading-snug">
                  <a class="hov:hover:pointer hov:hover:underline" href="/${community.userId}" title=${community.displayName}>
                    ${community.displayName || community.userId}
                  </a>
                </div>
                ${community.members?.length ? html`
                  <div class="text-gray-500 font-semibold">
                    <span class="hov:hover:underline" data-tooltip=${tooltipIds}>
                      ${community.members.length} ${pluralize(community.members.length, 'member')} you follow
                    </span>
                  </div>
                ` : ''}
                <div class="mt-1.5">${community.description}</div>
                <div class="mt-1.5">
                  ${hasJoined ? html`
                    <button
                      class="text-blue-600 cursor-default"
                      disabled
                    >Joined!</button>
                  ` : html`
                    <button
                      class="text-blue-600 hov:hover:underline cursor-pointer"
                      @click=${e => this.onClickJoinSuggestedCommunity(e, community)}
                      ?disabled=${hasJoined}
                    >${community.isJoining ? html`<span class="spinner"></span>` : `Join community`}</button>
                  `}
                </div>
              </div>
            `
          })}
        </section>
      ` : ''}
      <hr class="mx-4">
      <section class="sticky top-16 px-3 py-5">
        <h4 class="font-bold mb-2 text-lg">C T Z N</h4>
        <div class="text-sm bg-white rounded mb-6">
          <div class="text-base font-medium">
            <span class="fas fa-heart fa-fw mr-1"></span> Support CTZN!
          </div>
          <div class="py-1.5">
            CTZN is donation-driven software. Help us develop this network by joining our patreon.
          </div>
          <div>
            <a
              class="text-blue-600 hov:hover:underline cursor-pointer"
              href="https://patreon.com/paul_maf_and_andrew"
              target="_blank"
            >Join our Patreon</a>            
          </div>
        </div>
        <div class="text-sm bg-white rounded">
          <div class="text-base font-medium">
            <span class="fas fa-video fa-fw mr-1"></span> Watch the dev stream
          </div>
          <div class="py-1.5">
            Follow CTZN's development by joining the daily livestream by the core team every weekday.
          </div>
          <div class="pb-1">
            <a
              class="text-blue-600 py-1 hov:hover:underline cursor-pointer"
              href="https://www.youtube.com/channel/UCSkcL4my2wgDRFvjQOJzrlg"
              target="_blank"
            >Subscribe on YouTube</a>
          </div>
          <div>
            <a
              class="text-blue-600 py-1 hov:hover:underline cursor-pointer"
              href="https://ctzn.network/dev-vlog"
              target="_blank"
            >Watch the archives</a>
          </div>
        </div>
      </section>
    `
  }

  // events
  // =

  async onClickJoinSuggestedCommunity (e, community) {
    community.isJoining = true
    this.requestUpdate()
    try {
      await session.api.communities.join(community.userId)
      await session.loadSecondaryState()
      toast.create('Community joined')
    } catch (e) {
      console.log(e)
      toast.create(e.toString(), 'error')
    }
    community.isJoining = false
    this.requestUpdate()
    this.load()
  }
}

customElements.define('app-suggestions-sidebar', SuggestionsSidebar)
