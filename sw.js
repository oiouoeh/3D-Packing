// 3D Packing Optimizer 서비스워커 (STEP Viewer와 같은 방식)
// 새 버전을 올릴 때마다 CACHE 이름의 버전을 바꾸세요. (index.html 의 APP_CACHE 도 같은 이름으로)
//
// 중요: 같은 주소(예: oiouoeh.github.io)에 올린 다른 앱(STEP Viewer 등)과 저장소(Cache Storage)를
// 공유합니다. 그래서 정리할 때는 반드시 내 접두어('packing-')가 붙은 것만 지웁니다.
// ("내 이름이 아닌 건 전부 삭제" 방식은 다른 앱의 오프라인 저장본을 지워버립니다.)
const PREFIX = 'packing-';
const CACHE = PREFIX + 'v7.05';
const OPTIONAL = ['./manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-512-maskable.png'];
const BASE = new URL('./', self.location).pathname;   // 예: '/packing/' 또는 '/'

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE);
      // 앱 본체는 필수이고 한 번만 저장한다. 못 받으면 설치를 실패시켜 반쪽짜리 서비스워커가 활성화되지 않게 한다.
      await cache.add(new Request('./index.html', { cache: 'reload' }));
      // 나머지는 하나가 실패해도 설치를 막지 않는다.
      await Promise.all(OPTIONAL.map(u => cache.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    } catch (err) {
      // 열려 있는 화면에 실패 이유를 알려서 진단 창에 표시되게 한다.
      const msg = (err && err.name ? err.name + ': ' : '') + (err && err.message ? err.message : String(err));
      const cs = await self.clients.matchAll({ includeUncontrolled: true });
      cs.forEach(c => c.postMessage({ type: 'sw-install-error', msg }));
      throw err;
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.indexOf(PREFIX) === 0 && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// 저장된 본체를 돌려준다. 저장소가 비어 있으면(다른 앱이 지웠거나 브라우저가 정리했을 때)
// 온라인일 때 한 번 받아서 다시 채워 둔다.
async function serveApp(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match('./index.html');
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && !res.redirected) cache.put('./index.html', res.clone()).catch(() => {});
  return res;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // 이 앱의 주소(폴더 주소 또는 index.html)만 처리한다. 같은 사이트의 다른 앱 주소는 건드리지 않는다.
    if (url.pathname !== BASE && url.pathname !== BASE + 'index.html') return;
    e.respondWith(serveApp(req));
    return;
  }
  if (url.pathname.indexOf(BASE) !== 0) return;
  e.respondWith(
    caches.open(CACHE).then(c => c.match(req, { ignoreSearch: true }))
      .then(hit => hit || fetch(req).catch(() => Response.error()))
  );
});
