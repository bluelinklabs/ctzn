import { HomeView } from './home.js'
import { HyperspaceView } from './hyperspace.js'

const VIEWS = {
  'home': HomeView,
  'hyperspace': HyperspaceView
}
let _screen
let _globals
let _currentView

export function setup ({screen}, globals) {
  _screen = screen
  _globals = globals
}

export function goto (view) {
  _currentView?.teardown()
  _currentView = new VIEWS[view](_screen, _globals)
}