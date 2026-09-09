/**
 * P6-11 (remediation 2026-09): openDb had no onblocked and no
 * onversionchange. A newer deploy's schema upgrade in another tab was
 * blocked forever by this tab's open connection, and this tab never
 * learned it should reload. Now an open blocked by another tab rejects
 * with a toast-able error, and a versionchange closes the connection
 * and sets a flag the Save path reports as "Reload the app".
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import {
  openDb,
  libPut,
  isReloadRequired,
  RELOAD_REQUIRED_MESSAGE,
  resetReloadRequiredForTests,
} from '@/lib/document-library';
import type { SavedLetter } from '@/types';

beforeEach(() => {
  indexedDB = new IDBFactory();
  resetReloadRequiredForTests();
});

function tick(): Promise<void> {
  return new Promise((r) => setTimeout(r, 10));
}

describe('openDb (P6-11)', () => {
  it('closes and flags reload-required when another connection bumps the version', async () => {
    const db = await openDb();
    expect(isReloadRequired()).toBe(false);
    // A newer deploy opens the database at a higher version.
    const upgrade = indexedDB.open('semperscribe', 99);
    await new Promise<void>((resolve, reject) => {
      upgrade.onsuccess = () => { upgrade.result.close(); resolve(); };
      upgrade.onerror = () => reject(upgrade.error);
      upgrade.onblocked = () => reject(new Error('blocked: the old connection did not close'));
    });
    await tick();
    expect(isReloadRequired()).toBe(true);
    // The old connection is closed: a transaction on it throws.
    expect(() => db.transaction('documents', 'readonly')).toThrow();
  });

  it('a Save after the flag is set reports "Reload the app"', async () => {
    await openDb();
    const upgrade = indexedDB.open('semperscribe', 99);
    await new Promise<void>((resolve) => { upgrade.onsuccess = () => { upgrade.result.close(); resolve(); }; });
    await tick();
    await expect(libPut({ id: 'x', savedAt: 'x', documentType: 'basic' } as unknown as SavedLetter))
      .rejects.toThrow(RELOAD_REQUIRED_MESSAGE);
    expect(RELOAD_REQUIRED_MESSAGE).toMatch(/Reload the app/);
  });

  it('rejects instead of hanging when the open is blocked by an old connection', async () => {
    // A stale connection at a lower version that never answers versionchange.
    const stale = indexedDB.open('semperscribe', 1);
    const staleDb = await new Promise<IDBDatabase>((resolve) => { stale.onsuccess = () => resolve(stale.result); });
    staleDb.onversionchange = () => { /* ignores it, keeping the open blocked */ };
    await expect(openDb()).rejects.toThrow(/another tab/i);
    staleDb.close();
  });
});
