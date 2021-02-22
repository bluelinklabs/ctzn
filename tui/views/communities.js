import blessed from 'blessed'
import { BaseView } from './base.js'

export class CommunitiesView extends BaseView {
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
    this.communities = []

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
      content: 'Communities',
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
      if (this.selection !== this.communities[index - 1].userId) {
        this.selection = this.communities[index - 1].userId
        this.updateInfoPane()
      }
    })
    
    this.listing.focus()
    this.listing.key(['a'], async () => {
      let userId = await this.prompt('UserID to add to admins')
      if (!userId) return
      try {
        await this.api.call('server.addCommunityAdmin', [this.selection, userId])
      } catch (e) {
        this.message(e.data, 'red')
      }
      await this.fetchLatest()
    })
    this.listing.key(['r'], async () => {
      let userId = await this.prompt('UserID to remove from admins')
      if (!userId) return
      try {
        await this.api.call('server.removeCommunityAdmin', [this.selection, userId])
      } catch (e) {
        this.message(e.data, 'red')
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
    this.communities = await this.api.call('server.listCommunities', []).catch(e => [])
    const selected = this.listing.selected
    this.listing.setData([
      ['ID', 'Name', 'Members'],
      ...this.communities.map(community => ([
        String(community.userId),
        String(community.displayName),
        String(community.numMembers)
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

    const community = this.communities.find(community => community.userId === this.selection)
    if (!community) return

    this.infopane.append(blessed.text({
      left: 0,
      top: 0,
      width: '100%',
      height: 3,
      border: {type: 'line'},
      padding: {left: 1},
      tags: true,
      content: `${community.displayName} {gray-fg}${community.userId}{/}`
    }))
    this.infopane.append(blessed.text({
      top: 0,
      left: 2,
      content: 'Community',
      style: {bold: true}
    }))
    this.infopane.append(blessed.text({
      left: 0,
      top: 2,
      width: '100%',
      height: 8,
      border: {type: 'line'},
      padding: {left: 1},
      content: community.admins.join('\n')
    }))
    this.infopane.append(blessed.text({
      top: 2,
      left: 2,
      content: 'Admins',
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
      content: '{green-fg}{bold}[a]{/} {green-fg}Add admin{/} {green-fg}{bold}[r]{/} {green-fg}Remove admin{/}'
    }))

    this.render()
  }
}