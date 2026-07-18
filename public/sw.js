/**
 * SemperScribe service worker (P1.4, DONDOCS_PARITY_PLAN).
 *
 * Offline strategy for a fully static export:
 * - Navigations: network first, cached app shell as the offline fallback.
 * - Hashed /_next/ chunks: cache first - the hash IS the invalidation.
 * - Stable-named assets (pdf worker, fonts, templates, forms, manifest):
 *   NETWORK FIRST, cache as the offline fallback only. Their filenames
 *   never change, so a cache-first or stale-first read cannot
 *   distinguish current content from a previous deploy's - and did
 *   not, twice (see the fetch handler).
 *
 * All URLs are computed relative to the registration scope, so the same
 * file serves /semperscribe (GitHub Pages) and / (cloud.gov).
 */

// v4: purges v3 caches holding the pre-AA-pack template index.
// Activation deletes every cache whose name is not this one, so the
// bump is what evicts a poisoned cache on the user's next visit.
const CACHE_NAME = 'semperscribe-v4';
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

  // Stable-named assets (templates, forms, worker, fonts): NETWORK
  // FIRST, cache only as the offline fallback.
  //
  // Stale-while-revalidate was wrong here and shipped two incidents:
  // it answers from cache and refreshes for NEXT time, so the first
  // load after every deploy serves the PREVIOUS deploy's content. That
  // pinned the octet-stream pdf worker after the MIME fix, then hid
  // the 25 AA templates behind a 32-entry index. These filenames never
  // change, so the cache can never tell "same file" from "old file" -
  // only the network knows. Correctness beats the milliseconds.
  //
  // Offline is unaffected: a failed fetch falls back to the cache.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && (response.type === 'basic' || response.type === 'default')) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((hit) => hit || Response.error()))
  );
});
