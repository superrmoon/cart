var CACHE_NAME = "cart-v5";
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

// Fetch handler
self.addEventListener("fetch", function (event) {
  var url = event.request.url;

  // Skip Firebase/Google API calls
  if (
    url.includes("googleapis.com") ||
    url.includes("firestore.googleapis.com") ||
    url.includes("identitytoolkit") ||
    url.includes("securetoken") ||
    url.includes("gstatic.com/firebasejs") ||
    url.includes("firebaseapp.com") ||
    url.includes("accounts.google.com")
  ) {
    return;
  }

  // Navigation requests (HTML): network-first for auth redirect support
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(function () {
        return caches.match("./index.html");
      })
    );
    return;
  }

  // Other assets: cache-first
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      return cached || fetch(event.request);
    })
  );
});
