/* globals beaker */
import { html } from '../../../vendor/lit/lit.min.js'
import { BasePopup } from './base.js'
import '../button.js'
import '../content/post-composer.js'
import '../content/post.js'

// exported api
// =

export class CommentComposerPopup extends BasePopup {
  static get properties () {
    return {
    }
  }

  constructor (opts) {
    super()
    this.post = opts.post
    this.comment = opts.comment
  }

  get shouldShowHead () {
    return false
  }

  get shouldCloseOnOuterClick () {
    return false
  }

  get maxWidth () {
    return '700px'
  }

  // management
  //

  static async create (opts) {
    return BasePopup.create(CommentComposerPopup, opts)
  }

  static destroy () {
    return BasePopup.destroy('comment-composer-popup')
  }

  // rendering
  // =

  renderBody () {
    const subject = this.comment || this.post
    return html`
      <div>
        Reply to:
      </div>
      <div class="border border-gray-300 px-3 py-2 rounded mb-2">
        <app-post
          .post=${subject}
          mode="content-only"
          .renderOpts=${{noclick: true}}
        ></app-post>
      </div>
      <app-comment-composer
        autofocus
        modal-mode
        .subject=${this.comment ? this.comment.value.reply.root : ({dbUrl: this.post.dbUrl})}
        .parent=${this.comment ? ({dbUrl: this.comment.dbUrl}) : undefined}
        placeholder="Write your comment"
        @publish=${this.onPublishComment}
        @cancel=${this.onReject}
      ></app-comment-composer>
    `
  }

  // events
  // =

  onPublishComment (e) {
    this.dispatchEvent(new CustomEvent('resolve', {detail: e.detail}))
  }
}

customElements.define('comment-composer-popup', CommentComposerPopup)