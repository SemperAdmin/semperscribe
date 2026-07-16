'use client';

/**
 * P1.4 (DONDOCS_PARITY_PLAN) - offline support bootstrap.
 *
 * Registers the service worker, injects the manifest link with the
 * runtime base path (GitHub Pages serves under /semperscribe,
 * cloud.gov at the root - getBasePath resolves both), and parks the
 * install prompt for the Settings install button. Renders nothing.
 *
 * DEV GUARD (defect fix 2026-07-15): the worker's cache-first asset
 * strategy is safe in production, where Next chunks are content-hashed
 * and immutable - but under `next dev`, chunk URLs are stable while
 * their contents change on every edit. A cache-first worker then
 * serves a stale module graph and the app throws "module factory is
 * not available". In development this component registers nothing,
 * actively unregisters any previously installed worker, and purges
 * the app's caches so already-poisoned browsers heal on next load.
 */

import { useEffect } from 'react';
import { getBasePath } from '@/lib/path-utils';
import { attachInstallPromptListener } from '@/lib/install-prompt';

export function ServiceWorkerRegister() {
  useEffect(() => {
    attachInstallPromptListener();

    const basePath = getBasePath();

    // Manifest link with the correct runtime prefix (harmless in dev).
    if (!document.querySelector('link[rel="manifest"]')) {
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = `${basePath}/manifest.webmanifest`;
      document.head.appendChild(link);
    }

    if (!('serviceWorker' in navigator)) return;

    if (process.env.NODE_ENV !== 'production') {
      // Dev: tear down any worker and purge our caches.
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => registrations.forEach((registration) => registration.unregister()))
        .catch(() => undefined);
      if ('caches' in window) {
        caches
          .keys()
          .then((keys) => keys.forEach((key) => {
            if (key.startsWith('semperscribe-')) void caches.delete(key);
          }))
          .catch(() => undefined);
      }
      return;
    }

    navigator.serviceWorker
      .register(`${basePath}/sw.js`)
      .catch((error) => console.error('Service worker registration failed', error));
  }, []);

  return null;
}
