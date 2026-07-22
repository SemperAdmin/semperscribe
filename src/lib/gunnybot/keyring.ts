import type { GunnyProviderId } from './types';

/**
 * Session-only API key store. Keys live in memory and mirror to
 * sessionStorage so a reload inside the same tab keeps them. Nothing
 * touches localStorage. Everything clears when the tab closes.
 */

const memoryKeys = new Map<GunnyProviderId, string>();

const STORAGE_PREFIX = 'gunnybot-key-';

function storageKey(provider: GunnyProviderId): string {
  return STORAGE_PREFIX + provider;
}

function hasSessionStorage(): boolean {
  try {
    return typeof sessionStorage !== 'undefined';
  } catch {
    return false;
  }
}

export function setKey(provider: GunnyProviderId, key: string): void {
  memoryKeys.set(provider, key);
  if (hasSessionStorage()) {
    try {
      sessionStorage.setItem(storageKey(provider), key);
    } catch {
      // A sessionStorage write failure falls back to memory only.
    }
  }
}

export function getKey(provider: GunnyProviderId): string | null {
  const inMemory = memoryKeys.get(provider);
  if (inMemory !== undefined) {
    return inMemory;
  }
  if (hasSessionStorage()) {
    try {
      const stored = sessionStorage.getItem(storageKey(provider));
      if (stored !== null) {
        memoryKeys.set(provider, stored);
        return stored;
      }
    } catch {
      return null;
    }
  }
  return null;
}

export function hasKey(provider: GunnyProviderId): boolean {
  return getKey(provider) !== null;
}

export function clearKey(provider: GunnyProviderId): void {
  memoryKeys.delete(provider);
  if (hasSessionStorage()) {
    try {
      sessionStorage.removeItem(storageKey(provider));
    } catch {
      // Ignore a removal failure. Memory is already cleared.
    }
  }
}

export function clearAllKeys(): void {
  const providers = Array.from(memoryKeys.keys());
  for (const provider of providers) {
    clearKey(provider);
  }
}
