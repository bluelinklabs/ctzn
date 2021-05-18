import { LitElement, html } from '../../vendor/lit/lit.min.js'
import { repeat } from '../../vendor/lit/directives/repeat.js'
import { emit } from '../lib/dom.js'
import * as gestures from '../lib/gestures.js'
import './button.js'

export class Subnav extends LitElement {
  static get properties () {
    return {
      currentPath: {type: String, attribute: 'current-path'},
      items: {type: Array},
      mobileOnly: {type: Boolean, attribute: 'mobile-only'},
      navClass: {type: String, attribute: 'nav-cls'},
      borderLeft: {type: Number},
      borderWidth: {type: Number}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.items = []
    this.navClass = ''
    this.mobileOnly = false
    this.currentPath = undefined
    this.borderLeft = undefined
    this.borderWidth = 0
    this.mediaQueryObserver = undefined
    this.onViewportWidthChange = () => this.recalculateUnderline()
    this.onSwiping = (e) => {
      const dxN = e.detail.pct
      this.borderEl.style.left = `${this.borderLeft + -dxN * this.borderWidth * 0.5}px`
    }
  }
  
  getNavCls ({path, mobileOnly, rightAlign, thick, thin}) {
    return `
      text-center pt-2 pb-2.5 sm:pt-3 sm:pb-3 ${thick ? 'px-5 sm:px-8' : thin ? 'px-3 sm:px-4' : 'px-4 sm:px-7'} whitespace-nowrap font-semibold cursor-pointer
      hov:hover:text-blue-600
      ${mobileOnly ? 'no-header-only' : 'block'}
      ${rightAlign ? 'ml-auto' : ''}
      ${path === this.currentPath ? 'text-blue-600' : ''}
    `.replace('\n', '')
  }

  recalculateUnderline () {
    const el = this.querySelector(`a[href="${this.currentPath}"]`)
    if (!el) return
    const rect = el.getClientRects()[0]
    if (!rect?.width) return
    this.borderLeft = el.offsetLeft
    this.borderWidth = rect?.width

    if (this.scrollWidth > this.offsetWidth && el.getBoundingClientRect().left > this.offsetWidth) {
      // we're scrolling horizontally, bring the element into view
      this.scrollLeft = el.offsetLeft
    }
  }

  updated (changedProperties) {
    if (changedProperties.has('currentPath') || changedProperties.has('items')) {
      this.recalculateUnderline()
    }
  }

  connectedCallback () {
    super.connectedCallback()
    this.mediaQueryObserver = window.matchMedia("(max-width: 1150px)")
    this.mediaQueryObserver.addListener(this.onViewportWidthChange)
    gestures.events.addEventListener('swiping', this.onSwiping)
    this.className = `
      white-glass sticky top-0 z-10 flex overflow-x-auto bg-white
      border-gray-300 border-b sm:border-l sm:border-r
      ${this.navClass}
      ${this.mobileOnly ? 'lg:hidden' : ''}
    `
  }

  disconnectedCallback () {
    super.disconnectedCallback()
    gestures.events.removeEventListener('swiping', this.onSwiping)
    this.mediaQueryObserver?.removeListener(this.onViewportWidthChange)
  }

  setOpaque (b) {
    if (b) this.classList.add('white-glass-opaque')
    else this.classList.remove('white-glass-opaque')
  }

  get borderEl () {
    return this.querySelector('.absolute')
  }

  // rendering
  // =

  render () {
    return html`
      ${typeof this.borderLeft === 'number' ? html`
        <div
          class="absolute bg-blue-600"
          style="
            left: ${this.borderLeft}px;
            bottom: 0;
            width: ${this.borderWidth}px;
            height: 2px;
            transition: left 0.1s;
          "
        ></div>
      ` : ''}
      ${repeat(this.items, item => item.path, item => html`
        <a
          class="${this.getNavCls(item)}"
          href=${item.path}
          @click=${e => this.onClickItem(e, item)}
          style="-webkit-transform: translate3d(0,0,0);"
        >${item.label}</a>
      `)}
    `
    // the webkit-transform style above fixes a rendering issue in safari
  }

  // events
  // =

  onClickItem (e, item) {
    e.preventDefault()
    if (item.click) {
      item.click(e)
    } else if (item.menu) {
      emit(this, 'open-main-menu')
    } else if (item.back) {
      if (window.history.length > 1) {
        window.history.back()
      } else {
        document.body.dispatchEvent(new CustomEvent('navigate-to', {detail: {url: '/', replace: true}}))
      }
    } else {
      emit(this, 'navigate-to', {detail: {url: item.path, replace: true}})
    }
  }
}

customElements.define('app-subnav', Subnav)
