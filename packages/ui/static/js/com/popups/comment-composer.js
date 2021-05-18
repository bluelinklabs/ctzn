/* globals beaker */
import { html } from '../../../vendor/lit/lit.min.js'
import { BasePopup } from './base.js'
import '../button.js'
import '../post-composer.js'
import '../../ctzn-tags/post-view.js'

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
        <ctzn-post-view
          .post=${subject}
          mode="content-only"
          .renderOpts=${{noclick: true}}
        ></ctzn-post-view>
      </div>
      <app-comment-composer
        autofocus
        modal-mode
        .community=${subject.value.community}
        .subject=${this.comment ? this.comment.value.reply.root : ({dbUrl: this.post.url, authorId: this.post.author.userId})}
        .parent=${this.comment ? ({dbUrl: this.comment.url, authorId: this.comment.author.userId}) : undefined}
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