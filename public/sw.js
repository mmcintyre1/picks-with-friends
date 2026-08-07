// Deliberately a pure passthrough. This app's data (parlay status, live odds, lock
// state) must never be served stale, so nothing is cached here -- this service worker
// exists only to make the app installable as a PWA, not to provide offline support.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
