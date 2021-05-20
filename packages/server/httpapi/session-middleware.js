import { v4 as uuidv4 } from 'uuid'
import { privateServerDb } from '../db/index.js'

export function setup () {
  return async (req, res, next) => {
    let auth = undefined
    if (req.cookies.session) {
      const sessionRecord = await privateServerDb.accountSessions.get(req.cookies.session).catch(e => undefined)
      if (sessionRecord) {
        auth = {
          sessionId: sessionRecord.value.sessionId,
          username: sessionRecord.value.username,
          dbKey: sessionRecord.value.dbKey
        }
      }
    }
    req.session = {
      auth,
      async create ({username, dbKey}) {
        const sess = {
          sessionId: uuidv4(),
          username,
          dbKey,
          createdAt: (new Date()).toISOString()
        }
        await privateServerDb.accountSessions.put(sess.sessionId, sess)
        req.session.auth = {
          sessionId: sess.sessionId,
          username,
          dbKey
        }
        res.cookie('session', sess.sessionId, {
          httpOnly: true,
          sameSite: 'Strict'
        })
      },
      async destroy () {
        if (req.cookies.session) {
          await privateServerDb.accountSessions.del(req.cookies.session)
          res.clearCookie('session')
          req.session.auth = undefined
        }
      }
    }
    next()
  }
}
