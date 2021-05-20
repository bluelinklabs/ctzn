import { v4 as uuidv4 } from 'uuid'
import { privateServerDb } from '../db/index.js'

export function setup () {
  return async (req, res, next) => {
    let auth = undefined
    if (req.cookies.session) {
      const sessionRecord = await privateServerDb.accountSessions.get(req.cookies.session).catch(e => undefined)
      if (sessionRecord) {
        auth = {
          username: sessionRecord.value.username,
          sessionId: sessionRecord.value.sessionId,
          dbUrl: sessionRecord.value.dbUrl
        }
      }
    }
    req.session = {
      auth,
      async create ({username, dbUrl}) {
        const sess = {
          sessionId: uuidv4(),
          username,
          dbUrl,
          createdAt: (new Date()).toISOString()
        }
        await privateServerDb.accountSessions.put(sess.sessionId, sess)
        req.session.auth = {
          username,
          dbUrl
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
