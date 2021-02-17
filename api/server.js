import * as db from '../db/index.js'
import * as issues from '../lib/issues.js'

export function setup (wsServer) {
  wsServer.registerLoopback('server.listDatabases', async ([]) => {
    return (
      [db.publicServerDb, db.privateServerDb]
      .concat(Array.from(db.publicUserDbs.values()))
      .concat(Array.from(db.privateUserDbs.values()))
    ).map(db => ({
      dbType: db.dbType,
      writable: db.writable,
      key: db.key.toString('hex'),
      userId: db.userId,
      isPrivate: db.isPrivate,
      peerCount: db.peers?.length || 0,
      blobs: db.blobs.feed ? {
        key: db.blobs.feed.key.toString('hex'),
        writable: db.blobs.writable,
        isPrivate: db.blobs.isPrivate,
        peerCount: db.blobs.peers?.length || 0
      } : undefined
    }))
  })

  wsServer.registerLoopback('server.listIssues', () => {
    return Object.entries(issues.getAll()).map(([id, entries]) => {
      return {
        id,
        entries: entries.map(entry => ({
          description: entry.description,
          cause: entry.cause,
          error: entry.error,
          canRecover: entry.canRecover
        }))
      }
    })
  })

  wsServer.registerLoopback('server.recoverIssue', ([issueId]) => {
    return issues.recover(issueId)
  })

  wsServer.registerLoopback('server.dismissIssue', ([issueId, opts]) => {
    return issues.dismiss(issueId, opts)
  })
}
