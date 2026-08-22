const CACHE = 'gioia-v4'

self.addEventListener('install', e => { self.skipWaiting() })

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => clients.claim())
  )
})

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  const url = new URL(e.request.url)
  // Solo cachear recursos del mismo origen (no Supabase, no CDNs externos)
  if (url.origin !== self.location.origin) return

  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(e.request)
      const fresh  = fetch(e.request).then(r => {
        if (r.ok) cache.put(e.request, r.clone())
        return r
      }).catch(() => null)
      return cached || await fresh
    })
  )
})
