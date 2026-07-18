/* =====================================================
   Cardiothoracic Theatre Viewer
   service-worker.js
   -----------------------------------------------------
   Makes the dashboard installable and usable offline.

   Strategy: NETWORK FIRST, cache fallback. Staff online
   always see the freshest rota; if the network is down,
   the last successfully fetched copy is shown instead.

   The cache name comes from version.js - bumping
   APP_VERSION there is what makes every device discard
   its old cache and pick up new files.
   ===================================================== */

importScripts("./version.js");

const CACHE_NAME = `ct-theatre-${self.APP_VERSION}`;

const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./week.html",
  "./styles.css",
  "./week.css",
  "./clinical.css",
  "./app.js",
  "./viewer.js",
  "./week.js",
  "./viewer-utils.js",
  "./calendar.js",
  "./version.js",
  "./config.js",
  "./api.js",
  "./print.js",
  "./oncall-now.js",
  "./myweek.js",
  "./features.css",
  "./tv.html",
  "./tv.js",
  "./manifest.json"
];

// Install: pre-cache the app shell, activate immediately
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

// Activate: delete caches from older versions
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: try the network, keep a copy, fall back to cache offline
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// The update banner sends SKIP_WAITING when the user accepts an update
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
