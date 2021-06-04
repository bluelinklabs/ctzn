const CACHE_NAME = 'ctznry-2fec43b9d64819d84f3c7824e76fbf1bacde5359'
const CACHE_LIST = [
  '/',
  '/account',
  '/forgot-password',
  '/manifest.json',
  '/notifications',
  '/search',
  '/signup',
  '/css/common.css',
  '/css/fontawesome.css',
  '/css/tailwind.css',
  '/img/default-user-thumb.jpg',
  '/img/favicon.png',
  '/img/img-placeholder.png',
  '/img/spinner.gif',
  '/js/account.build.js',
  '/js/forgot-password.build.js',
  '/js/main.build.js',
  '/js/notifications.build.js',
  '/js/post.build.js',
  '/js/signup.build.js',
  '/js/user.build.js',
  '/webfonts/fa-brands-400.woff2',
  '/webfonts/fa-regular-400.woff2',
  '/webfonts/fa-solid-900.woff2'
]

async function install () {
  const cache = await caches.open(CACHE_NAME)
  cache.addAll(CACHE_LIST)
}

async function activate () {
  // Delete old caches
  const keyList = await caches.keys()
  const cacheDeletions = keyList
    .filter(key => key != CACHE_NAME)
    .map(key => caches.delete(key))
  await Promise.all(cacheDeletions)
}

async function cacheFetch (event) {
  // Attempt response from cache
  const cachedResponse = await caches.match(event.request)
  if (cachedResponse) return cachedResponse

  // Fetch over network
  return fetch(event.request)
}

self.addEventListener('install', event => {
  event.waitUntil(install())
})

self.addEventListener('activate', event => {
  event.waitUntil(activate())
})

self.addEventListener('fetch', event => {
  event.respondWith(cacheFetch(event))
})
