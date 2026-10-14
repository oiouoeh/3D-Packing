// Service worker for 3D Packing Optimizer.
// IMPORTANT: change CACHE to a new name (e.g. 'packing-v7.04') every time you
// publish a new version of index.html, otherwise phones keep showing the old one.
const CACHE = 'packing-v7.03';
const CORE = './index.html';
const EXTRA = ['./manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-512-maskable.png'];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // The page is ~12 MB: download it ONCE (revalidating, so an unchanged copy
    // already in the browser's HTTP cache is reused instead of re-downloaded),
    // and store it under both URLs the app can be opened from.
    const res = await fetch(CORE, { cache: 'no-cache' });
    if (!res.ok) throw new Error('index.html fetch failed: ' + res.status);
    const copy = res.clone();
    await cache.put('./index.html', res);
    await cache.put('./', copy);
    // Small files: best effort, a missing icon must not break offline use.
    await Promise.all(EXTRA.map((u) => cache.add(u).catch(() => {})));
  })());
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (req.mode === 'navigate') {
    // However the app is launched (home-screen icon, with a ?query, with or
    // without index.html) always answer with the cached page, never the network.
    e.respondWith(caches.match('./index.html').then((r) => r || fetch(req)));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((r) => r || fetch(req)));
});
