// Offline support: every page, script, data file and CDN library the site loads is cached on the
// way through, and served from the cache when the network is down (or takes over 5 s, e.g. plane wifi).
// Signed-in edits made offline are queued by Firestore's own offline cache (see problems/progress.mjs).
const CACHE = 'raindrops-offline-v1';
const PRECACHE = ['/', '/problems/', '/problems/data/catalogue.json', '/problems/data/statements.json',
  '/problems/data/statement-supplements.json', '/problems/data/difficulty.json', '/firebase-config.js',
  'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js', 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js', 'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js'];
const CACHEABLE = u => u.origin === location.origin || ['www.gstatic.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'].includes(u.hostname);

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(PRECACHE.map(u => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// The page sends the URLs it already loaded (before this worker controlled it) so they are cached too.
self.addEventListener('message', e => {
  const urls = (e.data?.cache || []).filter(u => { try { return CACHEABLE(new URL(u)); } catch { return false; } });
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(urls.map(u => c.add(u)))));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || !CACHEABLE(url)) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const fromCache = () => cache.match(req).then(r => r || cache.match(req, {ignoreSearch: true}))
      .then(r => r || (req.mode === 'navigate' ? cache.match(url.pathname.startsWith('/problems') ? '/problems/' : '/') : undefined));
    const net = fetch(req).then(r => { if (r.ok || r.type === 'opaque') cache.put(req, r.clone()); return r; });
    try {
      return await Promise.race([net, new Promise((_, no) => setTimeout(() => no(new Error('slow')), 5000))]);
    } catch {
      const hit = await fromCache();
      if (hit) return hit;
      return net;   // nothing cached: keep waiting on the network
    }
  })());
});
