import { LitElement, html } from '../../../vendor/lit/lit.min.js'
import * as session from '../../lib/session.js'

const ICONS = {
  currentStatus: 'far fa-clock',
  listeningTo: 'fas fa-headphones-alt',
  watching: 'fas fa-tv'
}

export class CurrentStatus extends LitElement {
  static get properties () {
    return {
      userId: {type: String, attribute: 'user-id'},
      currentStatus: {type: Object},
      isEditingMap: {type: Object}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.userId = undefined
    this.currentStatus = undefined
    this.isEditingMap = {}
  }

  get isMyStatus () {
    return session.isActive() && (session.info.username === this.userId || session.info.dbKey === this.userId)
  }

  updated (changedProperties) {
    if (changedProperties.has('userId') && this.userId !== changedProperties.get('userId')) {
      this.load()
    }
  }

  async load () {
    this.currentStatus = undefined
    this.currentStatus = (await session.api.db(this.userId).table('ctzn.network/current-status').get('self'))?.value
    console.log(this.currentStatus)
  }

  // rendering
  // =

  render () {
    return html`
      ${this.renderSection('currentStatus', 'Current status')}
      ${this.renderSection('listeningTo', 'Listening to')}
      ${this.renderSection('watching', 'Watching')}
    `
  }

  renderSection (id, label) {
    let isExpired = this.currentStatus?.[id]?.expiresAt && (new Date(this.currentStatus[id].expiresAt)) < new Date()
    if (!this.isMyStatus) {
      if (!this.currentStatus?.[id]) return ''
      if (isExpired) return ''
    }
    return html`
      <div class="section">
        <div class="label text-sm"><span class="text-xs fa-fw ${ICONS[id]}"></span> ${label}</div>
        ${this.isEditingMap[id] ? html`
          <form class="form-${id}">
            <textarea class="w-full block my-2 px-1" id="edit-${id}" name="text"></textarea>
            <div class="mb-2">
              <label class="whitespace-nowrap mr-1"><input type="radio" name="expiresAt" value="today" checked> Today</label>
              <label class="whitespace-nowrap mr-1"><input type="radio" name="expiresAt" value="this-week"> This Week</label>
              <label class="whitespace-nowrap mr-1"><input type="radio" name="expiresAt" value="indefinitely"> Indefinitely</label>
            </div>
            <div class="mb-1">
              <app-button btn-class="px-3 py-0.5" primary label="Save" @click=${e => this.onClickSave(e, id)}></app-button>
              <app-button btn-class="px-3 py-0.5" transparent label="Cancel" @click=${e => this.onClickCancel(e, id)}></app-button>
            </div>
          </form>
        ` : html`
          <div class="text text-lg">
            ${this.currentStatus?.[id]?.text && !isExpired ? this.currentStatus[id].text : ''}
            ${this.isMyStatus ? html`
              <a class="link ml-1 text-base whitespace-nowrap cursor-pointer hover:underline" @click=${e => this.onClickEdit(e, id)}>
                <span class="text-xs fas fa-fw fa-pen"></span> edit
              </a>
            ` : ''}
          </div>
        `}
      </div>
    `
  }

  // events
  // =

  async onClickEdit (e, id) {
    this.isEditingMap = Object.assign({}, this.isEditingMap, {[id]: true})
    await this.updateComplete
    this.querySelector(`#edit-${id}`).focus()
  }

  async onClickSave (e, id) {
    const form = this.querySelector(`.form-${id}`)
    const currentStatus = this.currentStatus || {}
    currentStatus[id] = {
      text: form.text.value,
      expiresAt: expiresAtToDateTime(form.expiresAt.value)
    }
    await session.api.user.table('ctzn.network/current-status').create(currentStatus)
    this.currentStatus = currentStatus
    this.isEditingMap = Object.assign({}, this.isEditingMap, {[id]: false})
  }

  onClickCancel (e, id) {
    this.isEditingMap = Object.assign({}, this.isEditingMap, {[id]: false})
  }
}

customElements.define('app-current-status', CurrentStatus)

function expiresAtToDateTime (v) {
  if (v === 'indefinitely') return undefined
  const d = new Date()
  if (v === 'today') {
    d.setDate(d.getDate() + 1)
    return d.toISOString()
  } else if (v === 'this-week') {
    d.setDate(d.getDate() + 7)
    return d.toISOString()
  }
}