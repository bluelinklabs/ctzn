import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { asyncReplace } from '../../vendor/lit-element/lit-html/directives/async-replace.js'
import { unsafeHTML } from '../../vendor/lit-element/lit-html/directives/unsafe-html.js'
import { repeat } from '../../vendor/lit-element/lit-html/directives/repeat.js'
import css from '../../css/com/thread.css.js'
import { emit } from '../lib/dom.js'
import { fancyUrlAsync } from '../lib/strings.js'
import * as toast from './toast.js'
// import { getRecordType } from '../records.js'
import './post.js'
import './composer.js'

export class Thread extends LitElement {
  static get properties () {
    return {
      api: {type: Object},
      subjectUrl: {type: String, attribute: 'subject-url'},
      profile: {type: Object},
      isFullPage: {type: Boolean, attribute: 'full-page'},
      setDocumentTitle: {type: Boolean, attribute: 'set-document-title'},
      post: {type: Object},
      thread: {type: Array},
      isCommenting: {type: Boolean}
    }
  }

  static get styles () {
    return css
  }

  constructor () {
    super()
    this.subjectUrl = ''
    this.isFullPage = false
    this.setDocumentTitle = false
    this.commentCount = 0
    this.post = undefined
    this.thread = undefined
    this.profile = undefined
    this.isCommenting = false
    this.isLoading = false
  }

  reset () {
    this.post = undefined
    this.thread = undefined
    this.commentCount = 0
  }

  get subjectSchemaUrl () {
    const urlp = new URL(this.subjectUrl)
    const pathParts = urlp.pathname.split('/')
    return `https://${pathParts.slice(3, -1).join('/')}.json`
  }

  async load () {
    this.isLoading = true
    // this.reset() TODO causes a flash of the loading spinner, needed?
    console.log('loading', this.subjectUrl)
    try {
      if (this.subjectSchemaUrl === 'https://ctzn.network/post.json') {
        this.post = await this.api.posts.get(this.subjectUrl)
        this.thread = await this.api.comments.getThread(this.subjectUrl)
      } else if (this.subjectSchemaUrl === 'https://ctzn.network/comment.json') {
        let comment = await this.api.comments.get(this.subjectUrl)
        this.post = await this.api.posts.get(comment.value.subjectUrl)
        this.thread = await this.api.comments.getThread(comment.value.subjectUrl)
      }
    } catch (e) {
      toast.create(e.message, 'error')
      console.error(e)
    }
    console.log(this.post)
    console.log(this.thread)
    this.isLoading = false
  }

  updated (changedProperties) {
    if (typeof this.post === 'undefined' && !this.isLoading) {
      this.load()
    } else if (changedProperties.has('subjectUrl') && changedProperties.get('subjectUrl') != this.subjectUrl) {
      this.load()
    }
  }

  scrollHighlightedPostIntoView () {
    try {
      this.shadowRoot.querySelector('.highlight').scrollIntoView()
    } catch {}
  }

  // rendering
  // =

  render () {
    return html`
      <div class="item ${this.subjectUrl === this.post?.url ? 'highlight' : ''}">
        ${this.post ? html`
          <ctzn-post
            .api=${this.api}
            .post=${this.post}
            .profile=${this.profile}
            noborders
            view-content-on-click
            @publish-reply=${this.onPublishReply}
          ></ctzn-post>
          ${this.subjectUrl === this.post?.url ? this.renderCommentBox() : ''}
        ` : html`
          <span class="spinner"></span>
        `}
      </div>
      ${this.thread ? html`
        <div class="comments">
          ${this.renderReplies(this.thread)}
        </div>
      ` : ''}
    `
  }

  renderReplies (replies) {
    if (!replies?.length) return ''
    return html`
      <div class="replies">
        ${repeat(replies, r => r.url, reply => {
          const isSubject = this.subjectUrl === reply.url
          return html`
          <div class="item ${isSubject ? 'highlight' : ''}">
              <ctzn-post
                .api=${this.api}
                .post=${reply}
                .profile=${this.profile}
                noborders
                thread-view
                @publish-reply=${this.onPublishReply}
              ></ctzn-post>
              ${isSubject ? this.renderCommentBox() : ''}
            </div>
            ${reply.replies?.length ? this.renderReplies(reply.replies) : ''}
          `
        })}
      </div>
    `
  }

  renderCommentBox () {
    return html`
      <div class="comment-box">
        ${this.isCommenting ? html`
          <ctzn-composer
            .api=${this.api}
            subject-url=${this.post.url}
            parent-url=${this.subjectUrl}
            placeholder="Write your comment"
            @publish=${this.onPublishComment}
            @cancel=${this.onCancelComment}
          ></ctzn-composer>
        ` : html`
          <div class="comment-prompt" @click=${this.onStartComment}>
            Write your comment
          </div>
        `}
      </div>
    `
  }

  // events
  // =

  onStartComment (e) {
    this.isCommenting = true
  }

  onPublishComment (e) {
    toast.create('Comment published', '', 10e3)
    console.log(1)
    this.load()
    this.isCommenting = false
  }

  onCancelComment (e) {
    this.isCommenting = false
  }
  
  onPublishReply (e) {
    toast.create('Reply published', '', 10e3)
    this.load()
  }
}

customElements.define('ctzn-thread', Thread)