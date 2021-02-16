import blessed from 'blessed'
import { BaseView } from './base.js'

export class HyperspaceView extends BaseView {
  setup () {
    const {screen} = this

    var menu = blessed.list({
      top: '0%+1',
      left: '0',
      width: '0%+20',
      height: '100%-1',
      interactive: true,
      keys: true,
      items: ['todo'],
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