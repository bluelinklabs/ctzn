import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'

export class Config {
  constructor (configDir) {
    this.configDir = configDir
    this.values = {}
    this.error = undefined
    this.read()
  }

  get filePath () {
    return path.join(this.configDir, 'config.json')
  }

  get domain () {
    return this.values.domain || undefined
  }

  get port () {
    return this.values.port || 3000
  }

  get debugMode () {
    return this.values.debugMode || false
  }

  get hyperspaceHost () {
    return this.values.hyperspaceHost || undefined
  }

  get hyperspaceStorage () {
    return this.values.hyperspaceStorage || path.join(os.homedir(), '.hyperspace')
  }

  read () {
    this.error = undefined
    try {
      this.values = JSON.parse(fs.readFileSync(this.filePath, 'utf8'))
    } catch (e) {
      this.error = e
    }
  }

  update (values) {
    Object.assign(this.values, values)
    this.write()
  }

  write () {
    fs.writeFileSync(this.filePath, JSON.stringify(this.values, null, 2), 'utf8')
  }
}