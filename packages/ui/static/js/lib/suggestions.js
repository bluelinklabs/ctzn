/* globals monaco */

export default function registerSuggestions () {
  MarkdownSuggestions.register()
}

export class MarkdownSuggestions {
  constructor () {
    this.mdLinkQueryRegex = /\[(.*?)\]/
    this.mdMentionQueryRegex = /@(\w*)/
    this.searchDebouncer = debouncer(100)
    beaker.session.get().then(async (session) => {
      this.profile = session ? session.user : undefined
    })
  }

  static register () {
    // TODO: Currently must provide "wildcard" trigger characters (workaround).
    const triggerCharacters = [...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789']
    const handler = new MarkdownSuggestions()
    monaco.languages.registerCompletionItemProvider('markdown', {
      triggerCharacters,
      provideCompletionItems: handler.provideCompletionItems.bind(handler)
    })
  }

  async completeLinkSuggestions (term, match, value) {
    // If the query is only one char, wait until it's longer.
    if (term.length === 1) {
      return null
    }
    const {queryResults} = await this.searchDebouncer(() => beaker.index.gql(`
      query Search ($search: String!) {
        queryResults: records(
          search: $search,
          paths: ["/blog/*.md"],
          limit: 10
        ) {
          url
          path
          metadata
          site { title }
        }
      }
    `, {search: term}))
    const suggestions = queryResults.map(s => {
      var type = 'blogpost'
      if (s.path.startsWith('/pages/')) type = 'page'
      const title = s.metadata.title || s.url.split('/').pop()
      const detail = s.site.title
      return {
        kind: 7, // "Interface"
        label: title ? `(${type}) - ${title}` : `(${type})`,
        detail,
        range: match.range,
        filterText: value,
        insertText: `[${title}](${s.url})`
      }
    })
    return { suggestions }
  }

  async completePeopleSuggestions (term, match, value) {
    const {queryResults} = await this.searchDebouncer(() => beaker.index.gql(`
      query Search($search: String!) {
        queryResults: sites(search: $search, limit: 10) { url, title }
      }
    `, {search: term}))
    const suggestions = queryResults.map(s => {
      return {
        kind: 7, // "Interface"
        label: s.title,
        range: match.range,
        filterText: value,
        insertText: `[@${s.title}](${s.url})`
      }
    })

    {
      let title = this.profile?.title.toLowerCase() || ''
      if (title.includes(term.toLowerCase())) {
        suggestions.unshift({
          kind: 7, // "Interface"
          label: this.profile.title,
          range: match.range,
          filterText: value,
          insertText: `[@${this.profile.title}](hyper://${this.profile.key})`
        })
      }
    }

    return { suggestions }
  }

  async provideCompletionItems (model, position) {
    // link match
    var matches = model.findMatches(this.mdLinkQueryRegex, {
      startColumn: 1,
      endColumn: model.getLineMaxColumn(position.lineNumber),
      startLineNumber: position.lineNumber,
      endLineNumber: position.lineNumber
    }, true, false, null, true)
    var match = matches.length && matches.find(m => m.range.containsPosition(position))
    if (match) {
      let term = match.matches[1]
      let value = model.getValueInRange(match.range) 
      if (term.startsWith('@')) return this.completePeopleSuggestions(term.slice(1), match, value)
      return this.completeLinkSuggestions(term, match, value)
    }

    // mention match
    var matches = model.findMatches(this.mdMentionQueryRegex, {
      startColumn: 1,
      endColumn: model.getLineMaxColumn(position.lineNumber),
      startLineNumber: position.lineNumber,
      endLineNumber: position.lineNumber
    }, true, false, null, true)
    var match = matches.length && matches.find(m => m.range.containsPosition(position))
    if (match) {
      let term = match.matches[1]
      let value = model.getValueInRange(match.range) 
      return this.completePeopleSuggestions(term, match, value)
    }

    return null
  }
}

function debouncer (ms, fallback) {
  let stack = []
  let running = false

  async function pop () {
    if (!stack.length) {
      running = false
      return
    }
    running = true
    const startTime = Date.now()
    const { run, cancel } = stack.pop()
    for (let i = 0; i < stack.length; i++) {
      stack.pop().cancel()
    }
    try {
      await run()
    } finally {
      const diff = ms - (Date.now() - startTime)
      if (diff < 0) return pop()
      else setTimeout(pop, diff)
    }
  }

  return async function push (task) {
    return new Promise((resolve, reject) => {
      stack.push({
        run: () => task().then(resolve, reject),
        // Resolve with empty search results if cancelled.
        cancel: () => resolve(fallback)
      })
      if (!running) pop()
    })
  }
}