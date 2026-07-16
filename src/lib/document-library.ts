/**
 * P1.2 (DONDOCS_PARITY_PLAN) - IndexedDB document library.
 *
 * Replaces the 10-slot localStorage draft list as the store of record
 * for saved documents. No eviction: capacity is bounded by browser
 * quota, and a failed write surfaces as an error instead of silent
 * oldest-first data loss.
 *
 * Migration: the legacy `navalLetters` localStorage key is imported
 * once (guarded by a flag) and then LEFT IN PLACE for rollback. The
 * legacy key stops receiving new writes.
 */

import { SavedLetter } from '@/types';

const DB_NAME = 'semperscribe';
const DB_VERSION = 2;
const STORE = 'documents';
/** P1.3: key-value store for the backup folder handle and app settings. */
export const SETTINGS_STORE = 'settings';

/** localStorage flag guarding the one-time legacy import. */
export const LIBRARY_MIGRATED_KEY = 'semperscribe-library-migrated';

export function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
}

export function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

/** Loads every saved document, newest first. */
export async function libLoadAll(): Promise<SavedLetter[]> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const letters = await new Promise<SavedLetter[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result ?? []) as SavedLetter[]);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB read failed'));
    });
    return letters.sort((a, b) => sortStamp(b).localeCompare(sortStamp(a)));
  } finally {
    db.close();
  }
}

/** Best sortable timestamp a letter carries. */
function sortStamp(letter: SavedLetter): string {
  // updatedAt is ISO; id is ISO for letters saved since the id scheme
  // began; savedAt is a locale string (legacy) and sorts poorly - last.
  return letter.updatedAt ?? (looksIso(letter.id) ? letter.id : letter.savedAt);
}

function looksIso(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T/.test(value);
}

/** Inserts or replaces a document. Throws on quota exhaustion. */
export async function libPut(letter: SavedLetter): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(letter);
    await txDone(tx);
  } finally {
    db.close();
  }
}

export async function libDelete(id: string): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    await txDone(tx);
  } finally {
    db.close();
  }
}

export async function libClear(): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    await txDone(tx);
  } finally {
    db.close();
  }
}

/**
 * One-time import of the legacy localStorage drafts. Returns the
 * number of documents imported (0 when already migrated or none
 * exist). The legacy key is not deleted - rollback stays possible.
 */
export async function migrateLegacyDrafts(legacyLetters: SavedLetter[]): Promise<number> {
  try {
    if (localStorage.getItem(LIBRARY_MIGRATED_KEY) === 'true') return 0;
  } catch {
    return 0;
  }
  if (legacyLetters.length > 0) {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      for (const letter of legacyLetters) store.put(letter);
      await txDone(tx);
    } finally {
      db.close();
    }
  }
  try {
    localStorage.setItem(LIBRARY_MIGRATED_KEY, 'true');
  } catch {
    // Flag write failure means the import may repeat - puts are
    // keyed by id, so a repeat is idempotent.
  }
  return legacyLetters.length;
}
