import { LitElement, html } from '../../../vendor/lit/lit.min.js'
import { repeat } from '../../../vendor/lit/directives/repeat.js'
import { CommentComposerPopup } from '../popups/comment-composer.js'
import * as toast from '../toast.js'
import { emit } from '../../lib/dom.js'
import * as session from '../../lib/session.js'
import './post.js'
import './comment.js'
import './comment-composer.js'

export class Thread extends LitElement {
  static get properties () {
    return {
      subject: {type: Object},
      isFullPage: {type: Boolean, attribute: 'full-page'},
      setDocumentTitle: {type: Boolean, attribute: 'set-document-title'},
      post: {type: Object},
      thread: {type: Array},
      isReplying: {type: Boolean}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.subject = undefined
    this.isFullPage = false
    this.setDocumentTitle = false
    this.replyCount = 0
    this.post = undefined
    this.thread = undefined
    this.isReplying = false
    this.isLoading = false
  }

  reset () {
    this.post = undefined
    this.thread = undefined
    this.replyCount = 0
  }

  get subjectSchemaId () {
    const urlp = new URL(this.subject.dbUrl)
    const pathParts = urlp.pathname.split('/')
    return pathParts.slice(3, -1).join('/')
  }

  async load () {
    this.isLoading = true
    console.log('loading', this.subject)
    const onError = e => ({
      error: true,
      message: e.toString()
    })
    if (this.subject.dbUrl.includes('ctzn.network/comment')) {
      let comment = await session.api.getComment(this.subject.dbUrl).catch(onError)
      if (comment.error) {
        this.post = comment
      } else {
        this.post = await session.api.getPost(comment.value.reply.root.dbUrl).catch(onError)
        this.thread = await session.api.getThread(comment.value.reply.root.dbUrl).catch(onError)
      }
    } else {
      this.post = await session.api.getPost(this.subject.dbUrl).catch(onError)
      this.thread = !this.post.error ? await session.api.getThread(this.subject.dbUrl).catch(onError) : undefined
    }
    await this.updateComplete
    emit(this, 'load', {detail: {post: this.post}})
    console.log(this.post)
    console.log(this.thread)
    this.isLoading = false
  }

  updated (changedProperties) {
    if (typeof this.post === 'undefined' && !this.isLoading) {
      this.load()
    } else if (changedProperties.has('subject') && changedProperties.get('subject') != this.subject) {
      this.load()
    }
  }

  async scrollHighlightedPostIntoView () {
    try {
      await this.requestUpdate()
      const el = this.querySelector('.highlight')
      let y = window.pageYOffset + el.getBoundingClientRect().top - 50
      window.scrollTo(0, y)
    } catch (e) { /* ignore */ }
  }

  // rendering
  // =

  render () {
    return html`
      <div class="post-container mb-1 sm:pl-1 sm:pr-3">
        ${this.post ? html`
          <app-post
            mode="expanded"
            .post=${this.post}
            .renderOpts=${{noclick: true}}
          ></app-post>
        ` : html`
          <span class="spinner"></span>
        `}
      </div>
      <hr class="mb-4">
      ${this.post ? this.renderCommentBox() : ''}
      ${this.thread?.length ? html`
        <div class="comments-thread-container px-1 py-2 sm:px-3 sm:py-3">
          ${this.renderReplies(this.thread)}
        </div>
      ` : ''}
    `
  }

  renderReplies (replies) {
    if (replies?.error) {
      if (this.post?.error) {
        return ''
      }
      return html`
        <div class="comments-container pl-3 py-2">
          <div class="font-semibold text-gray-500">
            <span class="fas fa-fw fa-exclamation-circle"></span>
            Failed to load thread
          </div>
          ${replies.message ? html`
            <div class="pl-6 text-sm text-gray-400">
              ${replies.message}
            </div>
          ` : ''}
        </div>
      `
    }
    if (!replies?.length) return ''
    return html`
      <div class="comments-container pl-3">
        ${repeat(replies, r => r.dbUrl, reply => {
          const isSubject = this.subject.dbUrl === reply.dbUrl
          return html`
            <div
              class="comment-container mb-1 ${isSubject ? 'highlight px-2' : ''}"
              style="${isSubject ? 'margin-left: -14px' : ''}"
            >
              <app-comment
                .comment=${reply}
                .renderOpts=${{noclick: true}}
                mode="as-reply"
                @publish-reply=${this.onPublishReply}
                @delete-comment=${this.onDeleteComment}
              ></app-comment>
            </div>
            ${reply.replies?.length ? this.renderReplies(reply.replies) : ''}
          `
        })}
      </div>
    `
  }

  renderCommentBox () {
    if (this.post?.error) {
      return ''
    }
    return html`
      <div class="px-3 mb-2">
        ${this.isReplying ? html`
          <div class="comment-composer-wrapper">
            <app-comment-composer
              autofocus
              class="block p-2"
              .subject=${{dbUrl: this.post.dbUrl}}
              placeholder="Write your comment. Remember to always be kind!"
              @publish=${this.onPublishReply}
              @cancel=${this.onCancelReply}
            ></app-comment-composer>
          </div>
        ` : html`
          <div class="comment-composer-placeholder cursor-text px-4 py-2" @click=${this.onStartReply}>
            Write your comment
          </div>
        `}
      </div>
    `
  }

  // events
  // =

  async onStartReply (e) {
    if (matchMedia('(max-width: 1150px)').matches) {
      await CommentComposerPopup.create({post: this.post})
      toast.create('Reply published', '', 10e3)
      this.load()
    } else {
      this.isReplying = true
    }
  }

  onPublishReply (e) {
    toast.create('Reply published', '', 10e3)
    this.load()
    this.isReplying = false
  }

  onCancelReply (e) {
    this.isReplying = false
  }

  async onDeleteComment (e) {
    try {
      await session.api.user.table('ctzn.network/comment').delete(e.detail.comment.key)
      toast.create('Comment deleted')
      this.load()
    } catch (e) {
      console.log(e)
      toast.create(e.toString(), 'error')
    }
  }
}

customElements.define('app-thread', Thread)