import nodemailer from 'nodemailer'
import { stubTransport, interactsWithMail } from 'nodemailer-stub'

let transport
let senderAddress

export async function setup (config) {
  if (config.debugMode) {
    senderAddress = 'Debug <debug@localhost>'
    transport = nodemailer.createTransport(stubTransport) 
  } else if (config.smtpConfig) {
    const cfg = config.smtpConfig
    validateConfig(cfg.host && typeof cfg.host === 'string', 'host must a string')
    validateConfig(typeof cfg.port === 'undefined' || typeof cfg.port !== 'number', 'port must be a number')
    validateConfig(typeof cfg.useTLS === 'undefined' || typeof cfg.useTLS === 'boolean', 'useTLS must a boolean')
    validateConfig(cfg.username && typeof cfg.username === 'string', 'username must a string')
    validateConfig(cfg.password && typeof cfg.password === 'string', 'password must a string')
    validateConfig(cfg.senderAddress && typeof cfg.senderAddress === 'string', 'senderAddress must a string (eg "Admin <admin@server.com>"')
    
    senderAddress = cfg.senderAddress
    transport = nodemailer.createTransport({
      pool: true,
      host: cfg.host,
      port: cfg.port || 465,
      secure: typeof cfg.useTLS === 'undefined' ? true : cfg.useTLS, // use TLS
      auth: {
        user: cfg.username,
        pass: cfg.password
      }
    })

    try {
      await transport.verify()
    } catch (e) {
      console.error('Mail server misconfigured')
      console.error(e)
      process.exit(1)
    }
  }
}

export function isConfigured () {
  return !!transport
}

let hasWarnedAdmin = false
export async function send (msg) {
  if (!transport) {
    if (!hasWarnedAdmin) {
      console.error('Failed to send an email, SMTP not configured. Message:')
      console.error(msg)
      hasWarnedAdmin = true
    }
    return
  }
  msg.from = senderAddress
  return transport.sendMail(msg)
}

export function debugGetLastEmail () {
  return interactsWithMail.lastMail()
}

function validateConfig (b, msg) {
  if (!b) {
    console.error('Config error:')
    console.error(`smtpConfig.${msg}`)
    process.exit(1)
  }
}