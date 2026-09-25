/* ============================================================
   GameHub — offline service worker (GitHub Pages safe)

   Strategy
   --------
   - The app shell (HTML/CSS/JS/artwork that ships in this repo) is
     precached so GameHub opens offline and stays fast on repeat
     visits.
   - Navigations use network-first with a cached fallback, so a
     fresh deploy is picked up as soon as the visitor is online.
   - Everything else same-origin uses stale-while-revalidate.
   - Requests to other origins are never intercepted, never cached
     and never served from the cache: provider games stream from
     their own servers, exactly as without this worker. A remote
     provider game is therefore never presented as a local asset.

   Versions: bump CACHE_NAME when the shell changes; the old cache
   is deleted on activate.

   This file is only registered by pwa.js on http(s) hosts — from
   file:// or when service workers are unsupported the site behaves
   exactly as before.
   ============================================================ */
"use strict";

var CACHE_NAME = "gamehub-shell-v3";
var OFFLINE_FALLBACK = "index.html";

/* Local assets only — no provider URLs, no third-party CDNs. */
var SHELL = [
  "./",
  "index.html",
  "404.html",
  "style.css",
  "theme.js",
  "catalog.js",
  "player.js",
  "profile.js",
  "achievements.js",
  "cards.js",
  "search.js",
  "script.js",
  "launcher.js",
  "client-config.js",
  "session.js",
  "pwa.js",
  "manifest.webmanifest",
  "assets/favicon.svg",
  "assets/icon.svg"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      /* addAll() is all-or-nothing; adding one by one keeps the
         install alive even if a single optional file is missing. */
      return Promise.all(
        SHELL.map(function (url) {
          return cache.add(new Request(url, { cache: "reload" })).catch(function () {
            return null;
          });
        })
      );
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names.map(function (name) {
          if (name !== CACHE_NAME) return caches.delete(name);
          return null;
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("message", function (event) {
  var data = event && event.data ? event.data : null;
  if (data && data.type === "SKIP_WAITING") self.skipWaiting();
});

function isSameOrigin(url) {
  try {
    return new URL(url, self.location.href).origin === self.location.origin;
  } catch (err) {
    return false;
  }
}

function isCacheable(request, url) {
  if (request.method !== "GET") return false;
  if (!isSameOrigin(url)) return false; /* provider games stay on the network */
  if (url.pathname.indexOf("/client/") !== -1) return false; /* never bundle player-supplied clients */
  return true;
}

function fromCache(request) {
  return caches.match(request, { ignoreSearch: false }).then(function (cached) {
    if (cached) return cached;
    return caches.match(new Request(OFFLINE_FALLBACK)).then(function (fallback) {
      return fallback || Response.error();
    });
  });
}

self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (!request) return;
  var url;
  try {
    url = new URL(request.url);
  } catch (err) {
    return;
  }
  if (!isCacheable(request, url)) return; /* let the browser handle it directly */

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(function (response) {
          if (response && response.ok) {
            var copy = response.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(request, copy).catch(function () { return null; });
            });
          }
          return response;
        })
        .catch(function () {
          return fromCache(request);
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(function (cached) {
      var network = fetch(request)
        .then(function (response) {
          if (response && response.ok) {
            var copy = response.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(request, copy).catch(function () { return null; });
            });
          }
          return response;
        })
        .catch(function () {
          return cached || Response.error();
        });
      return cached || network;
    })
  );
});
