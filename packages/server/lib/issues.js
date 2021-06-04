import { Config } from './config.js'

let issues = {}
let ignoredIssueIds = new Set()

export function getAll () {
  return issues
}

export function count () {
  return Object.keys(issues).length
}

export function add (issue) {
  if (ignoredIssueIds.has(issue.id)) {
    return
  }
  issues[issue.id] = issues[issue.id] || []
  issues[issue.id].push(issue)
  if (Config.getActiveConfig()?.debugMode) {
    console.log('Issue logged:')
    console.log(issue)
  }
}

export async function recover (issueId) {
  if (!issues[issueId]?.[0]?.canRecover) return
  let issue = issues[issueId][0]
  delete issues[issueId]
  await issue.recover() // attempt recovery
  // if recovery fails, the issue should be readded
}

export function dismiss (issueId, {ignoreFuture} = {ignoreFuture: false}) {
  delete issues[issueId]
  if (ignoreFuture) ignoredIssueIds.add(issueId)
}