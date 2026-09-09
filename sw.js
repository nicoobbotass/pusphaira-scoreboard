// Offline cache for the Pusphaira Scoreboard app shell.
// Bump CACHE when you change index.html so phones pick up the new version.
const CACHE = "pusphaira-v9";
const ASSETS = ["index.html", "manifest.webmanifest", "icon.svg", "apple-touch-icon.png", "icon-192.png", "icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;                 // only cache reads
  const url = new URL(e.request.url);
  if (url.pathname.startsWith("/api/")) return;           // never cache the sync API
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => {
      if (hit) return hit;
      return fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match("index.html"));
    })
  );
});
