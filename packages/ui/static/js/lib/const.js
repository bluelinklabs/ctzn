import { joinPath } from './strings.js'

export const DEBUG_ENDPOINTS = {
  'dev1.localhost': 'localhost:3000',
  'dev2.localhost': 'localhost:4000',
  'dev3.localhost': 'localhost:5000',
  'dev4.localhost': 'localhost:6000'
}

function getDebugDomain () {
  for (let [hostname, endpoint] of Object.entries(DEBUG_ENDPOINTS)) {
    if (endpoint.endsWith(window.location.port)) {
      return hostname
    }
  }
  return window.location.hostname
}

export const OUR_DOMAIN = window.location.hostname === 'localhost' ? getDebugDomain() : window.location.hostname

export function HTTP_ENDPOINT (domain) {
  return DEBUG_ENDPOINTS[domain] ? `http://${DEBUG_ENDPOINTS[domain]}` : `https://${domain}`
}

export function AVATAR_URL (userId) {
  return '/' + joinPath('.view/ctzn.network/avatar-view', userId)
}

export function USER_URL (userId) {
  return `/${userId}`
}

export function POST_URL (post) {
  return '/' + joinPath(post.author.userId, 'ctzn.network/post', post.key)
}

export function FULL_POST_URL (post) {
  return location.origin + '/' + joinPath(post.author.userId, 'ctzn.network/post', post.key)
}

export function COMMENT_URL (comment) {
  return '/' + joinPath(comment.author.userId, 'ctzn.network/comment', comment.key)
}

export function FULL_COMMENT_URL (comment) {
  return location.origin + '/' + joinPath(comment.author.userId, 'ctzn.network/comment', comment.key)
}

export function BLOB_URL (userId, blobName) {
  return '/' + joinPath('.view/ctzn.network/blob-view', userId, blobName)
}

export const PERM_DESCRIPTIONS = {
  'ctzn.network/perm-community-update-config': `Can update the community settings.`,
  'ctzn.network/perm-community-invite': `Can invite users to join the community.`,
  'ctzn.network/perm-community-ban': `Can remove, ban, and unban members from the community.`,
  'ctzn.network/perm-community-remove-post': `Can remove posts from the community.`,
  'ctzn.network/perm-community-remove-comment': `Can remove comments from the community.`,
  'ctzn.network/perm-community-edit-profile': `Can edit the profile of the community.`,
  'ctzn.network/perm-community-manage-roles': `Can create, edit, and delete roles.`,
  'ctzn.network/perm-community-assign-roles': `Can assign roles to community members.`,
  'ctzn.network/perm-manage-pages': 'Can create, edit, and delete pages.'
}

export const SUGGESTED_REACTIONS = [
  'like',
  'haha',
  'interesting!',
  '❤️',
  '👍',
  '😂',
  '🤔',
  '🔥',
  '😢'
]

export const FIXED_COMMUNITY_PROFILE_SECTIONS = [
  {
    id: 'feed',
    label: 'Feed',
    html: `<ctzn-posts-feed></ctzn-posts-feed>`
  },
  {
    id: 'about',
    label: 'About',
    html: `<ctzn-community-members-list></ctzn-community-members-list>`
  },
  {
    id: 'pages',
    label: 'Pages',
    html: `<ctzn-pages-list></ctzn-pages-list>`
  }
]

export const FIXED_CITIZEN_PROFILE_SECTIONS = [
  {
    id: 'feed',
    label: 'Feed',
    html: `<ctzn-posts-feed></ctzn-posts-feed>`
  },
  {
    id: 'about',
    label: 'About',
    html: `<ctzn-followers-list></ctzn-followers-list>
<ctzn-following-list></ctzn-following-list>
<ctzn-community-memberships-list></ctzn-community-memberships-list>`
  },
  {
    id: 'pages',
    label: 'Pages',
    html: `<ctzn-pages-list></ctzn-pages-list>`
  }
]
