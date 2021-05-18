import DOMPurify from '../../vendor/dom-purify.js'

DOMPurify.addHook('afterSanitizeAttributes', currentNode => {
  currentNode.classList.add('sanitized')
  return currentNode
})

DOMPurify.addHook('beforeSanitizeElements', currentNode => {
  if (currentNode.tagName === 'CTZN-CODE') {
    // turn everything inside a <ctzn-code> into escaped rendering
    currentNode.textContent = currentNode.innerHTML
  }
  return currentNode;
})

export function sanitize (str, context = undefined) {
  if (context === 'profile' || context === 'page') {
    return DOMPurify.sanitize(str, {
      ADD_TAGS: [
        'ctzn-card',
        'ctzn-code',
        'ctzn-iframe',
        'ctzn-posts-feed',
        'ctzn-post-view',
        'ctzn-followers-list',
        'ctzn-following-list',
        'ctzn-community-memberships-list',
        'ctzn-community-members-list',
        'ctzn-dbmethods-feed',
        'ctzn-owned-items-list',
        'ctzn-item-classes-list',
        'ctzn-comment-view',
        'ctzn-comments-feed',
        'ctzn-pages-list'
      ],
      ADD_ATTR: ['view', 'user-id', 'mode', 'limit', 'methods-filter'],
      FORBID_TAGS: ['form', 'style'],
      FORBID_ATTR: ['class', 'style']
    })
  }
  if (context === 'post') {
    return DOMPurify.sanitize(str, {
      ADD_TAGS: [
        'ctzn-card',
        'ctzn-iframe',
        'ctzn-code',
        'ctzn-post-view',
        'ctzn-comment-view'
      ],
      ADD_ATTR: ['view', 'user-id', 'mode'],
      FORBID_TAGS: ['form', 'style'],
      FORBID_ATTR: ['class', 'style']
    })
  }
  return DOMPurify.sanitize(str, {
    FORBID_TAGS: ['form', 'style'],
    FORBID_ATTR: ['class', 'style']
  })
}