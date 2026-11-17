// App shell cache. Bump VERSION when shipping changes.
const VERSION = 'cache-v5'
const SHELL = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'src/app.js', 'src/ui.js', 'src/time.js', 'src/model.js', 'src/backup.js', 'src/ocr-parse.js', 'src/ocr.js', 'src/store.js', 'src/stats.js', 'src/todos.js',
  'src/views/day.js', 'src/views/editors.js', 'src/views/picker.js', 'src/views/timer.js',
  'src/views/courses.js', 'src/views/photo.js', 'src/views/backlog.js', 'src/views/settings.js', 'src/views/import.js', 'src/views/dayphoto.js', 'src/views/stats.js', 'src/views/todos.js',
]

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== 'ocr' && k !== 'fonts').map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  // OCR library and Korean model from jsDelivr: cache after first download.
  if (url.hostname === 'cdn.jsdelivr.net') {
    e.respondWith(caches.open('ocr').then(async (c) => (await c.match(req)) || fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r })))
    return
  }
  // Web fonts: cache after first download so the planner looks the same offline.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open('fonts').then(async (c) => (await c.match(req)) || fetch(req).then((r) => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r })))
    return
  }
  if (url.origin !== location.origin) return
  // Pages: network first. Other files: serve cache, refresh it in the background so the next launch gets updates.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => { const copy = r.clone(); caches.open(VERSION).then((c) => c.put('index.html', copy)); return r }).catch(() => caches.match('index.html')))
    return
  }
  e.respondWith(caches.open(VERSION).then(async (c) => {
    const hit = await c.match(req)
    const fresh = fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r }).catch(() => hit)
    return hit || fresh
  }))
})
