export const HYPER_URL_REGEX = /^(hyper:\/\/)?([0-9a-f]{64})/i
export const PUBKEY_REGEX = /[0-9a-f]{64}/i
export const PUBKEY_ONLY_REGEX = /^[0-9a-f]{64}$/i

export function isHyperKey (str = '') {
  return PUBKEY_ONLY_REGEX.test(str)
}

export function isHyperUrl (str = '') {
  return HYPER_URL_REGEX.test(str)
}

export function urlToKey (str) {
  try {
    return PUBKEY_REGEX.exec(str)[0]
  } catch (e) {
    return ''
  }
}

export function ucfirst (str) {
  if (!str) str = ''
  if (typeof str !== 'string') str = '' + str
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function pluralize (num, base, suffix = 's') {
  if (num === 1) { return base }
  return base + suffix
}

export function shorten (str, n = 6) {
  if (str.length > (n + 3)) {
    return str.slice(0, n) + '...'
  }
  return str
}

export function joinPath (...args) {
  var str = args[0]
  for (let v of args.slice(1)) {
    v = v && typeof v === 'string' ? v : ''
    let left = str.endsWith('/')
    let right = v.startsWith('/')
    if (left !== right) str += v
    else if (left) str += v.slice(1)
    else str += '/' + v
  }
  return str
}


export function toDomain (str) {
  if (!str) return ''
  try {
    var urlParsed = new URL(str)
    return urlParsed.hostname
  } catch (e) {
    // ignore, not a url
  }
  return str
}

export function toNiceDomain (str, len=4) {
  var domain = str.includes('://') ? toDomain(str) : str
  if (PUBKEY_REGEX.test(domain)) {
    domain = `${domain.slice(0, len)}..${domain.slice(-2)}`
  }
  return domain
}

export function toNiceUrl (str) {
  if (!str) return ''
  try {
    var urlParsed = new URL(str)
    if (PUBKEY_REGEX.test(urlParsed.hostname)) {
      urlParsed.hostname = `${urlParsed.hostname.slice(0, 4)}..${urlParsed.hostname.slice(-2)}`
    }
    return urlParsed.toString()
  } catch (e) {
    // ignore, not a url
  }
  return str
}

const PARSE_SRC_ATTR_RE = /([^\/@]+@[^\/]+)\/([^\/]+\/[^\/]+)\/([^\/]+)/i
export function parseSrcAttr (str = '') {
  if (str.startsWith('hyper://')) {
    throw new Error('Unable to handle hyper:// URLs at this time')
  }
  try {
    const [_, userId, schemaId, key] = PARSE_SRC_ATTR_RE.exec(str)
    return {userId, schemaId, key}
  } catch (e) {
    console.log(e)
    throw new Error('Invalid "src" attribute')
  }
}

export function encodeBase64 (str = '') {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => (
    String.fromCharCode('0x' + p1)
  )))
}

export function decodeBase64 (str = '') {
  return decodeURIComponent(atob(str).split('').map(c => {
    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
  }).join(''))
}

export function base64ByteSize (str = '') {
  return ((4 * str.length / 3) + 3) & ~3
}

const MAKE_SAFE_MAP = {
  '"': '&quot;',
  "'": '&#39;',
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;'
}
export function makeSafe (str = '') {
  return str.replace(/["'&<>]/g, (match) => MAKE_SAFE_MAP[match] || '')
}

const MAKE_UNSAFE_MAP = {
  '&quot;': '"',
  '&#39;': "'",
  '&lt;': '<',
  '&gt;': '>',
  '&amp;': '&'
}
export function makeUnsafe (str = '') {
  return str.replace(/(&quot;|&#39;|&lt;|&gt;|&amp;)/g, (_, match) => MAKE_UNSAFE_MAP[match] || '')
}

const URL_RE = /(http|https|hyper):\/\/([a-z0-9\-._~:/\?#\[\]@!$&'\(\)*+,;=%]+)/gi
const PUNCTUATION_RE = /[^a-z0-9]$/i
const OPEN_PARENS_RE = /\(/g
const CLOSE_PARENS_RE = /\)/g
const OPEN_SQBRACKETS_RE = /\[/g
const CLOSE_SQBRACKETS_RE = /\]/g
export function linkify (str = '') {
  return str.replace(URL_RE, match => {
    // remove trailing punctuation
    let trailingChars = ''
    while (match.length && PUNCTUATION_RE.test(match)) {
      let char = match.charAt(match.length - 1)
      if (char === ')' || char === ']') {
        // closing brackets require us to balance
        let openCount = match.match((char === ')' ? OPEN_PARENS_RE : OPEN_SQBRACKETS_RE))?.length || 0
        let closeCount = match.match((char === ')' ? CLOSE_PARENS_RE : CLOSE_SQBRACKETS_RE))?.length || 0
        if (closeCount <= openCount) {
          // this char seems to close an opening bracket in the URL so consider it a part of the URL
          break
        }
      }
      match = match.slice(0, match.length - 1)
      trailingChars += char
    }
    return `<a class="text-blue-600 hov:hover:underline" href="${match}">${match}</a>${trailingChars}`
  })
}

export function extractSchemaId (str = '') {
  try {
    const pathParts = str.split(PUBKEY_REGEX)[1]?.split('/').filter(Boolean)
    return pathParts.slice(0, 2).join('/')
  } catch (e) {
    return undefined
  }
}

// search results are returned from beaker's search APIs with nonces wrapping the highlighted sections
// e.g. a search for "test" might return "the {500}test{/500} result"
// this enables us to safely escape the HTML, then replace the nonces with <strong> tags
export function highlightSearchResult (str = '', nonce = 0) {
  var start = new RegExp(`\\{${nonce}\\}`, 'g') // eg {500}
  var end = new RegExp(`\\{/${nonce}\\}`, 'g') // eg {/500}
  return makeSafe(str).replace(start, '<strong>').replace(end, '</strong>')
}

export function normalizeUrl (str = '') {
  try {
    let url = new URL(str)
    let res = url.protocol + '//' + url.hostname
    if (url.port) res += ':' + url.port
    res += url.pathname.replace(/(\/)$/, '') || '/'
    if (url.search && url.search !== '?') res += url.search
    if (url.hash && url.hash !== '#') res += url.hash
    return res
  } catch (e) {
    return str
  }
}

export function changeURLScheme (url = '', scheme = '') {
  try {
    let urlp = new URL(url)
    urlp.protocol = scheme
    return urlp.toString()
  } catch (e) {
    return url
  }
}

/**
 * Calculate a 32 bit FNV-1a hash
 * Found here: https://gist.github.com/vaiorabbit/5657561
 * Ref.: http://isthe.com/chongo/tech/comp/fnv/
 *
 * @param {string} str the input value
 * @param {boolean} [asString=false] set to true to return the hash value as 8-digit hex string instead of an integer
 * @param {number} [seed] optionally pass the hash of the previous chunk
 * @returns {number | string}
 */
export function hashFnv32a (str, asString, seed) {
  var i, l, hval = (seed === undefined) ? 0x811c9dc5 : seed

  for (i = 0, l = str.length; i < l; i++) {
    hval ^= str.charCodeAt(i)
    hval += (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) + (hval << 24)
  }
  if (asString) {
    // Convert to 8 digit hex string
    return ("0000000" + (hval >>> 0).toString(16)).substr(-8)
  }
  return hval >>> 0
}

export function toHex (buf) {
  return buf.reduce((memo, i) => (
    memo + ('0' + i.toString(16)).slice(-2) // pad with leading 0 if <16
  ), '')
}

export function isSameOrigin (a, b) {
	return getOrigin(a) === getOrigin(b)
}

export function getOrigin (str) {
	let i = str.indexOf('://')
	let j = str.indexOf('/', i + 3)
	return str.slice(0, j === -1 ? undefined : j)
}

export function fancyUrl (str, siteTitle) {
  try {
    let url = new URL(str)
    let parts = [siteTitle || toNiceDomain(url.hostname)].concat(url.pathname.split('/').filter(Boolean))
    return parts.join(' › ') + (url.search ? ` ? ${url.search.slice(1)}` : '')
  } catch (e) {
    return str
  }
}

var _fancyUrlAsyncCache = {}
export async function* fancyUrlAsync (str) {
  try {
    let url = new URL(str)
    if (_fancyUrlAsyncCache[url.origin]) {
      yield fancyUrl(str, _fancyUrlAsyncCache[url.origin])
      return
    }
    yield fancyUrl(str)
    if (url.protocol === 'hyper:') {
      let {site} = await beaker.index.gql(`
        query Site ($origin: String!) {
          site(url: $origin, cached: true) { title }
        }
      `, {origin: url.origin})
      _fancyUrlAsyncCache[url.origin] = site.title
      yield fancyUrl(str, site.title)
    }
  } catch (e) {
    return str
  }
}