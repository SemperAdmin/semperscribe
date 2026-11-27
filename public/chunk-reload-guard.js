/**
 * Chunk reload guard.
 *
 * A tab or installed copy that is still running a previous deploy asks for
 * script chunks (/_next/static/...) that the current deploy no longer has,
 * gets a 404, and keeps failing. This script reloads the page once so it
 * picks up the current build.
 *
 * It is a plain synchronous script in <head> (see layout.tsx), so its
 * listeners exist before the app hydrates and before any lazily loaded chunk
 * is requested. Next's own early async chunk tags come first in <head>, so a
 * failure of one of those can slip past; later failures and ChunkLoadError
 * rejections are caught. It has no dependencies and exposes nothing global.
 *
 * Loop protection: the time of the last guarded reload is kept in
 * sessionStorage. Within RELOAD_WINDOW_MS of it, nothing happens. If
 * sessionStorage is unavailable the guard does not reload at all, since a
 * reload loop is worse than a stale tab.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'semperscribe:chunk-reload-at';
  var RELOAD_WINDOW_MS = 60 * 1000;
  var ASSET_MARKER = '/_next/static/';
  var CHUNK_MESSAGE = /Loading chunk|Failed to load chunk|Failed to fetch dynamically imported module/i;

  /** True when the failed element is a Next static script or stylesheet. */
  function isStaticAsset(target) {
    if (!target || typeof target.tagName !== 'string') return false;
    var tag = target.tagName.toUpperCase();
    var url;
    if (tag === 'SCRIPT') {
      url = target.src;
    } else if (tag === 'LINK' && String(target.rel).toLowerCase() === 'stylesheet') {
      url = target.href;
    } else {
      return false;
    }
    return typeof url === 'string' && url.indexOf(ASSET_MARKER) !== -1;
  }

  /** True when a promise rejection looks like a failed chunk load. */
  function isChunkRejection(reason) {
    if (!reason) return false;
    if (reason.name === 'ChunkLoadError') return true;
    return CHUNK_MESSAGE.test(String(reason.message || ''));
  }

  /** Reloads once per RELOAD_WINDOW_MS. Never throws. */
  function reloadOnce() {
    try {
      var now = Date.now();
      var last = Number(window.sessionStorage.getItem(STORAGE_KEY));
      if (last && now - last < RELOAD_WINDOW_MS) return;
      window.sessionStorage.setItem(STORAGE_KEY, String(now));
      window.location.reload();
    } catch (e) {
      // Storage unavailable: cannot rate-limit, so do not reload.
    }
  }

  try {
    // Capture phase: resource load errors do not bubble.
    window.addEventListener(
      'error',
      function (event) {
        try {
          if (isStaticAsset(event && event.target)) reloadOnce();
        } catch (e) {
          // Never throw from a guard.
        }
      },
      true
    );
    window.addEventListener('unhandledrejection', function (event) {
      try {
        if (event && isChunkRejection(event.reason)) reloadOnce();
      } catch (e) {
        // Never throw from a guard.
      }
    });
  } catch (e) {
    // No window or no listeners: nothing to guard.
  }
})();
