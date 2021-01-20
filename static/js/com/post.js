import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { classMap } from '../../vendor/lit-element/lit-html/directives/class-map.js'
// import { SitesListPopup } from './popups/sites-list.js'
import css from '../../css/com/post.css.js'
import { emit } from '../lib/dom.js'
import * as toast from './toast.js'
import './composer.js'


export class Post extends LitElement {
  static get properties () {
    return {
      api: {type: Object},
      post: {type: Object},
      profile: {type: Object},
      isNotification: {type: Boolean, attribute: 'is-notification'},
      isUnread: {type: Boolean, attribute: 'is-unread'},
      searchTerms: {type: String, attribute: 'search-terms'},
      showContext: {type: Boolean, attribute: 'show-context'},
      isReplyOpen: {type: Boolean},
      viewContentOnClick: {type: Boolean, attribute: 'view-content-on-click'}
    }
  }

  static get styles () {
    return css
  }

  constructor () {
    super()
    this.api = undefined
    this.post = undefined
    this.profile = undefined
    this.isNotification = false
    this.isUnread = false
    this.searchTerms = undefined
    this.showContext = false
    this.isReplyOpen = false
    this.viewContentOnClick = false

    // helper state
    this.isMouseDown = false
    this.isMouseDragging = false
  }

  get myVote () {
    if (this.post?.votes.upvoterUrls.includes(this.profile?.url)) {
      return 1
    }
    if (this.post?.votes.downvoterUrls.includes(this.profile?.url)) {
      return -1
    }
  }

  get upvoteCount () {
    return this.post?.votes.upvoterUrls.length
  }

  get downvoteCount () {
    return this.post?.votes.downvoterUrls.length
  }

  get commentCount () {
    if (typeof this.post?.commentCount !== 'undefined') {
      return this.post.commentCount
    }
    if (typeof this.post?.replies !== 'undefined') {
      return this.post.replies.length
    }
    return 0
  }

  async reloadSignals () {
    this.post.votes = await this.api.votes.getVotesForSubject(this.post.url)
    this.requestUpdate()
  }

  // rendering
  // =

  render () {
    if (!this.post) {
      return html``
    }

    var context = undefined
    // TODO
    // switch (rtype) {
    //   case 'comment':
    //     context = this.post.metadata['comment/parent'] || this.post.metadata['comment/subject']
    //     break
    // }

    return html`
      <link rel="stylesheet" href=${(new URL('../../css/fontawesome.css', import.meta.url)).toString()}>
      ${this.isNotification ? this.renderNotification() : ''}
      ${this.showContext && context ? html`
        <div class="card-context">
          <ctzn-post
            post-url=${context}
            noborders
            nothumb
            as-context
            profile-url=${this.profileUrl}
          ></ctzn-post>
        </div>
      ` : ''}
      <div
        class=${classMap({
          post: true,
          card: true,
          'is-notification': this.isNotification,
          unread: this.isUnread
        })}
      >
        <a class="thumb" href=${this.post.author.url} title=${this.post.author.displayName} data-tooltip=${this.post.author.displayName}>
          <img class="favicon" src="/img/default-user-thumb.jpg">
        </a>
        <span class="arrow"></span>
        <div
          class="container"
          @mousedown=${this.onMousedownCard}
          @mouseup=${this.onMouseupCard}
          @mousemove=${this.onMousemoveCard}
        >
          <div class="header">
            <div class="origin">
              <a class="author displayname" href=${this.post.author.url} title=${this.post.author.displayName}>
                ${this.post.author.displayName}
              </a>
              <a class="author username" href=${this.post.author.url} title=${this.post.author.username}>
                @${this.post.author.username}
              </a>
            </div>
            <span>&middot;</span>
            <div class="date">
              <a href=${this.post.url} data-tooltip=${(new Date(this.post.value.createdAt)).toLocaleString()}>
                ${relativeDate(this.post.value.createdAt)}
              </a>
            </div>
          </div>
          <div class="content markdown">
            ${this.post.value.text ? (this.renderMatchText() || this.post.value.text) : ''}
          </div>
          <div class="ctrls">
            ${this.renderVoteCtrl()}
            ${this.renderCommentsCtrl()}
          </div>
        </div>
      </div>
    `
  }

  // TODO
  // renderAsComment () {
  //   const res = this.record

  //   var context = undefined
  //   switch (getRecordType(res)) {
  //     case 'comment':
  //       context = res.metadata['comment/subject'] || res.metadata['comment/parent']
  //       break
  //   }

  //   return html`
  //     <link rel="stylesheet" href=${(new URL('../../css/fontawesome.css', import.meta.url)).toString()}>
  //     ${this.isNotification ? this.renderNotification() : ''}
  //     <div
  //       class=${classMap({
  //         record: true,
  //         comment: true,
  //         'private': res.url.startsWith('hyper://private'),
  //         'constrain-height': this.constrainHeight,
  //         'is-notification': this.isNotification,
  //         unread: this.isUnread
  //       })}
  //     >
  //       <div class="header">
  //         <a class="thumb" href=${res.site.url} title=${res.site.title} data-tooltip=${res.site.title}>
  //           <img class="favicon" src="${res.site.url}/thumb">
  //         </a>
  //         <div class="origin">
  //           ${res.url.startsWith('hyper://private/') ? html`
  //             <a class="author" href=${res.site.url} title=${res.site.title}>Private comment</a>
  //           ` : html`
  //             <a class="author" href=${res.site.url} title=${res.site.title}>
  //               ${res.site.title}
  //             </a>
  //           `}
  //         </div>
  //         ${this.actionTarget ? html`
  //           <span class="action">mentioned ${this.actionTarget}</span>
  //         ` : ''}
  //         <div class="date">
  //           <a href=${res.url} data-tooltip=${(new Date(res.ctime)).toLocaleString()}>
  //             ${relativeDate(res.ctime)}
  //           </a>
  //         </div>
  //         ${this.showContext && context ? html`
  //           <span>&middot;</span>
  //           <div class="context">
  //             <a href=${context}>
  //               ${asyncReplace(fancyUrlAsync(context))}
  //             </a>
  //           </div>
  //         ` : ''}
  //       </div>
  //       <div class="content markdown">
  //         ${this.renderMatchText('content') || unsafeHTML(beaker.markdown.toHTML(res.content))}
  //       </div>
  //       ${this.showReadMore ? html`
  //         <div class="read-more">
  //           <a @click=${this.onClickReadMore}>Read more <span class="fas fa-angle-down"></span></a>
  //         </div>
  //       ` : ''}
  //       <div class="ctrls">
  //         ${this.renderVoteCtrl()}
  //         <a class="reply" @click=${this.onClickReply}><span class="fas fa-fw fa-reply"></span> <small>Reply</small></a>
  //         ${this.renderTagsCtrl()}
  //       </div>
  //       ${this.isReplyOpen ? html`
  //         <ctzn-composer
  //           subject=${this.record.metadata['comment/subject'] || this.record.url}
  //           parent=${this.record.url}
  //           placeholder="Write your comment"
  //           @publish=${this.onPublishReply}
  //           @cancel=${this.onCancelReply}
  //         ></ctzn-composer>
  //       ` : ''}
  //     </div>
  //   `
  // }

  renderVoteCtrl () {
    var myVote = this.myVote
    return html`
      <span class="vote-ctrl">
        <a class="up ${myVote === 1 ? 'pressed' : ''}" data-tooltip="Upvote" @click=${e => this.onToggleVote(e, 1)}>
          <span class="far fa-thumbs-up"></span>
          <span class="count">${this.upvoteCount}</span>
        </a>
        <a class="down ${myVote === -1 ? 'pressed' : ''}" data-tooltip="Downvote" @click=${e => this.onToggleVote(e, -1)}>
          <span class="far fa-thumbs-down"></span>
          <span class="count">${this.downvoteCount}</span>
        </a>
      </span>
    `
  }

  renderCommentsCtrl () {
    return html`
      <a class="comment-ctrl" @click=${this.onViewThread}>
        <span class="far fa-comment"></span>
        ${this.commentCount}
      </a>
    `
  }

  renderMatchText () {
    if (!this.searchTerms) return undefined
    let v = this.post.value.text
    if (!v) return undefined
    let re = new RegExp(`(${this.searchTerms.replace(/([\s]+)/g, '|')})`, 'gi')
    let text = v.replace(re, match => `<b>${match}</b>`)
    return text // TODO unsafeHTML
  }

  renderNotification () {
    return ''
    // TODO
    // const res = this.record
    // const link = res.links.find(l => l.url.startsWith(this.profileUrl))
    // var type = getRecordType(res)
    // var description = 'linked to'
    // var afterdesc = ''
    // if (type === 'vote') {
    //   if (res.metadata['vote/value'] == '1') {
    //     description = 'upvoted'
    //   } else if (res.metadata['vote/value'] == '-1') {
    //     description = 'downvoted'
    //   }
    // } else if (type === 'tag') {
    //   let tag = res.metadata['tag/id']
    //   if (tag) {
    //     description = 'tagged'
    //     afterdesc = html`
    //       as <strong><a @click=${e => this.onViewTag(e, tag)}>#${tag}</a></strong>
    //     `
    //   }
    // } else if (link.source === 'content') {
    //   if (type === 'microblogpost' || type === 'comment') {
    //     description = 'mentioned'
    //   }
    // } else if (link.source === 'metadata:href') {
    //   if (type === 'bookmark') {
    //     description = 'bookmarked'
    //   } else if (type === 'subscription') {
    //     description = 'subscribed to'
    //   }
    // } else if (link.source === 'metadata:comment/subject') {
    //   description = 'commented on'
    // } else if (link.source === 'metadata:comment/parent') {
    //   description = 'replied to'
    // }
    // var where = ({
    //   'page': 'in',
    //   'blogpost': 'in'
    // })[type] || ''
    // return html`
    //   <div class="notification">
    //     ${res.site.title}
    //     ${description}
    //     <a href=${link.url}>
    //       ${asyncReplace(getNotificationSubjectStream(link.url, this.profileUrl))}
    //     </a>
    //     ${where}
    //     ${afterdesc}
    //   </div>
    // `
  }

  // events
  // =

  onClickReply (e) {
    e.preventDefault()
    this.isReplyOpen = true
  }

  onPublishReply (e) {
    e.preventDefault()
    e.stopPropagation()
    this.isReplyOpen = false
    emit(this, 'publish-reply')
  }

  onCancelReply (e) {
    this.isReplyOpen = false
  }

  onViewThread (e, record) {
    if (!this.viewContentOnClick && e.button === 0 && !e.metaKey && !e.ctrlKey) {
      e.preventDefault()
      e.stopPropagation()
      emit(this, 'view-thread', {detail: {subject: this.post}})
    }
  }

  onMousedownCard (e) {
    for (let el of e.path) {
      if (el.tagName === 'A' || el.tagName === 'CTZN-composer') return
    }
    this.isMouseDown = true
    this.isMouseDragging = false
  }

  onMousemoveCard (e) {
    if (this.isMouseDown) {
      this.isMouseDragging = true
    }
  }

  onMouseupCard (e) {
    if (!this.isMouseDown) return
    if (!this.isMouseDragging) {
      e.preventDefault()
      e.stopPropagation()
      emit(this, 'view-thread', {detail: {subject: this.post}})
    }
    this.isMouseDown = false
    this.isMouseDragging = false
  }

  onClickShowSites (e, results) {
    e.preventDefault()
    // TODO
    // SitesListPopup.create('Subscribed Sites', results.map(r => ({
    //   url: r.metadata.href,
    //   title: r.metadata.title || 'Untitled'
    // })))
  }

  async onToggleVote (e, value) {
    if (this.myVote && this.myVote === value) {
      await this.api.votes.del(this.post.url)
    } else {
      try {
        await this.api.votes.put({
          subjectUrl: this.post.url, 
          vote: value
        })
      } catch (e) {
        toast.create(e.message, 'error')
        console.error(e)
        return
      }
    }
    this.reloadSignals()
  }
}

customElements.define('ctzn-post', Post)

var _notificationSubjectCache = {}
async function getNotificationSubject (url) {
  if (_notificationSubjectCache[url]) {
    return _notificationSubjectCache[url]
  }
  try {
    let {record} = await beaker.index.gql(`
      query Post($url: String!) {
        record (url: $url) {
          path
          metadata
        }
      }
    `, {url})
    if (record.metadata.title) {
      return `"${record.metadata.title}"`
    }
    switch (getRecordType(record)) {
      case 'comment': return 'your comment'
      case 'page': return 'your page'
      case 'blogpost': return 'your blog post'
      case 'microblogpost': return 'your post'
    }
  } catch {}
  return 'your page'
}

async function* getNotificationSubjectStream (url, profileUrl) {
  if (isRootUrl(url)) {
    if (url === profileUrl) {
      yield 'you'
    } else {
      yield 'your site'
    }
  } else {
    yield await getNotificationSubject(url)
  }
}

function isRootUrl (url) {
  try {
    return (new URL(url)).pathname === '/'
  } catch {
    return false
  }
}

const MINUTE = 1e3 * 60
const HOUR = 1e3 * 60 * 60
const DAY = HOUR * 24

const rtf = new Intl.RelativeTimeFormat('en', {numeric: 'auto'})
function relativeDate (d) {
  const nowMs = Date.now()
  const endOfTodayMs = +((new Date).setHours(23,59,59,999))
  const dMs = +(new Date(d))
  let diff = nowMs - dMs
  let dayDiff = Math.floor((endOfTodayMs - dMs) / DAY)
  if (diff < (MINUTE * 5)) return 'just now'
  if (diff < HOUR) return rtf.format(Math.ceil(diff / MINUTE * -1), 'minute')
  if (dayDiff < 1) return rtf.format(Math.ceil(diff / HOUR * -1), 'hour')
  if (dayDiff <= 30) return rtf.format(dayDiff * -1, 'day')
  if (dayDiff <= 365) return rtf.format(Math.floor(dayDiff / 30) * -1, 'month')
  return rtf.format(Math.floor(dayDiff / 365) * -1, 'year')
}