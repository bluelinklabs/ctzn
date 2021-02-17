import blessed from 'blessed'
import contrib from 'blessed-contrib'
import { BaseView } from './base.js'

const FETCH_LATEST_INTERVAL = 2e3

export class HyperspaceView extends BaseView {
  async setup () {
    const {screen} = this

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

    this.selection = 'overview'
    this.databases = []

    this.listing = contrib.tree({
      top: 1,
      left: 0,
      width: '100%',
      height: '50%',
      tags: true,
      template: {
        lines: true,
        extend: ' ',
        retract: ' '
      },
      border: {type: 'line'}
    })
    screen.append(this.listing)
    screen.append(blessed.text({
      top: 1,
      left: 2,
      content: 'Databases',
      style: {bold: true}
    }))

    this.infopane = blessed.text({
      top: '50%',
      left: 0,
      width: '100%',
      height: '50%',
      tags: true,
      border: {type: 'line'}
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
    
    this.listing.on('select', (node) => {
      if (node.id) {
        this.selection = node.id
        this.fetchLatest()
      }
    })
    
    this.listing.focus()
    await this.fetchLatest()
    screen.render()

    this.fetchLatestInterval = setInterval(() => this.fetchLatest(), FETCH_LATEST_INTERVAL)
  }

  teardown () {
    clearInterval(this.fetchLatestInterval)
  }

  async fetchLatest () {
    this.databases = await this.api.call('server.listDatabases', []).catch(e => [])
    const communityDatabases = this.databases.filter(db => db.dbType === 'ctzn.network/public-community-db')
    const publicCitizenDatabases = this.databases.filter(db => db.dbType === 'ctzn.network/public-citizen-db')

    const isExtended = (key) => this.listing.data?.children?.[key].extended
    const toItem = db => {
      return {id: db.key, name: db.userId}
    }
    this.listing.setData({
      extended: true,
      children: {
        'Overview': {id: 'overview'},
        'Server': {id: 'server'},
        community: {
          name: `{bold}Community (${communityDatabases.length}){/}`,
          extended: isExtended('community'),
          children: communityDatabases.map(toItem)
        },
        citizen: {
          name: `{bold}Citizen (${publicCitizenDatabases.length}){/}`,
          extended: isExtended('citizen'),
          children: publicCitizenDatabases.map(toItem)
        }
      }
    })
    this.updateInfoPane()
    this.screen.render()
  }

  updateInfoPane () {
    let lines = []

    const dbInfo = (pub, priv) => {
      lines.push(`{bold}Public DB:{/} ${pub.key} (${pub.writable ? 'Writable' : 'Read-only'})`)
      lines.push(`- Peers: ${pub.peerCount} ${pub.isPrivate ? '(Is private)' : ''}`)
      if (pub.blobs) {
        lines.push(`{bold}Public Blobs:{/} ${pub.blobs.key} (${pub.blobs.writable ? 'Writable' : 'Read-only'})`)
        lines.push(`- Peers: ${pub.blobs.peerCount} ${pub.blobs.isPrivate ? '(Is private)' : ''}`)
      }
      if (priv) {
        lines.push(`{bold}Private DB:{/} ${priv.key} (${priv.writable ? 'Writable' : 'Read-only'})`)
        lines.push(`- Peers: ${priv.peerCount} ${priv.isPrivate ? '(Is private)' : ''}`)
        if (priv.blobs) {
          lines.push(`{bold}Public Blobs:{/} ${priv.blobs.key} (${priv.blobs.writable ? 'Writable' : 'Read-only'})`)
          lines.push(`- Peers: ${priv.blobs.peerCount} ${priv.blobs.isPrivate ? '(Is private)' : ''}`)
        }
      }
    }

    if (this.selection === 'overview') {
      lines.push('{inverse} Overview {/}')
      lines.push(`- {bold}${this.databases.length}{/} databases are active`)
      lines.push(`- {bold}${this.databases.filter(db => db.writable).length}{/} are writable, {bold}${this.databases.filter(db => !db.writable).length}{/} are readonly`)
      lines.push(`- {bold}${this.databases.filter(db => db.peerCount > 0).length}/${this.databases.filter(db => !db.isPrivate).length}{/} public DBs have peers`)
    } else if (this.selection === 'server') {
      let pub = this.databases.find(db => db.dbType === 'ctzn.network/public-server-db')
      let priv = this.databases.find(db => db.dbType === 'ctzn.network/private-server-db')
      lines.push(`{inverse} Server {/}`)
      dbInfo(pub, priv)
    } else {
      let pub = this.databases.find(db => db.key === this.selection)
      let priv = undefined
      if (pub.dbType === 'ctzn.network/public-citizen-db') {
        priv = this.databases.find(db => db.userId === pub.userId && db.dbType === 'ctzn.network/private-citizen-db')
      }
      lines.push(`{inverse} ${pub.userId} {/}`)
      dbInfo(pub, priv)
    }
    this.infopane.setContent(lines.join('\n'))
  }
}