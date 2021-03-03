import * as path from 'path'
import * as os from 'os'
import blessed from 'blessed'
import * as views from './views/index.js'
 
export function start ({pkg, configDir}) {
  configDir = configDir || path.join(os.homedir(), '.ctzn')
  
  var screen = blessed.screen({
    smartCSR: true,
    dockBorders: true
    // log: './tui.log'
  })
  screen._listenedMouse = true // HACK- short-circuit blessed's mouse handling to disable it
  screen.title = `CTZN ${pkg.version}`
  screen.key(['C-c'], function(ch, key) {
    return process.exit(0)
  })
  screen.key(['f1'], () => views.goto('home'))
  screen.key(['f2'], () => views.goto('hyperspace'))
  screen.key(['f3'], () => views.goto('issues'))
  screen.key(['f4'], () => views.goto('communities'))
  screen.key(['f5'], () => views.goto('accounts'))

  views.setup({screen}, {pkg, configDir})
  views.goto('home')
}

