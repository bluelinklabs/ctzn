import blessed from 'blessed'
import { BaseView } from './base.js'

export class HyperspaceView extends BaseView {
  async setup () {
    const {screen} = this
    this.api = await this.connectLoopback()

    var menu = blessed.list({
      top: '0%+1',
      left: '0',
      width: '0%+20',
      height: '100%-1',
      interactive: true,
      keys: true,
      items: await this.api.call('server.listHypercores', []),
      border: {
        type: 'line'
      },
      style: {
        selected: {
          fg: 'black',
          bg: 'white'
        }
      }
    })
    menu.focus()
    menu.on('select', node => {
      console.log(node.content)
    })
    screen.append(menu)
    
    screen.render()
  }
}