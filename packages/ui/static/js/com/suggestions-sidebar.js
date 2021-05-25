import { LitElement, html } from '../../vendor/lit/lit.min.js'
import './button.js'
import './img-fallbacks.js'

export class SuggestionsSidebar extends LitElement {
  static get properties () {
    return {
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.load()
  }

  async load () {
  }

  // rendering
  // =

  render () {
    return html`
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

}

customElements.define('app-suggestions-sidebar', SuggestionsSidebar)
