/**
 * SemperScribe service worker (P1.4, DONDOCS_PARITY_PLAN).
 *
 * Offline strategy for a fully static export:
 * - Navigations: network first, cached app shell as the offline fallback.
 * - Hashed /_next/ chunks: cache first - the hash IS the invalidation.
 * - Stable-named assets (pdf worker, fonts, templates, manifest):
 *   stale-while-revalidate. The v2 worker cached these forever, which
 *   pinned the cloud.gov octet-stream pdf.worker response even after
 *   the server was fixed (the mime.types incident). Serving cache and
 *   refreshing in the background heals any stable-name change within
 *   one reload, offline behavior unchanged.
 *
 * All URLs are computed relative to the registration scope, so the same
 * file serves /semperscribe (GitHub Pages) and / (cloud.gov).
 */

// v3: purges v2 caches poisoned by the octet-stream pdf worker.
const CACHE_NAME = 'semperscribe-v3';
const SCOPE_PATH = new URL(self.registration ? self.registration.scope : self.location.href).pathname;
const SHELL_URL = SCOPE_PATH; // './' relative to scope

const PRECACHE = [
  SHELL_URL,
  SCOPE_PATH + 'manifest.webmanifest',
  SCOPE_PATH + 'logo.png',
  SCOPE_PATH + 'USMC.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: network first, offline falls back to the cached shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(SHELL_URL, copy));
          return response;
        })
        .catch(() => caches.match(SHELL_URL).then((hit) => hit || Response.error()))
    );
    return;
  }

  // Hashed build chunks: cache first - the filename hash is the version.
  if (url.pathname.includes('/_next/')) {
    event.respondWith(
      caches.match(request).then((hit) => {
        if (hit) return hit;
        return fetch(request).then((response) => {
          if (response.ok && (response.type === 'basic' || response.type === 'default')) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      })
    );
    return;
  }

  // Stable-named assets: stale-while-revalidate. Cache answers now;
  // the network refreshes the entry for the next load, so a changed
  // file (or fixed response header) never stays pinned.
  event.respondWith(
    caches.match(request).then((hit) => {
      const refresh = fetch(request)
        .then((response) => {
          if (response.ok && (response.type === 'basic' || response.type === 'default')) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => hit || Response.error());
      return hit || refresh;
    })
  );
});
