import blessed from 'blessed'
import { Client as WebSocketClient } from 'rpc-websockets'
import { Config } from '../../lib/config.js'

export class BaseView {
  constructor (screen, globals) {
    this.screen = screen
    this.globals = globals
    this.config = new Config({configDir: this.globals.configDir})
    this.resetScreen()
    this.setup()
  }

  resetScreen () {
    let children = this.screen.children.slice()
    for (let node of children) {
      this.screen.remove(node)
    }
    this.screen.render()
    this._addCommon()
  }

  _addCommon () {
    let content = `CTZN ${this.globals.pkg.version} `
    const items = ['Home', 'Hyperspace', 'Issues', 'Communities', 'Accounts']
    for (let i = 0; i < items.length; i++) {
      let highlight = this.constructor.name === `${items[i]}View` ? '{inverse}' : ''
      content += `${highlight} {bold}F${i+1}{/}${highlight} ${items[i]} {/}`
    }

    var header = blessed.text({
      top: '0',
      left: '0',
      width: '100%',
      height: '1',
      content,
      tags: true,
      style: {
        fg: 'black',
        bg: 'green'
      }
    })
    this.screen.append(header)
  }

  setup () {
    // override me
  }

  teardown () {
    // override me
  }

  async connectLoopback () {
    const ws = new WebSocketClient(`ws://localhost:${this.config.port}`)
    await new Promise((resolve, reject) => {
      ws.once('open', resolve)
      ws.once('error', reject)
      ws.once('close', reject)
    })
    await ws.call('accounts.login', [{username: 'loopback', password: this.config.getLocalAuthToken()}])
    return ws
  }

  async ask (question) {
    let width = Math.max(question.length, 18) + 4
    const prompt = blessed.question({
      top: 'center',
      left: 'center',
      width: width,
      height: 4,
      border: {
        type: 'line',
        fg: 'green'
      },
      tags: true,
      style: {
        fg: 'green',
        bg: 'black'
      }
    })
    prompt._.okay.style.fg = 'green'
    prompt._.cancel.style.fg = 'green'
    this.screen.saveFocus()
    this.screen.append(prompt)
    return new Promise((resolve, reject) => {
      prompt.focus()
      prompt.ask(question, (err, res) => {
        prompt.detach()
        this.screen.render()
        this.screen.restoreFocus()
        if (err) reject(err)
        else resolve(res)
      })
    })
  }

  async prompt (question) {
    let width = Math.max(question.length, 18) + 4
    const prompt = blessed.prompt({
      top: 'center',
      left: 'center',
      width: width,
      height: 8,
      border: {
        type: 'line',
        fg: 'green'
      },
      tags: true,
      style: {
        fg: 'green',
        bg: 'black'
      }
    })
    prompt._.okay.style.fg = 'green'
    prompt._.cancel.style.fg = 'green'
    this.screen.saveFocus()
    this.screen.append(prompt)
    return new Promise((resolve, reject) => {
      prompt.focus()
      prompt.input(question, (err, res) => {
        prompt.detach()
        this.screen.render()
        this.screen.restoreFocus()
        if (err) reject(err)
        else resolve(res)
      })
    })
  }

  async message (content, color = 'green') {
    let width = Math.max(content.length, 18) + 4
    const msg = blessed.text({
      top: 'center',
      left: 'center',
      width: width,
      height: 3,
      border: {
        type: 'line',
        fg: color
      },
      tags: true,
      style: {
        fg: color,
        bg: 'black'
      },
      content
    })
    this.screen.append(msg)
    await new Promise(r => setTimeout(r, 2e3))
    msg.detach()
  }
}