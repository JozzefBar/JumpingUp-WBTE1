const CACHE_NAME = 'jumping-up-v2'
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
]

// Install event - cache assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...')

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Caching files')
      // Cache files individually to avoid failing on missing files
      return Promise.allSettled(
        ASSETS_TO_CACHE.map(url =>
          cache.add(url).catch(err => {
            console.warn('Service Worker: Failed to cache:', url, err)
            return null
          })
        )
      )
    }).then(() => {
      console.log('Service Worker: Installation complete')
      self.skipWaiting()
    })
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...')

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache:', cache)
            return caches.delete(cache)
          }
        })
      )
    }).then(() => {
      console.log('Service Worker: Activated successfully')
      return self.clients.claim()
    })
  )
})

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached version or fetch from network
      return (
        response ||
        fetch(event.request).then((fetchResponse) => {
          // Cache new resources
          return caches.open(CACHE_NAME).then((cache) => {
            // Don't cache POST requests or non-HTTP(S) requests
            if (
              event.request.method === 'GET' &&
              event.request.url.startsWith('http')
            ) {
              cache.put(event.request, fetchResponse.clone())
            }
            return fetchResponse
          })
        })
      )
    })
  )
})
