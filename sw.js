var CACHE_NAME = "cart-v2";
var ASSETS = [
  "./index.html",
  "./style.css",
  "./app.js",
  "./firebase-config.js",
  "./firebase-auth.js",
  "./firebase-db.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

// Install: cache all assets
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (k) { return k !== CACHE_NAME; })
          .map(function (k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// Fetch: cache-first for app assets, skip Firebase API calls
self.addEventListener("fetch", function (event) {
  var url = event.request.url;

  // Let browser handle Firebase/Google API calls directly
  if (
    url.includes("googleapis.com") ||
    url.includes("firestore.googleapis.com") ||
    url.includes("identitytoolkit") ||
    url.includes("securetoken") ||
    url.includes("gstatic.com/firebasejs")
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      return cached || fetch(event.request);
    })
  );
});
