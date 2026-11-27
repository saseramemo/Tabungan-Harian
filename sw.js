importScripts('core.js');

const CACHE = 'tabungan-v3';
const ASSETS = ['./', './index.html', './core.js', './manifest.json',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/badge-96.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache dulu (cepat & offline), perbarui di belakang layar
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => {
      const net = fetch(e.request).then(r => {
        if (r && r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
        return r;
      }).catch(() => hit);
      return hit || net;
    })
  );
});

async function cekSetoran() {
  const s = await Core.load();
  const last = await Core.getLast();
  if (Core.shouldRemind(s, new Date(), last)) {
    await Core.showReminder(self.registration, s);
    await Core.setLast(Date.now());
  }
}

self.addEventListener('periodicsync', e => {
  if (e.tag === 'cek-setoran') e.waitUntil(cekSetoran());
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of list) {
      if (c.url.startsWith(self.registration.scope)) {
        await c.focus();
        c.postMessage({ type: 'setor' });
        return;
      }
    }
    await self.clients.openWindow(new URL('./?setor=1', self.registration.scope).href);
  })());
});
