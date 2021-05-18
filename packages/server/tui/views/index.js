import { HomeView } from './home.js'
import { HyperspaceView } from './hyperspace.js'
import { IssuesView } from './issues.js'
import { CommunitiesView } from './communities.js'
import { AccountsView } from './accounts.js'

const VIEWS = {
  'home': HomeView,
  'hyperspace': HyperspaceView,
  'issues': IssuesView,
  'communities': CommunitiesView,
  'accounts': AccountsView
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