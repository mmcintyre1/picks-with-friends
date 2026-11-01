// Exists only so the app is installable as a PWA. Deliberately has NO fetch handler: it used
// to pass every request through `event.respondWith(fetch(event.request))`, which added a hop
// to every page load and server action and can break redirects (e.g. a page bouncing a
// signed-out user to /login). Without a fetch handler the browser handles requests itself.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
