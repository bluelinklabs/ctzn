import blessed from 'blessed'
import contrib from 'blessed-contrib'
import * as path from 'path'
import { fileURLToPath } from 'url'
import * as os from 'os'
import * as tail from 'tail'
import { BaseView } from './base.js'
import { Config } from '../../lib/config.js'
import fetch from 'node-fetch'
import pm2 from 'pm2'

const BINJS_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../bin.js')
const OUT_LOG_PATH = path.join(os.homedir(), '.pm2/logs/ctzn-out.log')
const ERR_LOG_PATH = path.join(os.homedir(), '.pm2/logs/ctzn-error.log')
const UPDATE_STATUS_INTERVAL = 2e3

export class HomeView extends BaseView {
  constructor (screen, globals) {
    super(screen, globals)
  }

  setup () {
    const {screen} = this
    this.isOnline = false
    this.logTails = []
    this.config = new Config(this.globals.configDir)

    this.menu = blessed.text({
      top: '0%+1',
      left: '0%',
      width: '100%',
      height: '0%+1',
      tags: true,
      content: '(s) Start Server  (r) Restart Server  (k) Stop Server  (c) Configure',
      style: {bg: 'black', fg: 'green'}
    })
    this.menu.key(['s'], () => this.onStartServer())
    this.menu.key(['r'], () => this.onRestartServer())
    this.menu.key(['k'], () => this.onStopServer())
    this.menu.key(['c'], () => this.onConfigure())
    this.menu.focus()
    screen.append(this.menu)

    this.status = blessed.text({
      top: 3,
      left: 2,
      tags: true,
      content: 'Loading...'
    })
    screen.append(this.status)

    this.log = contrib.log({
      top: 6,
      left: 1,
      width: '100%-2',
      height: '100%-6',
      tags: true,
      border: {type: 'line'}
    })
    screen.append(this.log)
    screen.append(blessed.text({
      top: 6,
      left: 3,
      content: 'Server log',
      style: {bold: true}
    }))
    
    screen.render()
    this.updateStatus()
    this.updateStatusInterval = setInterval(() => this.updateStatus(), UPDATE_STATUS_INTERVAL)
  }

  teardown () {
    clearInterval(this.updateStatusInterval)
  }

  tryTailLogs () {
    if (this.logTails.length) return
    try {
      this.logTails.push(new tail.Tail(OUT_LOG_PATH, {nLines: 20}))
      this.logTails.push(new tail.Tail(ERR_LOG_PATH, {nLines: 20}))
      this.logTails[0].on('line', line => this.log.log(line))
      this.logTails[1].on('line', line => this.log.log(`{red-fg}${line}{/}`))
    } catch (e) {
      this.untailLogs()
    }
  }

  untailLogs () {
    for (let t of this.logTails) {
      t.unwatch()
    }
    this.logTails = []
  }

  async updateStatus () {
    this.tryTailLogs()

    try {
      let res = await fetch(`http://localhost:${this.config.port}`)
      this.isOnline = (res.status === 200)
    } catch (e) {
      this.isOnline = false
    }

    this.status.setContent(this.genStatusContent())
    this.screen.render()
  }

  genStatusContent () {
    let lines = [
      this.config.domain
        ? ['Status', `${this.isOnline ? '{green-fg}Online{/}' : '{red-fg}Offline{/}'} (${this.config.domain}:${this.config.port})`]
        : ['Status', `${this.isOnline ? '{green-fg}Online{/}' : '{red-fg}Offline{/}'} {red-bg}{black-fg} Configure your server to get started (press c) {/}`],
      ['Config Dir', this.config.configDir]
    ]
    return lines.map(line => `{bold}${line[0]}:{/} ${line[1]}`).join('\n')
  }

  // events
  // =

  onConfigure () {
    var form = blessed.form({
      top: '0%+1',
      left: '0%',
      width: '100%',
      height: '100%-1',
      tags: true,
      border: {type: 'line'},
      style: {bg: 'black', fg: 'white'}
    })
    this.screen.append(form)

    form.append(blessed.text({
      top: '0%-1',
      left: 1,
      content: 'Configure CTZN'
    }))
    form.append(blessed.text({
      top: '100%-2',
      left: 1,
      content: '(Escape) Close'
    }))
    form.append(blessed.text({
      top: '100%-2',
      left: 18,
      content: '(Up/Down) Navigate'
    }))

    let offset = 0
    const header = ({label}) => {
      form.append(blessed.text({
        top: `0%+${offset+1}`,
        left: 2,
        width: '100%-5',
        content: label,
        style: {underline: true}
      }))
      offset += 2
    }
    let inputs = []
    const input = ({label, key}) => {
      let myIndex = inputs.length
      form.append(blessed.text({
        top: `0%+${1 + offset}`,
        left: 2,
        width: 27,
        content: label + '.'.repeat(25 - label.length)
      }))
      let textbox = blessed.textbox({
        name: key,
        top: `0%+${offset}`,
        left: '30%',
        width: '100%-30',
        height: 3,
        interactive: true,
        keys: true,
        mouse: true,
        inputOnFocus: true,
        border: {type: 'line'}
      })
      textbox.on('blur', () => form.focus())
      textbox.key(['up'], () => inputs[myIndex - 1]?.focus())
      textbox.key(['down', 'enter'], () => inputs[myIndex + 1]?.focus())
      textbox.key(['escape'], () => askFinished())
      form.append(textbox)
      if (this.config[key]) textbox.setValue(String(this.config[key]))
      inputs.push(textbox)
      offset += 2
    }

    header({label: 'Basics'})
    input({label: 'Domain', key: 'domain'})
    input({label: 'Port', key: 'port'})
    header({label: 'Advanced'})
    input({label: 'Hyperspace Host', key: 'hyperspaceHost'})
    input({label: 'Hyperspace Storage Dir', key: 'hyperspaceStorage'})

    inputs[0].focus()
    this.screen.saveFocus()
    this.screen.render()

    const askFinished = async () => {
      var res = await this.ask('Save changes?')
      if (res) {
        form.submit()
      } else {
        teardown()
      }
    }

    const teardown = () => {
      this.screen.remove(form)
      this.screen.restoreFocus()
      this.screen.render()
      this.updateStatus()
    }
    form.key(['up', 'down'], () => inputs[0].focus())
    form.key(['escape'], () => askFinished())
    form.on('submit', (data) => {
      this.config.update(data)
      teardown()
    })
  }

  async onStartServer () {
    var res = await this.ask('Start the server?')
    if (!res) return
    this.log.log('{inverse} Starting server... {/inverse}')
    pm2.connect(err => {
      if (err) return this.log.log(`{red-fg}${err.toString()}{/}`)
      pm2.start({name: 'ctzn', script: BINJS_PATH, args: ['start', '--configDir', this.config.configDir]}, err => {
        if (err) return this.log.log(`{red-fg}${err.toString()}{/}`)
        pm2.disconnect()
        this.updateStatus()
      })
    })
  }

  async onRestartServer () {
    var res = await this.ask('Restart the server?')
    if (!res) return
    this.log.log('{inverse} Restarting server... {/inverse}')
    pm2.connect(err => {
      if (err) return this.log.log(`{red-fg}${err.toString()}{/}`)
      pm2.restart('ctzn', err => {
        if (err) return this.log.log(`{red-fg}${err.toString()}{/}`)
        pm2.disconnect()
        this.updateStatus()
      })
    })
  }

  async onStopServer () {
    var res = await this.ask('Stop the server?')
    if (!res) return
    this.log.log('{inverse} Stopping server... {/inverse}')
    pm2.connect(err => {
      if (err) return this.log.log(`{red-fg}${err.toString()}{/}`)
      pm2.stop('ctzn', err => {
        if (err) return this.log.log(`{red-fg}${err.toString()}{/}`)
        pm2.disconnect()
        this.updateStatus()
      })
    })
  }
}