import { BaseHyperbeeDB } from './base.js'
import lock from '../lib/lock.js'

export class PublicServerDB extends BaseHyperbeeDB {
  async setup () {
    await super.setup()
    this.users = await this.getTable('https://ctzn.network/user.json')
    this.featuredPostsIdx = await this.getTable('https://ctzn.network/featured-post-idx.json')
    this.commentsIdx = await this.getTable('https://ctzn.network/comment-idx.json')
    this.votesIdx = await this.getTable('https://ctzn.network/vote-idx.json')
  }

  async onDatabaseCreated () {
    console.log('New public server database created, key:', this.key.toString('hex'))
  }

  async updateCommentsIndex (change) {
    const release = await lock('comments-idx')
    try {
      let commentsIdxEntry = await this.commentsIdx.get(change.value.subjectUrl).catch(e => undefined)
      if (!commentsIdxEntry) {
        commentsIdxEntry = {
          key: change.value.subjectUrl,
          value: {
            subjectUrl: change.value.subjectUrl,
            commentUrls: []
          }
        }
      }
      let commentUrlIndex = commentsIdxEntry.value.commentUrls.indexOf(change.url)
      if (change.type === 'put') {
        if (commentUrlIndex === -1) {
          commentsIdxEntry.value.commentUrls.push(change.url)
        }
      } else if (change.type === 'del') {
        if (commentUrlIndex !== -1) {
          commentsIdxEntry.value.commentUrls.splice(commentUrlIndex, 1)
        }
      }
      await this.commentsIdx.put(commentsIdxEntry.key, commentsIdxEntry.value)
    } finally {
      release()
    }
  }
}

export class PrivateServerDB extends BaseHyperbeeDB {
  async setup () {
    await super.setup()
    this.accounts = await this.getTable('https://ctzn.network/account.json')
  }
  
  async onDatabaseCreated () {
    console.log('New private server database created, key:', this.key.toString('hex'))
  }
}