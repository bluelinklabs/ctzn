import blessed from 'blessed'
import contrib from 'blessed-contrib'
import * as path from 'path'
import { fileURLToPath } from 'url'
import * as os from 'os'
import * as tail from 'tail'
import { BaseView } from './base.js'
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
    this.numIssues = 0
    this.api = undefined

    this.status = blessed.text({
      top: 1,
      left: 0,
      width: '100%',
      height: 6,
      tags: true,
      border: {type: 'line'},
      padding: {left: 1},
      content: 'Loading...'
    })
    screen.append(this.status)
    screen.append(blessed.text({
      top: 1,
      left: 3,
      content: 'Status',
      style: {bold: true}
    }))

    this.menu = blessed.text({
      top: 5,
      left: 2,
      height: 1,
      tags: true,
      content: '{green-fg}{bold}[s]{/} {green-fg}Start Server{/}  {green-fg}{bold}[r]{/} {green-fg}Restart Server{/}  {green-fg}{bold}[k]{/} {green-fg}Stop Server{/}  {green-fg}{bold}[c]{/} {green-fg}Configure{/}'
    })
    this.menu.key(['s'], () => this.onStartServer())
    this.menu.key(['r'], () => this.onRestartServer())
    this.menu.key(['k'], () => this.onStopServer())
    this.menu.key(['c'], () => this.onConfigure())
    this.menu.key(['l'], () => this.screen.spawn('less', [OUT_LOG_PATH]))
    this.menu.key(['e'], () => this.screen.spawn('less', [ERR_LOG_PATH]))
    this.menu.key(['up'], () => { this.log.scroll(-20); this.screen.render() })
    this.menu.key(['down'], () => { this.log.scroll(20); this.screen.render() })
    this.menu.focus()
    screen.append(this.menu)

    this.log = contrib.log({
      top: 7,
      left: 0,
      width: '100%',
      height: '100%-7',
      tags: true,
      border: {type: 'line'}
    })
    screen.append(this.log)
    screen.append(blessed.text({
      top: 7,
      left: 3,
      content: 'Server log',
      style: {bold: true}
    }))
    screen.append(blessed.text({
      top: 7,
      left: '100%-35',
      content: '[l] View log',
      style: {fg: 'gray'}
    }))
    screen.append(blessed.text({
      top: 7,
      left: '100%-20',
      content: '[e] View err log',
      style: {fg: 'gray'}
    }))
    
    screen.render()
    this.updateStatus()
    this.updateStatusInterval = setInterval(() => this.updateStatus(), UPDATE_STATUS_INTERVAL)
  }

  teardown () {
    clearInterval(this.updateStatusInterval)
    if (this.api?.socket) this.api?.close()
  }

  tryTailLogs () {
    if (this.logTails.length) return
    try {
      this.logTails.push(new tail.Tail(ERR_LOG_PATH, {nLines: 10}))
      let firstErr = true
      this.logTails[0].on('line', line => {
        if (firstErr) {
          this.log.log('')
          this.log.log('{underline}Last 10 stderr lines{/}')
          firstErr = false
        }
        this.log.log(`{gray-fg}${line}{/}`)
      })

      this.logTails.push(new tail.Tail(OUT_LOG_PATH, {nLines: 10}))
      let firstOut = true
      this.logTails[1].on('line', line => {
        if (firstOut) {
          this.log.log('')
          this.log.log('{underline}Last 10 stdout lines{/}')
          firstOut = false
        }
        this.log.log(`{gray-fg}${line}{/}`)
      })
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

    if (this.isOnline && !this.api) {
      this.api = await this.connectLoopback().catch(e => undefined)
    } else if (!this.isOnline && this.api?.socket) {
      this.api?.close()
      this.api = undefined
    }
    if (this.api) {
      this.numIssues = (await this.api.call('server.listIssues', []).catch(e => [])).length
    }

    this.status.setContent(this.genStatusContent())
    this.screen.render()
  }

  genStatusContent () {
    let line1 = this.config.domain
      ? `${this.isOnline ? '{bold}{green-fg}Online{/}' : '{bold}{red-fg}Offline{/}'} (${this.config.domain}:${this.config.port})`
      : `${this.isOnline ? '{bold}{green-fg}Online{/}' : '{bold}{red-fg}Offline{/}'} {red-bg}{black-fg} Configure your server to get started (press c) {/}`
    if (this.isOnline && this.numIssues > 0) {
      line1 += ` {bold}{yellow-fg}Issues: ${this.numIssues}{/} {gray-fg}Press [F3] to review issues{/}`
    }
    let lines = [
      line1,
      `Config dir: ${this.config.configDir} `
    ]
    return lines.join('\n')
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
    this.log.log('')
    this.log.log('{underline}Starting server... {/underline}')
    pm2.connect(err => {
      if (err) return this.log.log(`{red-fg}${err.toString()}{/}`)
      pm2.start({name: 'ctzn', script: BINJS_PATH, args: ['start', '--configDir', this.config.configDir], log_date_format : 'YYYY-MM-DD HH:mm Z'}, err => {
        if (err) return this.log.log(`{red-fg}${err.toString()}{/}`)
        pm2.disconnect()
        this.updateStatus()
      })
    })
  }

  async onRestartServer () {
    var res = await this.ask('Restart the server?')
    if (!res) return
    this.log.log('')
    this.log.log('{underline}Restarting server... {/underline}')
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
    this.log.log('')
    this.log.log('{underline}Stopping server... {/underline}')
    pm2.connect(err => {
      if (err) return this.log.log(`{red-fg}${err.toString()}{/}`)
      pm2.stop('ctzn', err => {
        if (err) return this.log.log(`{red-fg}${err.toString()}{/}`)
        this.log.log('✔️ Stopped')
        pm2.disconnect()
        this.updateStatus()
      })
    })
  }
}