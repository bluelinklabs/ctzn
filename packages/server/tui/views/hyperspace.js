import blessed from 'blessed'
import contrib from 'blessed-contrib'
import { BaseView } from './base.js'

const FETCH_LATEST_INTERVAL = 2e3

const IS_UNREACHABLE = db => !db.isPrivate && !db.writable && db.peerCount === 0
const HAS_ISSUE = db => IS_UNREACHABLE(db)

export class HyperspaceView extends BaseView {
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
      this.render()
      return
    }

    this.selection = 'overview'
    this.databases = []
    this.dbsListed = []

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
      content: 'Databases',
      style: {bold: true}
    }))

    this.infopane = blessed.box({
      top: '50%',
      left: 0,
      width: '100%',
      height: '50%',
      tags: true,
      // border: {type: 'line'}
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
    
    this.listing.on('select', (node, index) => {
      if (this.selection !== this.dbsListed[index - 1].key) {
        this.selection = this.dbsListed[index - 1].key
        this.fetchLatest()
      }
    })
    
    this.listing.focus()
    this.listing.key(['r'], this.onRebuildIndexes.bind(this))

    await this.fetchLatest()
    this.render()

    this.fetchLatestInterval = setInterval(() => this.fetchLatest(), FETCH_LATEST_INTERVAL)
  }

  teardown () {
    clearInterval(this.fetchLatestInterval)
    if (this.api?.socket) this.api?.close()
  }

  async fetchLatest () {
    this.databases = await this.api.call('server.listDatabases', []).catch(e => [])
    this.dbsListed = this.databases
      .filter(db => ['ctzn.network/public-server-db', 'ctzn.network/public-citizen-db'].includes(db.dbType))
      .sort((a, b) => {
        if (!a.userId) return -1
        if (!b.userId) return 1
        return a.userId.localeCompare(b.userId)
      })
    const selected = this.listing.selected
    this.listing.setData([
      ['Type', 'Name', 'Peers', 'Writable', 'Status'],
      ...this.dbsListed.map(db => ([
        ({
          'ctzn.network/public-server-db': 'Server',
          'ctzn.network/public-citizen-db': 'Citizen'
        })[db.dbType],
        db.userId || 'Server',
        String(db.peerCount),
        db.writable ? 'Yes' : 'No',
        HAS_ISSUE(db) ? '{red-fg}⚠{/}' : '{green-fg}✔{/}'
      ]))
    ])
    if (selected) this.listing.select(selected)
    this.updateInfoPane()
    this.render()
  }

  updateInfoPane () {
    for (let child of this.infopane.children.slice()) {
      child.detach()
    }

    const oneRow = (top, a) => {
      this.infopane.append(blessed.text({
        left: 0,
        top,
        width: '100%',
        height: 3,
        border: {type: 'line'},
        tags: true,
        content: a
      }))
    }
    const fourRow = (top, a, b, c, d) => {
      this.infopane.append(blessed.text({
        left: 0,
        top,
        width: '25%+1',
        height: 3,
        border: {type: 'line'},
        tags: true,
        content: a
      }))
      if (b) {
        this.infopane.append(blessed.text({
          left: '25%',
          top,
          width: '25%+2',
          height: 3,
          border: {type: 'line'},
          tags: true,
          content: b
        }))
      }
      if (c) {
        this.infopane.append(blessed.text({
          left: '50%',
          top,
          width: '25%+3',
          height: 3,
          border: {type: 'line'},
          tags: true,
          content: c
        }))
      }
      if (d) {
        this.infopane.append(blessed.text({
          left: '75%',
          top,
          width: '25%+1',
          height: 3,
          border: {type: 'line'},
          tags: true,
          content: d
        }))
      }
    }

    if (this.selection === 'overview') {
      fourRow(0,
        ` {bold}${this.databases.length}{/} DBs active`,
        ` {bold}${this.databases.filter(db => db.writable).length}{/} writable`,
        ` {bold}${this.databases.filter(db => !db.writable).length}{/} readonly`,
        ` {bold}${this.databases.filter(db => !db.isPrivate).length}{/} public`
      )

      let issues = []
      let unreachableDbs = this.databases.filter(IS_UNREACHABLE)
      if (unreachableDbs.length) {
        issues.push(` {red-fg}Issue: ${unreachableDbs.length} external database${unreachableDbs.length > 1 ? 's' : ''} are currently unreachable{/}`)
      }
      this.infopane.append(blessed.text({
        left: 0,
        top: 2,
        width: '100%',
        height: '100%-2',
        border: {type: 'line'},
        tags: true,
        content: issues.length ? issues.join('\n') : ' No issues'
      }))
    } else {
      let pub = this.databases.find(db => db.key === this.selection)
      let priv = undefined
      if (pub.dbType === 'ctzn.network/public-citizen-db') {
        priv = this.databases.find(db => db.userId === pub.userId && db.dbType === 'ctzn.network/private-citizen-db')
      } else if (pub.dbType === 'ctzn.network/public-server-db') {
        priv = this.databases.find(db => db.dbType === 'ctzn.network/private-server-db')
      }

      const typeLabel = ({
        'ctzn.network/public-server-db': 'Server',
        'ctzn.network/public-citizen-db': 'Citizen'
      })[pub.dbType]
      this.infopane.append(blessed.text({
        left: 0,
        top: 0,
        width: '100%',
        height: 3,
        tags: true,
        content: ` {bold}${pub.userId || 'Server'}{/} ${typeLabel}`,
        border: {type: 'line'}
      }))
      let top = 2
      fourRow(top,
        ` {bold}Public DB{/}`,
        ` ${pub.writable ? 'Writable' : 'Read-only'}`,
        ` ${pub.isPrivate ? 'Is private' : `Peers: ${pub.peerCount}`}`,
        IS_UNREACHABLE(pub) ? ' {red-fg}No reachable peers{/}' : ' {green-fg}No issues{/}'
      )
      top += 2
      oneRow(top, ` Key: ${pub.key}`)
      top += 2
      if (pub.blobs) {
        fourRow(top,
          ` {bold}Public Blobs{/}`,
          ` ${pub.blobs.writable ? 'Writable' : 'Read-only'}`,
          ` ${pub.blobs.isPrivate ? 'Is private' : `Peers: ${pub.blobs.peerCount}`}`,
          IS_UNREACHABLE(pub.blobs) ? ' {red-fg}No reachable peers{/}' : ' {green-fg}No issues{/}'
        )
        top += 2
        oneRow(top, ` Key: ${pub.blobs.key}`)
        top += 2
      }
      if (priv) {
        fourRow(top,
          ` {bold}Private DB{/}`,
          ` ${priv.writable ? 'Writable' : 'Read-only'}`,
          ` ${priv.isPrivate ? 'Is private' : `Peers: ${priv.peerCount}`}`,
          IS_UNREACHABLE(priv) ? ' {red-fg}No reachable peers{/}' : ' {green-fg}No issues{/}'
        )
        top += 2
        oneRow(top, ` Key: ${priv.key}`)
        top += 2
        if (priv.blobs) {
          fourRow(top,
            ` {bold}Private Blobs{/}`,
            ` ${priv.blobs.writable ? 'Writable' : 'Read-only'}`,
            ` ${priv.blobs.isPrivate ? 'Is private' : `Peers: ${priv.blobs.peerCount}`}`,
            IS_UNREACHABLE(priv.blobs) ? ' {red-fg}No reachable peers{/}' : ' {green-fg}No issues{/}'
          )
          top += 2
          oneRow(top, ` Key: ${priv.blobs.key}`)
          top += 2
        }
      }
      if (pub.indexers?.length) {
        this.infopane.append(blessed.text({
          top,
          left: 0,
          width: '100%',
          height: 3,
          border: {type: 'line'},
          padding: {left: 1},
          tags: true,
          content: '{green-fg}{bold}[r]{/} {green-fg}Rebuild indexes{/}'
        }))
        top += 2
      }
    }
  }

  // events
  // =

  onRebuildIndexes () {
    this.isInFlow = true
    const db = this.databases.find(db => db.key === this.selection)

    var form = blessed.form({
      top: '0%+1',
      left: '0%',
      width: '100%',
      height: '100%-1',
      scrollable: true,
      tags: true,
      border: {type: 'line'},
      style: {bg: 'black', fg: 'white'}
    })
    this.screen.append(form)

    form.append(blessed.text({
      top: 0,
      left: 1,
      content: '(Escape) Close'
    }))
    form.append(blessed.text({
      top: 0,
      left: 18,
      content: '(Up/Down) Navigate'
    }))

    let offset = 1
    const header = ({label}) => {
      form.append(blessed.text({
        top: `0%+${offset+1}`,
        left: 1,
        width: '100%-5',
        content: label,
        style: {underline: true}
      }))
      offset += 3
    }
    let inputs = []
    const checkbox = ({label, key}) => {
      let myIndex = inputs.length
      form.append(blessed.text({
        top: offset,
        left: 5,
        width: `100%-5`,
        content: label
      }))
      let checkbox = blessed.checkbox({
        name: key,
        top: offset,
        left: 1,
        width: 4,
        height: 3,
        interactive: true,
        keys: true,
        inputOnFocus: true
      })
      // checkbox.on('blur', () => form.focus())
      checkbox.key(['up'], () => inputs[myIndex - 1]?.focus())
      checkbox.key(['down', 'enter'], () => inputs[myIndex + 1]?.focus())
      checkbox.key(['escape'], () => askFinished())
      form.append(checkbox)
      inputs.push(checkbox)
      offset += 2
    }

    header({label: `Select indexes to rebuild for ${db.userId}`})
    for (let indexId of db.indexers) {
      checkbox({label: indexId, key: indexId})
    }

    inputs[0].focus()
    this.screen.saveFocus()
    this.screen.render()

    const askFinished = async () => {
      var res = await this.ask('Trigger rebuilds?')
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
      this.isInFlow = false
      this.fetchLatest()
    }
    // form.key(['up', 'down'], () => inputs[0].focus())
    form.key(['escape'], () => askFinished())
    form.on('submit', async (kvs) => {
      const indexesToRebuild = []
      for (let indexId in kvs) {
        if (kvs[indexId]) {
          indexesToRebuild.push(indexId)
        }
      }
      await this.api.call('server.rebuildDatabaseIndexes', [db.userId, indexesToRebuild]).catch(e => [])
      teardown()
    })
  }
}