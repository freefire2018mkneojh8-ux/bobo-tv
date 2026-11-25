const C = 'bobo-v1';
self.addEventListener('install', e => e.waitUntil(caches.open(C).then(c => c.add('/'))));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).catch(() => caches.match('/')));
});
