import blessed from 'blessed'
import contrib from 'blessed-contrib'
import { BaseView } from './base.js'

const FETCH_LATEST_INTERVAL = 2e3

export class IssuesView extends BaseView {
  render () {
    if (!this.isInFlow) this.screen.render()
  }

  async setup () {
    const {screen} = this
    this.isInFlow = false

    try {
      this.api = await this.connectLoopback()
    } catch (e) {
      screen.append(blessed.text({
        top: 2,
        left: 2,
        content: `Failed to connect to server\n${e.message}`,
        style: {fg: 'red'},
        border: {type: 'line', fg: 'red'}
      }))
      screen.render()
      return
    }

    this.selection = undefined
    this.issues = []

    this.listing = blessed.listtable({
      top: 1,
      left: 0,
      width: '100%',
      height: '50%',
      tags: true,
      interactive: true,
      keys: true,
      align: 'left',
      style: {
        header: {underline: true},
        cell: {selected: {bg: 'white', fg: 'black'}}
      },
      border: {type: 'line'}
    })
    screen.append(this.listing)
    screen.append(blessed.text({
      top: 1,
      left: 2,
      content: 'Issues',
      style: {bold: true}
    }))

    this.infopane = blessed.box({
      top: '50%+1',
      left: 0,
      width: '100%',
      height: '50%',
      tags: true
    })
    screen.append(this.infopane)

    // HACK
    // fix some spacing behaviors in blessed-contrib to take the full space possible
    this.listing.rows.top = 0
    this.listing.render = function () {
      if (this.screen.focused === this.rows) this.rows.focus()
      this.rows.width = this.width - 3
      this.rows.height = this.height - 2
      blessed.Box.prototype.render.call(this)
    }
    
    this.listing.on('select item', (node, index) => {
      if (this.selection !== this.issues[index - 1].id) {
        this.selection = this.issues[index - 1].id
        this.updateInfoPane()
      }
    })
    
    this.listing.focus()
    this.listing.key(['r'], async () => {
      if (!(await this.ask('Attempt to recover this issue?'))) {
        return
      }
      
      this.isInFlow = true
      try {
        const issueId = this.selection
        await this.api.call('server.recoverIssue', [issueId])
        await new Promise(r => setTimeout(r, 1000)) // give a second to attempt recovery
        await this.fetchLatest()

        let index = this.issues.findIndex(issue => issue.id === issueId)
        if (index !== -1) {
          this.listing.select(index + 1)
          this.message('Recovery appears to have been unsuccessful.', 'yellow')
        } else {
          this.message('Recovery appears to have been successful.')
        }
      } finally {
        this.isInFlow = false
        this.render()
        this.listing.focus()
      }
    })
    this.listing.key(['d'], async () => {
      if (!(await this.ask('Dismiss this issue?'))) {
        return
      }
      await this.api.call('server.dismissIssue', [this.selection])
      await this.fetchLatest()
    })
    this.listing.key(['i'], async () => {
      if (!(await this.ask('Dismiss and ignore this issue?'))) {
        return
      }
      await this.api.call('server.dismissIssue', [this.selection, {ignoreFuture: true}])
      await this.fetchLatest()
    })

    await this.fetchLatest()
    this.render()
    this.fetchLatestInterval = setInterval(() => this.fetchLatest(), FETCH_LATEST_INTERVAL)
  }

  teardown () {
    clearInterval(this.fetchLatestInterval)
    if (this.api?.socket) this.api?.close()
  }

  async fetchLatest () {
    this.issues = await this.api.call('server.listIssues', []).catch(e => [])
    const selected = this.listing.selected
    this.listing.setData([
      ['Issue', 'Repetitions'],
      ...this.issues.map(issue => ([issue.entries[0].description, String(issue.entries.length)]))
    ])
    if (selected) this.listing.select(selected)
    this.render()
  }

  updateInfoPane () {
    for (let child of this.infopane.children.slice()) {
      this.infopane.remove(child)
    }
    if (!this.selection) {
      return
    }

    const issue = this.issues.find(issue => issue.id === this.selection)
    if (!issue) return

    this.infopane.append(blessed.text({
      left: 0,
      top: 0,
      width: '100%-20',
      height: 3,
      border: {type: 'line'},
      padding: {left: 1},
      content: issue.entries[0].description
    }))
    this.infopane.append(blessed.text({
      top: 0,
      left: 2,
      content: 'Description',
      style: {bold: true}
    }))
    this.infopane.append(blessed.text({
      left: '100%-21',
      top: 0,
      width: 21,
      height: 3,
      border: {type: 'line'},
      padding: {left: 1},
      content: String(issue.entries.length)
    }))
    this.infopane.append(blessed.text({
      top: 0,
      left: '100%-18',
      content: 'Repetitions',
      style: {bold: true}
    }))
    this.infopane.append(blessed.text({
      left: 0,
      top: 2,
      width: '100%',
      height: 8,
      border: {type: 'line'},
      padding: {left: 1},
      content: issue.entries[0].cause
    }))
    this.infopane.append(blessed.text({
      top: 2,
      left: 2,
      content: 'Cause',
      style: {bold: true}
    }))
    this.infopane.append(blessed.text({
      left: 0,
      top: 8,
      width: '100%',
      height: 6,
      border: {type: 'line'},
      padding: {left: 1},
      content: issue.entries[0].error
    }))
    this.infopane.append(blessed.text({
      top: 8,
      left: 2,
      content: 'Error',
      style: {bold: true}
    }))

    this.infopane.append(blessed.text({
      top: 13,
      left: 0,
      width: '100%',
      height: 3,
      border: {type: 'line'},
      padding: {left: 1},
      tags: true,
      content: '{green-fg}{bold}[r]{/} {green-fg}Attempt recovery{/}  {green-fg}{bold}[d]{/} {green-fg}Dismiss{/}  {green-fg}{bold}[i]{/} {green-fg}Dismiss and ignore{/}'
    }))

    this.render()
  }
}