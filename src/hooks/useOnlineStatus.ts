'use client';

import { useSyncExternalStore } from 'react';

/**
 * Whether the browser reports a network connection (spec 7). This reads
 * navigator.onLine only: it says a network exists, not that MarineNet
 * is reachable. Probing reachability would be a network call from the
 * app, which the how-to videos design forbids.
 */
function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}
