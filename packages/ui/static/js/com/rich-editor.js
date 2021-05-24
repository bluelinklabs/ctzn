import { LitElement, html } from '../../vendor/lit/lit.min.js'

import * as postView from '../ctzn-tags-editor/post-view.js'
import * as postsFeed from '../ctzn-tags-editor/posts-feed.js'
import * as commentView from '../ctzn-tags-editor/comment-view.js'
import * as commentsFeed from '../ctzn-tags-editor/comments-feed.js'
import * as followersList from '../ctzn-tags-editor/followers-list.js'
import * as followingList from '../ctzn-tags-editor/following-list.js'
import * as iframe from '../ctzn-tags-editor/iframe.js'
import * as code from '../ctzn-tags-editor/code.js'
import * as card from '../ctzn-tags-editor/card.js'

const POST_TAGS = [
  postView,
  commentView,
  iframe,
  code,
  card
]
const PROFILE_TAGS = [
  postView,
  postsFeed,
  commentView,
  commentsFeed,
  followersList,
  followingList,
  iframe,
  code,
  card
]
const PAGE_TAGS = PROFILE_TAGS

export class RichEditor extends LitElement {
  static get properties () {
    return {
      context: {type: String},
      editorHeight: {type: String, attribute: 'editor-height'},
      isLoading: {type: Boolean}
    }
  }
  
  createRenderRoot() {
    return this // dont use shadow dom
  }
  
  constructor () {
    super()
    this.id = 'tinymce-editor-' + Date.now()
    this.initialValue = ''
    this.context = ''
    this.editorHeight = '400px'
    this.isLoading = true
  }

  get supportedTags () {
    if (this.context === 'post') {
      return POST_TAGS
    }
    if (this.context === 'profile') {
      return PROFILE_TAGS
    }
    if (this.context === 'page') {
      return PAGE_TAGS
    }
    return []
  }

  get editorToolbar () {
    if (this.context === 'post') {
      return 'undo redo | formatselect | bold italic underline strikethrough | link | post-embeds | bullist numlist | ctzn-code | table | removeformat | code'
    }
    if (this.context === 'profile' || this.context === 'page') {
      return 'undo redo | formatselect | bold italic underline strikethrough | link | content-widgets user-widgets | bullist numlist | ctzn-code | table | removeformat | code'
    }
  }

  get editorContentStyle () {
    return `
      body {
        margin: 0.6rem 0.7rem;
        background: #FFF;
      }
      h1,
      h2,
      h3,
      h4,
      h5,
      h6,
      p,
      ul,
      ol,
      table,
      blockquote,
      figcaption,
      dl {
        margin: 0 0 0.75rem;
      }
      h1 {
        font-size: 1.2rem;
        line-height: 1.75rem;
        font-weight: 700;
      }
      h2 {
        font-size: 1.15rem;
        line-height: 1.6rem;
        font-weight: 700;
      }
      h3 {
        font-size: 1.1rem;
        line-height: 1.5rem;
        font-weight: 700;
      }
      h4 {
        font-size: 1.05rem;
        line-height: 1.4rem;
        font-weight: 600;
      }
      h5 {
        font-size: 1.0rem;
        line-height: 1.4rem;
        font-weight: 600;
      }
      h6 {
        font-size: 1.0rem;
        line-height: 1.4rem;
        font-weight: 500;
      }
      *[ctzn-elem="1"] {
        display: block;
        margin-bottom: 0.25rem;
      }
      *[ctzn-elem="1"] + *:not([ctzn-elem="1"]) {
        margin-top: 0.75rem;
      }
    `
  }
  
  async connectedCallback () {
    super.connectedCallback()
    await loadTinyMCEAsNeeded()
    await this.requestUpdate()
    tinymce.init({
      target: this.querySelector('.editor'),
      placeholder: this.getAttribute('placeholder') || '',
      content_style: this.editorContentStyle,
      height: this.editorHeight,
      menubar: false,
      plugins: [
        'advlist autolink lists link image charmap',
        'visualblocks code fullscreen',
        'media table paste code noneditable'
      ],
      toolbar: this.editorToolbar,
      statusbar: false,
      formats: {
        strikethrough: { inline: 'del' }
      },
      
      custom_elements: this.supportedTags.map(t => t.name).join(','),
      extended_valid_elements: this.supportedTags.map(t => t.validElements).filter(Boolean).join(','),
      valid_children: 'ctzn-code[pre,#text]',
      convert_urls: false,

      setup: (editor) => {
        this.isLoading = false
        editor.ui.registry.addIcon('user-widgets', '<svg width="20" height="20" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="user-friends" class="svg-inline--fa fa-user-friends fa-w-20" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512"><path fill="currentColor" d="M192 256c61.9 0 112-50.1 112-112S253.9 32 192 32 80 82.1 80 144s50.1 112 112 112zm76.8 32h-8.3c-20.8 10-43.9 16-68.5 16s-47.6-6-68.5-16h-8.3C51.6 288 0 339.6 0 403.2V432c0 26.5 21.5 48 48 48h288c26.5 0 48-21.5 48-48v-28.8c0-63.6-51.6-115.2-115.2-115.2zM480 256c53 0 96-43 96-96s-43-96-96-96-96 43-96 96 43 96 96 96zm48 32h-3.8c-13.9 4.8-28.6 8-44.2 8s-30.3-3.2-44.2-8H432c-20.4 0-39.2 5.9-55.7 15.4 24.4 26.3 39.7 61.2 39.7 99.8v38.4c0 2.2-.5 4.3-.6 6.4H592c26.5 0 48-21.5 48-48 0-61.9-50.1-112-112-112z"></path></svg>')
        editor.on('PreInit', () => {
          const win = editor.getWin()
          const doc = editor.getDoc()
          
          for (let tag of this.supportedTags) {
            tag.setup(win, doc, editor)
            editor.serializer.addNodeFilter(tag.name, contentEditableFilter)
          }
        })
        editor.ui.registry.addButton('ctzn-code', {
          icon: 'code-sample',
          tooltip: 'Code snippet',
          onAction: () => code.insert(editor)
        })
        editor.ui.registry.addMenuButton('post-embeds', {
          icon: 'image',
          tooltip: 'Insert media',
          fetch: cb => {
            cb([
              {type: 'menuitem', text: 'Embedded Post', onAction: () => postView.insert(editor)},
              {type: 'menuitem', text: 'Embedded Comment', onAction: () => commentView.insert(editor)},
              {type: 'menuitem', text: 'Embedded Page (iframe)', onAction: () => iframe.insert(editor)},
              {type: 'separator'},
              {type: 'menuitem', text: 'Card UI Element', onAction: () => card.insert(editor)},
            ])
          }
        })
        editor.ui.registry.addMenuButton('content-widgets', {
          icon: 'image',
          tooltip: 'Insert content widget',
          fetch: cb => {
            cb([
              {type: 'menuitem', text: 'Card UI Element', onAction: () => card.insert(editor)},
              {type: 'separator'},
              {type: 'menuitem', text: 'Posts Feed', onAction: () => postsFeed.insert(editor)},
              {type: 'menuitem', text: 'Comments Feed', onAction: () => commentsFeed.insert(editor)},
              {type: 'separator'},
              {type: 'menuitem', text: 'Embedded Post', onAction: () => postView.insert(editor)},
              {type: 'menuitem', text: 'Embedded Comment', onAction: () => commentView.insert(editor)},
              {type: 'menuitem', text: 'Embedded Page (iframe)', onAction: () => iframe.insert(editor)},
            ])
          }
        })
        editor.ui.registry.addMenuButton('user-widgets', {
          icon: 'user-widgets',
          tooltip: 'Insert user widget',
          fetch: cb => {
            cb([
              {type: 'menuitem', text: 'Followers List', onAction: () => followersList.insert(editor)},
              {type: 'menuitem', text: 'Following List', onAction: () => followingList.insert(editor)},
            ])
          }
        })
        editor.on('init', () => {
          if (this.initialValue) {
            editor.setContent(this.initialValue, {format: 'html'})
          }
        })
        editor.on('PreProcess', (e) => {
          preProcessOutput(e.node)
        })
      }
    })
  }
  
  disconnectedCallback () {
    super.disconnectedCallback()
    this.editor?.destroy()
  }
  
  get editor () {
    return window.tinymce?.get(this.id)
  }
  
  get value () {
    return this.editor?.getContent() || ''
  }

  set value (v) {
    if (this.editor) {
      console.log('setting value', this.initialValue)
      this.editor.setContent(v, {format: 'html'})
    } else {
      this.initialValue = v
    }
  }
  
  // rendering
  // =
  
  render () {
    return html`
      <div id=${this.id} class="editor"></div>
      <div class="${this.isLoading ? 'block' : 'hidden'} text-center py-2 bg-gray-50">
        <span class="spinner"></span>
      </div>
      <p class="text-xs pt-0.5 pl-0.5">
        Powered by <a class="text-blue-600 hov:hover:underline" href="https://www.tiny.cloud" target="_blank">Tiny</a>
      </p>
    `
  }
}

customElements.define('app-rich-editor', RichEditor)

// this filter ensures that the custom tags dont have contenteditable put on them by tinymce
function contentEditableFilter (nodes) {
  nodes.forEach((node) => {
    if (!!node.attr('contenteditable')) {
      node.attr('contenteditable', null)
      node.firstChild.unwrap()
    }
  })
}

let _loadPromise = undefined
function loadTinyMCEAsNeeded () {
  if (typeof window.tinymce !== 'undefined') return
  if (_loadPromise) return _loadPromise
  _loadPromise = new Promise((resolve) => {
    const script = document.createElement('script')
    script.setAttribute('src', `/vendor/tinymce/tinymce.min.js`)
    script.addEventListener('load', resolve)
    document.body.append(script)
  })
  return _loadPromise
}

function preProcessOutput (node) {
  // remove empty nodes
  if (!node.getAttribute('ctzn-elem')) {
    const inner = (node.innerHTML || '').trim()
    if (!inner || inner === '&nbsp;') {
      node.remove()
    }
  }

  const children = Array.from(node.children)
  for (let child of children) {
    preProcessOutput(child, node.tagName + ' > ')
  }
}
