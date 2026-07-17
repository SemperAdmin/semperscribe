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
const DB_VERSION = 3;
const STORE = 'documents';
/** P1.3: key-value store for the backup folder handle and app settings. */
export const SETTINGS_STORE = 'settings';
/** ENC (ENCLOSURE_UPLOAD_PLAN): binary enclosure files, keyed by fileId. */
export const FILES_STORE = 'enclosureFiles';
/** ENC: per-file size cap. Oversized files are refused at attach time. */
export const MAX_ENCLOSURE_FILE_BYTES = 25 * 1024 * 1024;
/**
 * ENC: owner id for files attached before the first Save. Write-through
 * targets this id; Save re-parents to the saved document id.
 */
export const WORKING_COPY_DOC_ID = 'working-copy';

/**
 * ENC: a stored enclosure file. Bytes live here - NOT inside the
 * SavedLetter record - so libLoadAll never pulls binaries into memory.
 */
export interface StoredEnclosureFile {
  fileId: string;
  /** Owning document id (or the autosave working-copy id pre-save). */
  docId: string;
  fileName: string;
  title: string;
  mimeType: 'application/pdf' | 'image/jpeg' | 'image/png';
  bytes: ArrayBuffer;
  byteLength: number;
}

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
      // v3 (ENC): binary enclosure files. The docId index powers
      // cascade delete and load-by-document.
      if (!db.objectStoreNames.contains(FILES_STORE)) {
        const files = db.createObjectStore(FILES_STORE, { keyPath: 'fileId' });
        files.createIndex('docId', 'docId', { unique: false });
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
    // One transaction: the document and its files go together, so a
    // failure leaves both or neither - no orphan bytes.
    const tx = db.transaction([STORE, FILES_STORE], 'readwrite');
    tx.objectStore(STORE).delete(id);
    deleteFilesInTx(tx, id);
    await txDone(tx);
  } finally {
    db.close();
  }
}

export async function libClear(): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction([STORE, FILES_STORE], 'readwrite');
    tx.objectStore(STORE).clear();
    tx.objectStore(FILES_STORE).clear();
    await txDone(tx);
  } finally {
    db.close();
  }
}

// ---------------------------------------------------------------------------
// ENC (ENCLOSURE_UPLOAD_PLAN) - enclosure file CRUD
// ---------------------------------------------------------------------------

/** Deletes every file owned by docId, inside an open readwrite tx. */
function deleteFilesInTx(tx: IDBTransaction, docId: string): void {
  const index = tx.objectStore(FILES_STORE).index('docId');
  const cursorReq = index.openKeyCursor(IDBKeyRange.only(docId));
  cursorReq.onsuccess = () => {
    const cursor = cursorReq.result;
    if (cursor) {
      tx.objectStore(FILES_STORE).delete(cursor.primaryKey);
      cursor.continue();
    }
  };
}

/** Inserts or replaces a file record. Throws on quota exhaustion. */
export async function filePut(record: StoredEnclosureFile): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(FILES_STORE, 'readwrite');
    tx.objectStore(FILES_STORE).put(record);
    await txDone(tx);
  } finally {
    db.close();
  }
}

/** Loads every file owned by a document. */
export async function fileLoadForDoc(docId: string): Promise<StoredEnclosureFile[]> {
  const db = await openDb();
  try {
    const tx = db.transaction(FILES_STORE, 'readonly');
    const index = tx.objectStore(FILES_STORE).index('docId');
    return await new Promise<StoredEnclosureFile[]>((resolve, reject) => {
      const req = index.getAll(IDBKeyRange.only(docId));
      req.onsuccess = () => resolve((req.result ?? []) as StoredEnclosureFile[]);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB read failed'));
    });
  } finally {
    db.close();
  }
}

/** Deletes one file by id. */
export async function fileDelete(fileId: string): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(FILES_STORE, 'readwrite');
    tx.objectStore(FILES_STORE).delete(fileId);
    await txDone(tx);
  } finally {
    db.close();
  }
}

/** Loads one file by id, or null. Hydration resolves by fileId, not
 * owner - sibling saves of one session share bytes. */
export async function fileGet(fileId: string): Promise<StoredEnclosureFile | null> {
  const db = await openDb();
  try {
    const tx = db.transaction(FILES_STORE, 'readonly');
    return await new Promise<StoredEnclosureFile | null>((resolve, reject) => {
      const req = tx.objectStore(FILES_STORE).get(fileId);
      req.onsuccess = () => resolve((req.result as StoredEnclosureFile | undefined) ?? null);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB read failed'));
    });
  } finally {
    db.close();
  }
}

/**
 * Deletes a file only when the given docId owns it. Unbinding in a
 * session must not destroy bytes a SAVED document still references -
 * those fall to that document's own cascade delete.
 */
export async function fileDeleteIfOwnedBy(fileId: string, docId: string): Promise<void> {
  const record = await fileGet(fileId);
  if (record && record.docId === docId) await fileDelete(fileId);
}

/**
 * Re-points the given files to a new owner (Save: ownership follows
 * the latest save). One transaction - all move or none do.
 */
export async function fileReparentByIds(fileIds: string[], toDocId: string): Promise<void> {
  if (fileIds.length === 0) return;
  const db = await openDb();
  try {
    const tx = db.transaction(FILES_STORE, 'readwrite');
    const store = tx.objectStore(FILES_STORE);
    for (const fileId of fileIds) {
      const req = store.get(fileId);
      req.onsuccess = () => {
        const record = req.result as StoredEnclosureFile | undefined;
        if (record && record.docId !== toDocId) store.put({ ...record, docId: toDocId });
      };
    }
    await txDone(tx);
  } finally {
    db.close();
  }
}

/** Deletes every file owned by a document. */
export async function fileDeleteForDoc(docId: string): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(FILES_STORE, 'readwrite');
    deleteFilesInTx(tx, docId);
    await txDone(tx);
  } finally {
    db.close();
  }
}

/**
 * Re-points every file from one owner to another, atomically. Runs at
 * Save: files attached under the working-copy id move to the saved
 * document id. A crash mid-save leaves all files under one owner or
 * the other, never split.
 */
export async function fileReparent(fromDocId: string, toDocId: string): Promise<void> {
  if (fromDocId === toDocId) return;
  const db = await openDb();
  try {
    const tx = db.transaction(FILES_STORE, 'readwrite');
    const store = tx.objectStore(FILES_STORE);
    const index = store.index('docId');
    const cursorReq = index.openCursor(IDBKeyRange.only(fromDocId));
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        store.put({ ...(cursor.value as StoredEnclosureFile), docId: toDocId });
        cursor.continue();
      }
    };
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
