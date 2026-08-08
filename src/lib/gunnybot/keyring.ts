import type { GunnyProviderId } from './types';

/**
 * Memory-only API key store. Keys never touch sessionStorage or
 * localStorage: web storage is readable by any script that reaches the
 * origin, and provider API keys are the one real secret this app holds.
 * The deliberate cost is that a reload forgets the key and the user
 * re-enters it. Everything clears when the tab closes.
 */

const memoryKeys = new Map<GunnyProviderId, string>();

/**
 * Prefix used by earlier versions that mirrored keys to sessionStorage.
 * Purged on module load so a cleartext key written before the upgrade
 * does not linger for the rest of the tab's life.
 */
const LEGACY_STORAGE_PREFIX = 'gunnybot-key-';

function purgeLegacyStorage(): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(LEGACY_STORAGE_PREFIX)) {
        sessionStorage.removeItem(key);
      }
    }
  } catch {
    // Storage unavailable (static-export prerender) — nothing to purge.
  }
}

purgeLegacyStorage();

export function setKey(provider: GunnyProviderId, key: string): void {
  memoryKeys.set(provider, key);
}

export function getKey(provider: GunnyProviderId): string | null {
  return memoryKeys.get(provider) ?? null;
}

export function hasKey(provider: GunnyProviderId): boolean {
  return memoryKeys.has(provider);
}

export function clearKey(provider: GunnyProviderId): void {
  memoryKeys.delete(provider);
}

export function clearAllKeys(): void {
  memoryKeys.clear();
}
