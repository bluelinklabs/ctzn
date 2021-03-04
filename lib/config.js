import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import * as crypto from 'crypto'
import bytes from 'bytes'

export class Config {
  constructor (opts) {
    this.configDir = opts.configDir
    this.values = {}
    this.error = undefined
    this.read()

    this.overrides = opts
  }

  get filePath () {
    return path.join(this.configDir, 'config.json')
  }

  get domain () {
    return this.overrides.domain || this.values.domain || undefined
  }

  get port () {
    return this.overrides.port || this.values.port || 3000
  }

  get debugMode () {
    return this.overrides.debugMode || this.values.debugMode || false
  }

  get hyperspaceHost () {
    return this.overrides.hyperspaceHost || this.values.hyperspaceHost || undefined
  }

  get hyperspaceStorage () {
    return this.overrides.hyperspaceStorage || this.values.hyperspaceStorage || path.join(os.homedir(), '.hyperspace/storage')
  }

  get avatarSizeLimit () {
    const v = this.overrides.avatarSizeLimit || this.values.avatarSizeLimit || '500kb'
    return typeof v === 'string' ? bytes(v) : v
  }

  get smtpConfig () {
    return this.overrides.smtpConfig || this.values.smtpConfig || undefined
  }

  getLocalAuthToken () {
    if (this._localAuthToken) return this._localAuthToken
    let p = path.join(this.configDir, '.local-auth-token')
    try {
      this._localAuthToken = fs.readFileSync(p, 'utf8')
    } catch (e) {
      this._localAuthToken = crypto.randomBytes(8).toString('base64')
      fs.writeFileSync(p, this._localAuthToken, 'utf8')
    }
    return this._localAuthToken
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
    try { fs.mkdirSync(this.configDir) } catch (e) {}
    fs.writeFileSync(this.filePath, JSON.stringify(this.values, null, 2), 'utf8')
  }
}