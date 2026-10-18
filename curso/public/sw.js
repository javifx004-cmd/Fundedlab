// Solo guarda en caché la «carcasa» de la app (HTML, CSS, JS e iconos) para que abra rápido como app instalada.
// El contenido del curso (/api/...) nunca se guarda: siempre se pide al servidor, que comprueba el acceso.
const CACHE = 'fundedlab-curso-v4';
const SHELL = ['/app', '/entrar', '/style.css', '/app.js', '/entrar.js', '/manifest.webmanifest', '/icons/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/') || url.pathname === '/acceso' || url.pathname === '/gracias') return;
  if (!SHELL.includes(url.pathname)) return;
  // Red primero; la caché solo se usa sin conexión.
  e.respondWith(fetch(e.request).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request)));
});
