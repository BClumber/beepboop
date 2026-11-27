// BeepBoop offline cache. Bump VERSION when files change so phones pick up the update.
const VERSION = 'beepboop-v11';
const CORE = ['./', 'index.html', 'three.min.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-64.png',
  'fonts/fonts.css', 'fonts/baloo-2-latin-700-normal.woff2', 'fonts/baloo-2-latin-800-normal.woff2',
  'fonts/chakra-petch-latin-500-normal.woff2', 'fonts/chakra-petch-latin-700-normal.woff2'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // The page itself: try the network first so updates show up, fall back to the cached copy offline.
  // Wait at most 2.5 s for the network (weak signal, airplane mode), then open the saved copy.
  if (req.mode === 'navigate') {
    const net = fetch(req).then(r => { if (r.ok) { const c = r.clone(); caches.open(VERSION).then(x => x.put('index.html', c)); } return r; });
    const saved = () => caches.match('index.html').then(h => h || net);
    e.respondWith(new Promise(res => {
      let done = false; const fin = p => { if (!done) { done = true; res(p); } };
      const tm = setTimeout(() => fin(saved()), 2500);
      net.then(r => { clearTimeout(tm); fin(r.ok ? r : saved()); }).catch(() => { clearTimeout(tm); fin(saved()); });
    }));
    return;
  }
  // Everything else (library, icons, fonts): cached copy first, then network, and keep what we fetch.
  const sameOrigin = url.origin === location.origin;
  const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!sameOrigin && !fonts) return;
  e.respondWith(caches.match(req,{ignoreSearch:true}).then(hit => hit || fetch(req).then(r => {
    if (r && (r.ok || r.type === 'opaque')) { const c = r.clone(); caches.open(VERSION).then(x => x.put(req, c)); }
    return r;
  })));
});
