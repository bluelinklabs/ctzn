import { LitElement, html } from '../../../vendor/lit/lit.min.js'
import { repeat } from '../../../vendor/lit/directives/repeat.js'
import { unsafeHTML } from '../../../vendor/lit/directives/unsafe-html.js'
import { GeneralPopup } from '../popups/general.js'
import * as session from '../../lib/session.js'
import { makeSafe } from '../../lib/strings.js'
import { emojify } from '../../lib/emojify.js'
import * as contextMenu from '../context-menu.js'
import '../button.js'

const SUGGESTED_REACTIONS_1 = [
  'like',
  'haha',
  'cool!'
]
const SUGGESTED_REACTIONS_2 = [
  '❤️',
  '👍',
  '😂',
  '🤔',
  '🔥',
  // '😢'
]


export function create ({parent, x, y, reactions, onToggleReaction}) {
  x -= 125
  if (x < 10) x = 10

  return contextMenu.create({
    parent,
    x,
    y,
    center: true,
    render () {
      return html`
        <app-reaction-menu
          .reactions=${reactions}
          .onToggleReaction=${e => { this.destroy(); onToggleReaction(e); }}
        ></app-reaction-menu>
      `
    }
  })
}

export class ReactionMenu extends LitElement {
  static get properties () {
    return {
      reactions: {type: Object},
      onToggleReaction: {type: Function}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.reactions = undefined
    this.onToggleReaction = undefined
  }

  haveIReacted (reaction) {
    if (!session.isActive()) return
    return this.reactions?.[reaction]?.includes(session.info.userId)
  }

  // rendering
  // =

  render () {
    return html`
      <style>
        .container {
          background: #fff;
          width: 250px;
          box-shadow: rgb(0 0 0 / 30%) 0px 2px 15px;
          padding: 0.4rem 0.4rem;
          border-radius: 0.5rem;
        }
        .reactions {
          display: flex;
          width: 250px;
          line-height: 1;
        }
        .reaction {
          flex: 1;
          font-size: 14px;
          margin-right: 0.5rem;
          cursor: pointer;
          padding: 0.3rem 0.2rem;
          text-align: center;
          border-radius: 0.25rem;
          color: #555;
        }
        .reaction:hover {
          background: #f5f5f5;
        }
        .reaction.selected {
          background: rgb(239, 246, 255); /* bg-blue-50 */
          color: rgb(37, 99, 235); /* text-blue-600 */
        }
        .reaction.selected:hover {
          background: rgb(219, 234, 254); /* bg-blue-100 */
        }
        .reaction:last-child {
          margin-right: 0;
        }
        hr {
          border: 0;
          border-top: 1px solid #eee;
          margin: 0.4rem 0;
        }
        @media (max-width: 640px) {
          .reaction {
            padding: 0.5rem 0.2rem;
          }
        }
      </style>
      <div class="container">
        <div class="reactions">
          ${repeat(SUGGESTED_REACTIONS_2, reaction => {
            return html`
              <a
                class="reaction ${this.haveIReacted(reaction) ? 'selected' : ''}"
                @click=${e => this.onClickReaction(e, reaction)}
              >${unsafeHTML(emojify(makeSafe(reaction)))}</a>
            `
          })}
        </div>
        <hr>
        <div class="reactions">
          ${repeat(SUGGESTED_REACTIONS_1, reaction => {
            return html`
              <a
                class="reaction ${this.haveIReacted(reaction) ? 'selected' : ''}"
                @click=${e => this.onClickReaction(e, reaction)}
              >${unsafeHTML(emojify(makeSafe(reaction)))}</a>
            `
          })}
          <a class="reaction" @click=${this.onClickCustom}>more...</a>
        </div>
      </div>
    `
  }

  // events
  // =

  onClickReaction (e, reaction) {
    this.onToggleReaction(new CustomEvent('toggle-reaction', {detail: {reaction}}))
  }

  async onClickCustom (e) {
    e.preventDefault()
    e.stopPropagation()
    contextMenu.destroy()
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
          <div class="font-semibold p-1">Enter your custom reaction:</div>
          <input
            class="block border border-gray-300 box-border mb-2 px-3 py-2 rounded w-full"
            placeholder="E.g. nice! wow! no way!"
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
    if (res?.value) {
      let reaction = res?.value
      reaction = reaction.trim().toLowerCase()
      if (reaction) {
        this.onToggleReaction(new CustomEvent('toggle-reaction', {detail: {reaction}}))
      }
    }
  }
}

customElements.define('app-reaction-menu', ReactionMenu)
