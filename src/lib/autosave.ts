/**
 * R3 (USER_DRIVEN_ROADMAP) - autosave working copy + crash recovery.
 *
 * A single working-copy snapshot lives in the IndexedDB settings store
 * (reusing the P1.3 infrastructure). Debounced writes capture the live
 * document; on launch, a present working copy that is newer than the
 * last explicit save offers a restore. Cleared on explicit Save Draft
 * and Clear Form so it never resurrects intentionally abandoned work.
 *
 * Distinct from the document library: the library holds documents the
 * user chose to keep; this holds the ONE in-progress document so a
 * crash or accidental tab close costs nothing.
 */

import { openDb, txDone, SETTINGS_STORE } from '@/lib/document-library';
import { FormData, ParagraphData } from '@/types';

const WORKING_COPY_KEY = 'workingCopy';

export interface WorkingCopy {
  formData: FormData;
  paragraphs: ParagraphData[];
  vias: string[];
  references: string[];
  enclosures: string[];
  copyTos: string[];
  distList: string[];
  /** ENC: enclosure rows with file bindings. Bytes live in the
   * enclosureFiles store (write-through), so recovery re-hydrates. */
  enclosureBindings?: { key: string; title: string; fileId?: string }[];
  /** ISO timestamp of capture. */
  savedAt: string;
}

async function settingsGet<T>(key: string): Promise<T | null> {
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

async function settingsPut(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(SETTINGS_STORE, 'readwrite');
    tx.objectStore(SETTINGS_STORE).put(value, key);
    await txDone(tx);
  } finally {
    db.close();
  }
}

async function settingsDelete(key: string): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(SETTINGS_STORE, 'readwrite');
    tx.objectStore(SETTINGS_STORE).delete(key);
    await txDone(tx);
  } finally {
    db.close();
  }
}

/** Writes the working copy. Silent - autosave never interrupts. */
export async function writeWorkingCopy(copy: Omit<WorkingCopy, 'savedAt'>): Promise<void> {
  try {
    await settingsPut(WORKING_COPY_KEY, { ...copy, savedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Autosave failed', error);
  }
}

/** Reads the working copy, or null. */
export async function readWorkingCopy(): Promise<WorkingCopy | null> {
  try {
    return await settingsGet<WorkingCopy>(WORKING_COPY_KEY);
  } catch {
    return null;
  }
}

/** Clears the working copy (explicit save or clear form). */
export async function clearWorkingCopy(): Promise<void> {
  try {
    await settingsDelete(WORKING_COPY_KEY);
  } catch (error) {
    console.error('Failed to clear working copy', error);
  }
}

/**
 * True when a working copy is worth offering: it exists and carries
 * real content (a document type plus at least one non-empty field).
 */
export function isRecoverable(copy: WorkingCopy | null): copy is WorkingCopy {
  if (!copy) return false;
  if (!copy.formData?.documentType) return false;
  const hasSubject = Boolean((copy.formData.subj ?? '').trim());
  const hasBody = (copy.paragraphs ?? []).some((p) => p.content.trim());
  const hasParties = Boolean((copy.formData.from ?? '').trim() || (copy.formData.to ?? '').trim());
  return hasSubject || hasBody || hasParties;
}
