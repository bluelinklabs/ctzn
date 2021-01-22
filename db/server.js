import { BaseHyperbeeDB } from './base.js'
import lock from '../lib/lock.js'

export class PublicServerDB extends BaseHyperbeeDB {
  async setup () {
    await super.setup()
    this.users = this.getTable('ctzn.network/user')
    this.featuredPostsIdx = this.getTable('ctzn.network/featured-post-idx')
    this.followsIdx = this.getTable('ctzn.network/follow-idx')
    this.commentsIdx = this.getTable('ctzn.network/comment-idx')
    this.votesIdx = this.getTable('ctzn.network/vote-idx')
  }

  async onDatabaseCreated () {
    console.log('New public server database created, key:', this.key.toString('hex'))
  }

  async updateFollowsIndex (change, followerId) {
    const release = await lock('follows-idx')
    try {
      let followsIdxEntry = await this.followsIdx.get(change.value.subject.userId).catch(e => undefined)
      if (!followsIdxEntry) {
        followsIdxEntry = {
          key: change.value.subject.userId,
          value: {
            subjectId: change.value.subject.userId,
            followerIds: []
          }
        }
      }
      let followerUrlIndex = followsIdxEntry.value.followerIds.indexOf(followerId)
      if (change.type === 'put') {
        if (followerUrlIndex === -1) {
          followsIdxEntry.value.followerIds.push(followerId)
        }
      } else if (change.type === 'del') {
        if (followerUrlIndex !== -1) {
          followsIdxEntry.value.followerIds.splice(followerUrlIndex, 1)
        }
      }
      await this.followsIdx.put(followsIdxEntry.key, followsIdxEntry.value)
    } finally {
      release()
    }
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

  async updateVotesIndex (change) {
    const release = await lock('votes-idx')
    try {
      let votesIdxEntry = await this.votesIdx.get(change.value.subjectUrl).catch(e => undefined)
      if (!votesIdxEntry) {
        votesIdxEntry = {
          key: change.key,
          value: {
            subjectUrl: change.value.subjectUrl,
            upvoteUrls: [],
            downvoteUrls: []
          }
        }
      }
      let upvoteUrlIndex = votesIdxEntry.value.upvoteUrls.indexOf(change.url)
      if (upvoteUrlIndex !== -1) votesIdxEntry.value.upvoteUrls.splice(upvoteUrlIndex, 1)
      let downvoteUrlIndex = votesIdxEntry.value.downvoteUrls.indexOf(change.url)
      if (downvoteUrlIndex !== -1) votesIdxEntry.value.downvoteUrls.splice(downvoteUrlIndex, 1)

      if (change.type === 'put') {
        if (change.value.vote === 1) {
          votesIdxEntry.value.upvoteUrls.push(change.url)
        } else if (change.value.vote === -1) {
          votesIdxEntry.value.downvoteUrls.push(change.url)
        }
      }

      await this.votesIdx.put(votesIdxEntry.key, votesIdxEntry.value)
    } finally {
      release()
    }
  }
}

export class PrivateServerDB extends BaseHyperbeeDB {
  async setup () {
    await super.setup()
    this.accounts = this.getTable('ctzn.network/account')
    this.accountSessions = this.getTable('ctzn.network/account-session')
    this.userDbIdx = this.getTable('ctzn.network/user-db-idx')
  }
  
  async onDatabaseCreated () {
    console.log('New private server database created, key:', this.key.toString('hex'))
  }

  async updateUserDbIndex (change) {
    const release = await lock('user-db-idx')
    try {
      if (change.value.oldDbUrl) {
        await this.userDbIdx.del(change.value.oldDbUrl)
      }
      if (change.type === 'del') {
        await this.userDbIdx.del(change.value.dbUrl)
      } else {
        await this.userDbIdx.put(change.value.dbUrl, {
          dbUrl: change.value.dbUrl,
          userId: change.value.userId
        })
      }
    } finally {
      release()
    }
  }
}