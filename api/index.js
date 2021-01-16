import * as accounts from './accounts.js'
import * as comments from './comments.js'
import * as follows from './follows.js'
import * as posts from './posts.js'
import * as profiles from './profiles.js'
import * as users from './users.js'
import * as votes from './votes.js'

export function setup (wsServer) {
  accounts.setup(wsServer)
  comments.setup(wsServer)
  follows.setup(wsServer)
  posts.setup(wsServer)
  profiles.setup(wsServer)
  users.setup(wsServer)
  votes.setup(wsServer)
}