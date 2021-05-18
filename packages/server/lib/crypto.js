import crypto from 'crypto'

export async function hashPassword (password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(8).toString('hex')
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err)
      resolve(salt + ':' + derivedKey.toString('hex'))
    })
  })
}

export async function verifyPassword (password, hash) {
  return new Promise((resolve, reject) => {
    const [salt, key] = hash.split(':')
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err)
      resolve(key == derivedKey.toString('hex'))
    })
  })
}

export function generateRecoveryCode () {
  let code = String(crypto.randomBytes(4).readUInt32BE())
  while (code.length < 10) {
    code = '0' + code
  }
  return `${code.slice(0, 3)}-${code.slice(3, 7)}-${code.slice(7)}`
}