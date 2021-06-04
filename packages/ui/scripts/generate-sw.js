import { execSync } from 'child_process'
import * as fs from 'fs'

console.log('Generate service-worker.js...')

// get the latest commit hash
const LAST_COMMIT = execSync('git rev-parse HEAD').toString('utf8').trim()
console.log('Got last commit hash', LAST_COMMIT)

// update ../frontend_app/static/service-worker.js to use the hash in the cache name
const script = fs.readFileSync('./frontend_app/static/service-worker-template.js', 'utf8')
fs.writeFileSync('./frontend_app/static/service-worker.js', script.replace('$CACHE_NAME', LAST_COMMIT))
console.log('Wrote service-worker.js')