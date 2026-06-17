const CACHE_NAME = "qr-quiz-pwa-camera-v3";
const APP_SHELL = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/app.js",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./qr_texts/demo_qr_parts.txt"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        const copy = response.clone();

        if (request.method === "GET") {
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
        }

        return response;
      });
    }).catch(() => {
      if (request.mode === "navigate") return caches.match("./index.html");
      throw new Error("offline");
    })
  );
});
