import { LitElement, html } from '../../vendor/lit/lit.min.js'
import { repeat } from '../../vendor/lit/directives/repeat.js'
import { asyncReplace } from '../../vendor/lit/directives/async-replace.js'
import * as session from '../lib/session.js'
import { HTTP_ENDPOINT } from '../lib/const.js'
import '../com/header.js'
import '../com/button.js'

const CANVAS_SIZE = 200
const SERVERS = ['ctzn.one']
const SERVER_DESCRIPTIONS = {
  'ctzn.one': 'The first CTZN server. Welcome, trailblazers!'
}

class CtznSignup extends LitElement {
  static get properties () {
    return {
      currentStage: {type: Number},
      values: {type: Object},
      isServersExpanded: {type: Boolean},
      isCustomServer: {type: Boolean},
      isAvatarSet: {type: Boolean},
      isProcessing: {type: Boolean},
      currentError: {type: String}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.isProcessing = false
    this.currentError = undefined
    this.currentStage = 1
    this.values = {
      domain: SERVERS[0]
    }
    this.isServersExpanded = false
    this.isCustomServer = false
    this.isAvatarSet = false
  }

  async load () {
    document.title = `Sign up | CTZN`
    document.body.classList.add('no-pad')
  }

  loadImg (url) {
    let zoom = 1
    const img = document.createElement('img')
    img.src = url
    img.onload = async () => {
      var smallest = (img.width < img.height) ? img.width : img.height
      zoom = CANVAS_SIZE / smallest

      await this.requestUpdate()
      var canvas = document.getElementById('avatar-canvas')
      if (canvas) {
        var ctx = canvas.getContext('2d')
        ctx.globalCompositeOperation = 'source-over'
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
        ctx.save()
        ctx.scale(zoom, zoom)
        ctx.drawImage(img, 0, 0, img.width, img.height)
        ctx.restore()
      }
    }
  }

  // rendering
  // =

  render () {
    return html`
      <div class="bg-gray-700 border-gray-200 py-2 text-center text-gray-100 w-full">
        <span class="font-bold text-gray-50">Alpha Release</span>.
        This is a preview build of CTZN.
      </div>
      <div class="mx-auto my-6 sm:my-12 max-w-lg px-8 sm:py-8 bg-white sm:rounded-2xl sm:border border-gray-300">
        ${this.currentStage === 1 ? this.renderAlphaForm() : ''}
        ${this.currentStage === 2 ? this.renderServerForm() : ''}
        ${this.currentStage === 3 ? this.renderLegalDocsForm() : ''}
        ${this.currentStage === 4 ? this.renderAccountForm() : ''}
        ${this.currentStage === 5 ? this.renderProfileForm() : ''}
      </div>
    `
  }

  renderAlphaForm () {
    return html`
      <form @submit=${this.onNext}>
        <h2 class="mb-2 text-2xl font-semibold">Alpha Preview</h2>
        <div class="mb-4 text-gray-700">
          CTZN is still in development and many features are not yet complete.
          We've launched this alpha so you can help us shape this software!
        </div>
        <div class="mb-4 text-gray-700">
          Basic features like posting, following, and communities have been implemented,
          but they're just part our goal to create user-programmable social communities.
        </div>
        <div class="bg-gray-100 mb-4 px-4 py-4 rounded text-gray-700 text-sm">
          CTZN's development is live-streamed every day, so
          <a class="text-blue-600 hov:hover:underline" href="https://www.youtube.com/channel/UCSkcL4my2wgDRFvjQOJzrlg">join us there</a>
          to share your thoughts and see what's going on!
        </div>
        <div class="flex justify-between items-center border-t border-gray-300 pt-6">
          <a href="/">Log in to an existing account</a>
          <app-button
            primary
            btn-type="submit"
            ?disabled=${this.isProcessing}
            ?spinner=${this.isProcessing}
            label="Got it, let's do this!"
          ></app-button>
        </div>
      </form>
    `
  }

  renderServerForm () {
    return html`
      <form @submit=${this.onNext}>
        <h2 class="mb-6 text-2xl">Sign up</h2>
        <div class="mb-6">
          <label class="block w-full box-border mb-1 font-medium">Select your server</label>
          <div class="pb-2 text-gray-500 text-sm">
            Your server will determine your UserID and where your data is stored.
            E.g. alice@${this.values.domain || 'server.com'}.
          </div>
          ${this.isServersExpanded ? html`
            <div class="border border-gray-400 rounded w-full overflow-hidden" @click=${e => this.isServersExpanded = !this.isServersExpanded}>
              ${repeat(SERVERS, server => html`
                <button class="w-full border-b border-gray-300 hov:hover:bg-gray-50" @click=${e => this.onSelectServer(server)}>
                  <span class="flex items-center justify-between pb-4 pt-4 px-4 w-full">
                    <span>${server}</span>
                  </span>
                </button>
              `)}
              <button class="w-full hov:hover:bg-gray-50" @click=${e => this.onSelectServer('custom')}>
                <span class="flex items-center justify-between pb-4 pt-4 px-4 w-full">
                  <span>Custom server</span>
                </span>
              </button>
            </div>
          ` : html`
            <button class="block border border-gray-300 rounded w-full overflow-hidden hov:hover:border-gray-400" @click=${e => this.isServersExpanded = !this.isServersExpanded}>
              <span class="flex items-center justify-between pb-4 pt-4 px-4 w-full">
                <span>${this.isCustomServer ? 'Custom server' : this.values.domain}</span> <span class="fas fa-fw fa-caret-down"></span>
              </span>
              ${!this.isCustomServer ? html`
                <span class="bg-gray-50 border-gray-200 border-t flex text-left items-center px-4 py-4 text-gray-600 text-sm tracking-tight">
                  <span><span class="fas fa-info-circle fa-fw text-gray-500"></span> ${SERVER_DESCRIPTIONS[this.values.domain]}</span>
                </span>
              ` : html`
                <span class="bg-gray-50 border-gray-200 border-t flex text-left items-center px-4 py-4 text-gray-600 text-sm tracking-tight">
                  <span><span class="fas fa-info-circle fa-fw text-gray-500"></span> Enter the URL of a custom server (advanced).</span>
                </span>
              `}
            </button>
            ${this.isCustomServer ? html`
              <input
                class="block w-full box-border my-1 p-4 border border-gray-300 rounded"
                name="domain"
                required
                placeholder="E.g. home.com"
                @keyup=${this.onKeyupCustomServer}
              >
            ` : ''}
          `}
        </div>
        ${this.currentError ? html`
          <div class="bg-red-100 p-6 text-red-600">${this.currentError}</div>
        ` : ''}
        <div class="flex justify-between items-center border-t border-gray-300 mt-10 pt-6">
          <a href="/">Log in to an existing account</a>
          <app-button
            primary
            btn-type="submit"
            ?disabled=${this.isProcessing}
            ?spinner=${this.isProcessing}
            label="Next"
          ></app-button>
        </div>
      </form>
    `
  }

  renderLegalDocsForm () {
    return html`
      <form @submit=${this.onNext}>
        <h2 class="mb-2 text-2xl">Sign up</h2>
        <div class="mb-4 text-gray-500 text-sm">
          Please review these terms from ${this.values.domain}.
        </div>
        <div class="mb-6">
          <div class="block w-full box-border mb-1">Terms of Service</div>
          <div class="block border border-gray-300 box-border max-h-40 mb-1 overflow-y-auto p-4 rounded text-gray-700 w-full whitespace-pre-wrap">${asyncReplace(loadTermsOfService(this.values.domain))}</div>
        </div>
        <div class="mb-6">
          <div class="block w-full box-border mb-1">Privacy Policy</div>
          <div class="block border border-gray-300 box-border max-h-40 mb-1 overflow-y-auto p-4 rounded text-gray-700 w-full whitespace-pre-wrap">${asyncReplace(loadPrivacyPolicy(this.values.domain))}</div>
        </div>
        <div class="mb-6">
          <label class="bg-gray-50 flex items-center mb-1 py-2 rounded w-full">
            <input type="checkbox" class="mx-3" required>
            <span>I have read and agreed to these terms.</span>
          </label>
        </div>
        <div class="flex justify-between items-center border-t border-gray-300 pt-6">
          <app-button
            ?disabled=${this.isProcessing}
            ?spinner=${this.isProcessing}
            label="Back"
            @click=${this.onBack}
          ></app-button>
          <app-button
            primary
            btn-type="submit"
            ?disabled=${this.isProcessing}
            ?spinner=${this.isProcessing}
            label="Next"
          ></app-button>
        </div>
      </form>
    `
  }

  renderAccountForm () {
    return html`
      <form @submit=${this.onNext}>
        <h2 class="mb-2 text-2xl">Sign up</h2>
        <div class="mb-4 text-gray-500 text-sm">
          Create your account on ${this.values.domain}
        </div>
        <div class="mb-6">
          <label class="block w-full box-border mb-1" for="username">Username</label>
          <input
            class="block w-full box-border mb-1 p-4 border border-gray-300 rounded"
            id="username"
            name="username"
            required
            placeholder="E.g. bob"
            @keyup=${e => this.onKeyupValue(e, 'username')}
          >
          ${this.values.username ? html`
            <div class="text-gray-500 text-sm px-2">
              Your UserID will be ${this.values.username}@${this.values.domain}
            </div>
          ` : ''}
        </div>
        <div class="mb-6">
          <label class="block w-full box-border mb-1" for="email">Your email</label>
          <input
            class="block w-full box-border mb-1 p-4 border border-gray-300 rounded"
            id="email"
            name="email"
            required
            placeholder="E.g. bob@mail.com"
            @keyup=${e => this.onKeyupValue(e, 'email')}
          >
        </div>
        <div class="mb-6">
          <label class="block w-full box-border mb-1" for="password">Password</label>
          <input
            class="block w-full box-border mb-1 p-4 border border-gray-300 rounded"
            id="password"
            type="password"
            name="password"
            required
            @keyup=${e => this.onKeyupValue(e, 'password')}
          >
        </div>
        ${this.currentError ? html`
          <div class="bg-red-100 p-6 text-red-600">${this.currentError}</div>
        ` : ''}
        <div class="flex justify-between items-center border-t border-gray-300 mt-10 pt-6">
          <app-button
            ?disabled=${this.isProcessing}
            ?spinner=${this.isProcessing}
            label="Back"
            @click=${this.onBack}
          ></app-button>
          <app-button
            primary
            btn-type="submit"
            ?disabled=${this.isProcessing}
            ?spinner=${this.isProcessing}
            label="Next"
          ></app-button>
        </div>
      </form>
    `
  }

  renderProfileForm () {
    return html`
      <form @submit=${this.onSubmit}>
        <h2 class="mb-2 text-2xl">Sign up</h2>
        <div class="mb-4 text-gray-500 text-sm">
          Set up your profile information.
        </div>
        ${this.isAvatarSet ? html`
          <canvas
            class="block mx-auto my-4 w-48 h48 rounded-full cursor-pointer hov:hover:opacity-50"
            id="avatar-canvas"
            width=${CANVAS_SIZE}
            height=${CANVAS_SIZE}
            @click=${this.onClickAvatar}
          ></canvas>
        ` : html`
          <img
            class="block mx-auto my-4 w-48 h48 rounded-full cursor-pointer hov:hover:opacity-50"
            src="/img/default-user-thumb.jpg"
            @click=${this.onClickAvatar}
          >
        `}
        <div class="text-center mb-4">
          <app-button tabindex="1" @click=${this.onClickAvatar} label="Change Avatar"></app-button>
          <input class="hidden" type="file" accept=".jpg,.jpeg,.png" @change=${this.onChooseAvatarFile}>
        </div>
        <div class="mb-6">
          <label class="block w-full box-border mb-1" for="displayName">Display Name</label>
          <input
            class="block w-full box-border mb-1 p-4 border border-gray-300 rounded"
            id="displayName"
            name="displayName"
            required
            placeholder="E.g. Bob Roberts"
            @keyup=${e => this.onKeyupValue(e, 'displayName')}
          >
        </div>
        <div class="mb-6">
          <label class="block w-full box-border mb-1" for="description">Bio line</label>
          <textarea
            class="block w-full box-border mb-1 p-4 border border-gray-300 rounded"
            id="description"
            name="description"
            placeholder="Optional"
            @keyup=${e => this.onKeyupValue(e, 'description')}
          ></textarea>
        </div>
        ${this.currentError ? html`
          <div class="bg-red-100 p-6 text-red-600">${this.currentError}</div>
        ` : ''}
        <div class="flex justify-between items-center border-t border-gray-300 mt-10 pt-6">
          <app-button
            ?disabled=${this.isProcessing}
            ?spinner=${this.isProcessing}
            label="Back"
            @click=${this.onBack}
          ></app-button>
          <app-button
            primary
            btn-type="submit"
            ?disabled=${this.isProcessing}
            ?spinner=${this.isProcessing}
            label="Sign up"
          ></app-button>
        </div>
      </form>
    `
  }

  // events
  // =

  captureValues () {
    const formEl = this.querySelector('form')
    for (let el of formEl.elements) {
      if (!el.name) continue
      this.values[el.name] = el.value
    }
  }

  async onBack (e) {
    e.preventDefault()
    this.currentStage--
  }

  async onNext (e) {
    e.preventDefault()
    this.currentError = undefined

    if (this.currentStage === 2) {
      // server
      this.isProcessing = true
      try {
        const domain = await checkCtznServer(this.values.domain)
        this.values.domain = domain
        this.isProcessing = false
      } catch (e) {
        this.currentError = 'Failed to connect to server'
        this.isProcessing = false
        return
      }
    } else if (this.currentStage === 4) {
      // account
      if (!this.values.username) {
        this.currentError = 'A username is required.'
        return
      } else if (this.values.username.length < 3) {
        this.currentError = 'Your username must be at least 3 characters long.'
        return
      } else if (/^([a-zA-Z][a-zA-Z0-9-]{1,62}[a-zA-Z0-9])$/.test(this.values.username) !== true) {
        if (/^[a-zA-Z]/.test(this.values.username) !== true) {
          this.currentError = 'Your username must start with a character.'
          return
        } else if (/[a-zA-Z0-9]$/.test(this.values.username) !== true) {
          this.currentError = 'Your username must end with a character or number.'
          return
        } else {
          this.currentError = 'Your username can only contain characters, numbers, and dashes.'
          return
        }
      }
    }

    this.captureValues()
    this.currentStage++
  }

  onSelectServer (server) {
    if (server === 'custom') {
      this.isCustomServer = true
    } else {
      this.isCustomServer = false
      this.values = Object.assign({}, this.values, {domain: server})
    }
  }

  onKeyupCustomServer (e) {
    this.values = Object.assign({}, this.values, {domain: e.currentTarget.value})
  }

  onKeyupValue (e, key) {
    this.values = Object.assign({}, this.values, {[key]: e.currentTarget.value})
  }

  async onClickAvatar (e) {
    e.preventDefault()
    this.querySelector('input[type="file"]').click()
  }

  onChooseAvatarFile (e) {
    var file = e.currentTarget.files[0]
    if (!file) return
    var fr = new FileReader()
    fr.onload = () => {
      this.isAvatarSet = true
      this.loadImg(fr.result)
    }
    fr.readAsDataURL(file)
  }

  async onSubmit (e) {
    e.preventDefault()
    this.isProcessing = true
    this.currentError = undefined
    this.captureValues()

    if (this.isAvatarSet) {
      this.values.avatar = document.getElementById('avatar-canvas').toDataURL()
    }

    try {
      await session.doSignup(this.values)
      window.location = '/'
    } catch (e) {
      console.log(e)
      this.currentError = e.data || e.message
    }
    this.isProcessing = false
  }

}

customElements.define('app-signup-view', CtznSignup)

async function checkCtznServer (domain) {
  try {
    let urlp = new URL(domain)
    domain = urlp.hostname
  } catch (e) {
    // ignore
  }
  const res = await (await fetch(`${HTTP_ENDPOINT(domain)}/ctzn/server-info`))
  if (!res.ok) throw new Error(res.statusText)
  return domain
}

async function* loadTermsOfService (domain) {
  yield html`Loading...`

  try {
    let urlp = new URL(domain)
    domain = urlp.hostname
  } catch (e) {
    // ignore
  }
  const res = await (await fetch(`${HTTP_ENDPOINT(domain)}/ctzn/server-terms-of-service`)).text()
  if (res) {
    yield res
  } else {
    yield 'This server has no terms of service.'
  }
}

async function* loadPrivacyPolicy (domain) {
  yield html`Loading...`

  try {
    let urlp = new URL(domain)
    domain = urlp.hostname
  } catch (e) {
    // ignore
  }
  const res = await (await fetch(`${HTTP_ENDPOINT(domain)}/ctzn/server-privacy-policy`)).text()
  if (res) {
    yield res
  } else {
    yield 'This server has no privacy policy.'
  }
}