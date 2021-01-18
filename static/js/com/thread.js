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
      postUrl: {type: String, attribute: 'post-url'},
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
    this.postUrl = ''
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

  async load () {
    this.isLoading = true
    this.reset()
    try {
      this.post = await this.api.posts.get(this.postUrl)
      this.thread = await this.api.comments.getThread(this.postUrl)
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
    } else if (changedProperties.has('postUrl') && changedProperties.get('postUrl') != this.postUrl) {
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
      <div class="subject">
        ${this.post ? html`
          <ctzn-post
            .api=${this.api}
            .post=${this.post}
            .profile=${this.profile}
            noborders
            view-content-on-click
            @publish-reply=${this.onPublishReply}
          ></ctzn-post>
        ` : html`
          <span class="spinner"></span>
        `}
      </div>
      ${this.thread ? html`
        <div class="comments">
          <div class="comments-header">
            <div>
              <strong>Comments (${this.commentCount})</strong>
            </div>
            ${this.isCommenting ? html`
              <ctzn-composer
                .api=${this.api}
                subject-url=${this.post.url}
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
          return html`
            <ctzn-post
              class=${/*TODO this.recordUrl === reply.url ? 'highlight' : ''*/''}
              .api=${this.api}
              .post=${reply}
              .profile=${this.profile}
              thread-view
              @publish-reply=${this.onPublishReply}
            ></ctzn-post>
            ${reply.replies?.length ? this.renderReplies(reply.replies) : ''}
          `
        })}
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