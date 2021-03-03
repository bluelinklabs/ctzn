import blessed from 'blessed'
import { BaseView } from './base.js'

export class AccountsView extends BaseView {
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
    this.accounts = []

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
      content: 'Accounts',
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
      if (this.selection !== this.accounts[index - 1].userId) {
        this.selection = this.accounts[index - 1].userId
        this.updateInfoPane()
      }
    })
    
    this.listing.focus()
    this.listing.key(['d'], async () => {
      const userId = this.selection
      if (!(await this.ask('Are you sure you want to delete this account?'))) {
        return
      }
      if (!(await this.ask(`The account being deleted is ${userId}. Are you REALLY sure?`))) {
        return
      }
      const [username, _] = userId.split('@')
      try {
        await this.api.call('server.removeUser', [username])
        this.message('Account deleted', 'green')
      } catch (e) {
        this.message('Failed to delete account, consult the logs', 'red')
      }
      await this.fetchLatest()
    })

    await this.fetchLatest()
    this.render()
  }

  teardown () {
    clearInterval(this.fetchLatestInterval)
    if (this.api?.socket) this.api?.close()
  }

  async fetchLatest () {
    this.accounts = await this.api.call('server.listAccounts', []).catch(e => [])
    const selected = this.listing.selected
    this.listing.setData([
      ['ID', 'Name'],
      ...this.accounts.map(account => ([
        String(account.userId),
        String(account.displayName)
      ]))
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

    const account = this.accounts.find(account => account.userId === this.selection)
    if (!account) return

    this.infopane.append(blessed.text({
      left: 0,
      top: 0,
      width: '100%',
      height: 3,
      border: {type: 'line'},
      padding: {left: 1},
      tags: true,
      content: `${account.displayName} {gray-fg}${account.userId}{/}`
    }))
    this.infopane.append(blessed.text({
      top: 0,
      left: 2,
      content: 'Account',
      style: {bold: true}
    }))
    this.infopane.append(blessed.text({
      top: 9,
      left: 0,
      width: '100%',
      height: 3,
      border: {type: 'line'},
      padding: {left: 1},
      tags: true,
      content: '{green-fg}{bold}[d]{/} {green-fg}Delete account{/}'
    }))

    this.render()
  }
}