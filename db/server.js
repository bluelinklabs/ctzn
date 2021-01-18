import { BaseHyperbeeDB } from './base.js'
import lock from '../lib/lock.js'

export class PublicServerDB extends BaseHyperbeeDB {
  async setup () {
    await super.setup()
    this.users = await this.getTable('https://ctzn.network/user.json')
    this.featuredPostsIdx = await this.getTable('https://ctzn.network/featured-post-idx.json')
    this.followsIdx = await this.getTable('https://ctzn.network/follow-idx.json')
    this.commentsIdx = await this.getTable('https://ctzn.network/comment-idx.json')
    this.votesIdx = await this.getTable('https://ctzn.network/vote-idx.json')
  }

  async onDatabaseCreated () {
    console.log('New public server database created, key:', this.key.toString('hex'))
  }

  async updateFollowsIndex (change, followerUrl) {
    const release = await lock('follows-idx')
    try {
      let followsIdxEntry = await this.followsIdx.get(change.value.subjectUrl).catch(e => undefined)
      if (!followsIdxEntry) {
        followsIdxEntry = {
          key: change.value.subjectUrl,
          value: {
            userUrl: change.value.subjectUrl,
            followerUrls: []
          }
        }
      }
      let followerUrlIndex = followsIdxEntry.value.followerUrls.indexOf(followerUrl)
      if (change.type === 'put') {
        if (followerUrlIndex === -1) {
          followsIdxEntry.value.followerUrls.push(followerUrl)
        }
      } else if (change.type === 'del') {
        if (followerUrlIndex !== -1) {
          followsIdxEntry.value.followerUrls.splice(followerUrlIndex, 1)
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
    this.accounts = await this.getTable('https://ctzn.network/account.json')
  }
  
  async onDatabaseCreated () {
    console.log('New private server database created, key:', this.key.toString('hex'))
  }
}