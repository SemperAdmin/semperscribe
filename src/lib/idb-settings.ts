/**
 * Shared IndexedDB settings-store accessors.
 *
 * Extracted from lib/auto-backup.ts so the backup folder and the EDMS drop
 * folder use one implementation of the plumbing rather than two copies that
 * drift. Both store a FileSystemDirectoryHandle, which is structured-
 * cloneable and therefore survives IndexedDB but not localStorage.
 */

import { openDb, txDone, SETTINGS_STORE } from '@/lib/document-library';

export async function settingsGet<T>(key: string): Promise<T | null> {
  const db = await openDb();
  try {
    const tx = db.transaction(SETTINGS_STORE, 'readonly');
    const store = tx.objectStore(SETTINGS_STORE);
    return await new Promise<T | null>((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB read failed'));
    });
  } finally {
    db.close();
  }
}

export async function settingsPut(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(SETTINGS_STORE, 'readwrite');
    tx.objectStore(SETTINGS_STORE).put(value, key);
    await txDone(tx);
  } finally {
    db.close();
  }
}

export async function settingsDelete(key: string): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(SETTINGS_STORE, 'readwrite');
    tx.objectStore(SETTINGS_STORE).delete(key);
    await txDone(tx);
  } finally {
    db.close();
  }
}

/** Minimal ambient types. showDirectoryPicker and the handle permission
 *  API are not in lib.dom yet. Shared by both folder features. */
export interface DirectoryPickerWindow {
  showDirectoryPicker?: (options?: { id?: string; mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
}

export interface PermissionCapableHandle extends FileSystemDirectoryHandle {
  queryPermission?: (descriptor: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (descriptor: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
}

export function isDirectoryPickerSupported(): boolean {
  return typeof window !== 'undefined'
    && typeof (window as DirectoryPickerWindow).showDirectoryPicker === 'function';
}
