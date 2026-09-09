/**
 * R3 (USER_DRIVEN_ROADMAP) - autosave working copy + crash recovery.
 *
 * A working-copy snapshot lives in the IndexedDB settings store (reusing
 * the P1.3 infrastructure). Debounced writes capture the live document;
 * on launch, a present working copy offers a restore. Cleared on explicit
 * Save Draft and Clear Form so it never resurrects intentionally
 * abandoned work.
 *
 * Distinct from the document library: the library holds documents the
 * user chose to keep; this holds the in-progress document so a crash or
 * accidental tab close costs nothing.
 *
 * P6-4 (remediation 2026-09): ONE COPY PER TAB SESSION. A single key and
 * a single file owner id were shared by every open tab, so tab B's
 * Discard deleted tab A's live enclosure bytes, and a stale tab could
 * overwrite a newer copy. Now:
 * - each tab mints a session id (sessionStorage, so it survives a
 *   reload of that tab and no other) and writes `workingCopy:<id>`;
 * - write-through files are owned by `working-copy:<id>`;
 * - a write compares the stored updatedAt with the writer's last known
 *   one and refuses to clobber a newer copy;
 * - writes are announced on a BroadcastChannel so a tab that shares a
 *   session id (a duplicated tab) learns it is stale before it writes;
 * - a keyless copy written before this scheme migrates on first read.
 */

import {
  openDb, txDone, SETTINGS_STORE,
  workingCopyDocIdFor, LEGACY_WORKING_COPY_SESSION_ID,
} from '@/lib/document-library';
import { FormData, ParagraphData } from '@/types';

/** The pre-session key. Migrated to `workingCopy:legacy` on first read. */
export const LEGACY_WORKING_COPY_KEY = 'workingCopy';
export const LEGACY_SESSION_ID = LEGACY_WORKING_COPY_SESSION_ID;
const WORKING_COPY_KEY_PREFIX = 'workingCopy:';
const SESSION_STORAGE_KEY = 'semperscribe-autosave-session';
export const AUTOSAVE_CHANNEL = 'semperscribe-autosave';

export interface WorkingCopy {
  /** P6-4: the tab session that wrote this copy. */
  sessionId: string;
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
  /** P6-4: capture time in ms; the stale-write comparison key. */
  updatedAt: number;
}

export type WorkingCopyInput = Omit<WorkingCopy, 'savedAt' | 'updatedAt' | 'sessionId'>;

export type WriteResult =
  | { ok: true; updatedAt: number }
  | { ok: false; reason: 'stale'; newerUpdatedAt: number }
  | { ok: false; reason: 'error' };

export interface WriteOptions {
  /** Defaults to this tab's session id. */
  sessionId?: string;
  /**
   * The updatedAt of this writer's own last write for the session, or
   * null when it has not written yet (a first write claims the slot).
   * A stored copy newer than this refuses the write.
   */
  lastWrittenAt?: number | null;
}

export interface WorkingCopyWriteMessage {
  sessionId: string;
  updatedAt: number;
  tabId: string;
}

// ---------------------------------------------------------------------------
// Session id
// ---------------------------------------------------------------------------

function randomId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** Identifies this document instance, not the session: a duplicated tab
 * copies sessionStorage and therefore the session id, but not this. */
const TAB_ID = randomId();

let memorySessionId: string | null = null;

function readStoredSessionId(): string | null {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(SESSION_STORAGE_KEY) : null;
  } catch {
    return null;
  }
}

function storeSessionId(id: string): void {
  memorySessionId = id;
  try {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(SESSION_STORAGE_KEY, id);
  } catch {
    // sessionStorage blocked: the in-memory id serves this tab's lifetime.
  }
}

/** This tab's autosave session id, minted on first use. */
export function getAutosaveSessionId(): string {
  const stored = readStoredSessionId();
  if (stored) {
    memorySessionId = stored;
    return stored;
  }
  if (memorySessionId) return memorySessionId;
  const id = randomId();
  storeSessionId(id);
  return id;
}

/**
 * Mints a fresh session id for this tab. Used when this tab learns that
 * another tab owns a newer copy under the same id (a duplicated tab), or
 * when the user keeps this tab's own last copy "for later": the old copy
 * stays under the old id, untouched, and this tab writes under the new.
 */
export function rotateAutosaveSession(): string {
  const id = randomId();
  storeSessionId(id);
  return id;
}

/** The write-through file owner id for this tab's working copy. */
export function currentWorkingCopyDocId(): string {
  return workingCopyDocIdFor(getAutosaveSessionId());
}

// ---------------------------------------------------------------------------
// Settings-store primitives
// ---------------------------------------------------------------------------

function keyFor(sessionId: string): string {
  return `${WORKING_COPY_KEY_PREFIX}${sessionId}`;
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

async function settingsGetPrefixed<T>(prefix: string): Promise<T[]> {
  const db = await openDb();
  try {
    const tx = db.transaction(SETTINGS_STORE, 'readonly');
    const store = tx.objectStore(SETTINGS_STORE);
    return await new Promise<T[]>((resolve, reject) => {
      const req = store.getAll(IDBKeyRange.bound(prefix, `${prefix}\uffff`));
      req.onsuccess = () => resolve((req.result ?? []) as T[]);
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

// ---------------------------------------------------------------------------
// Legacy migration
// ---------------------------------------------------------------------------

type LegacyWorkingCopy = Omit<WorkingCopy, 'sessionId' | 'updatedAt'> & { sessionId?: string; updatedAt?: number };

/**
 * Moves a keyless (pre-session) copy under the legacy session id, once.
 * Its files stay where they are: workingCopyDocIdFor('legacy') is the
 * bare owner id they were written under.
 */
async function migrateLegacyCopy(): Promise<void> {
  const legacy = await settingsGet<LegacyWorkingCopy>(LEGACY_WORKING_COPY_KEY);
  if (!legacy) return;
  const parsed = Date.parse(legacy.savedAt ?? '');
  const migrated: WorkingCopy = {
    ...legacy,
    sessionId: LEGACY_SESSION_ID,
    savedAt: legacy.savedAt ?? new Date(0).toISOString(),
    updatedAt: Number.isNaN(parsed) ? 0 : parsed,
  };
  // Never overwrite a copy already migrated (a second tab got there first).
  const existing = await settingsGet<WorkingCopy>(keyFor(LEGACY_SESSION_ID));
  if (!existing || (existing.updatedAt ?? 0) < migrated.updatedAt) {
    await settingsPut(keyFor(LEGACY_SESSION_ID), migrated);
  }
  await settingsDelete(LEGACY_WORKING_COPY_KEY);
}

// ---------------------------------------------------------------------------
// BroadcastChannel
// ---------------------------------------------------------------------------

type ChannelLike = {
  postMessage: (data: unknown) => void;
  close: () => void;
  onmessage: ((ev: { data: unknown }) => void) | null;
};

function openChannel(): ChannelLike | null {
  try {
    const Ctor = (globalThis as { BroadcastChannel?: new (name: string) => ChannelLike }).BroadcastChannel;
    return Ctor ? new Ctor(AUTOSAVE_CHANNEL) : null;
  } catch {
    return null;
  }
}

function announce(msg: WorkingCopyWriteMessage): void {
  const channel = openChannel();
  if (!channel) return;
  try {
    channel.postMessage({ channel: AUTOSAVE_CHANNEL, ...msg });
  } catch {
    // Announcing is best-effort; the updatedAt comparison still guards.
  } finally {
    try { channel.close(); } catch { /* closed already */ }
  }
}

function isWriteMessage(data: unknown): data is WorkingCopyWriteMessage {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return typeof d.sessionId === 'string' && typeof d.updatedAt === 'number' && typeof d.tabId === 'string';
}

/**
 * Delivers other tabs' working-copy writes. This tab's own writes are
 * filtered out. Returns the unsubscribe function.
 */
export function subscribeWorkingCopyWrites(
  onWrite: (msg: WorkingCopyWriteMessage) => void,
): () => void {
  const channel = openChannel();
  if (!channel) return () => {};
  channel.onmessage = (ev) => {
    const data = ev?.data;
    if (!isWriteMessage(data) || data.tabId === TAB_ID) return;
    onWrite(data);
  };
  return () => {
    channel.onmessage = null;
    try { channel.close(); } catch { /* closed already */ }
  };
}

// ---------------------------------------------------------------------------
// Working-copy API
// ---------------------------------------------------------------------------

/**
 * Writes the working copy for a session. Refuses (`reason: 'stale'`)
 * when the stored copy is newer than the writer's last own write, so a
 * tab holding an older copy of the same session never clobbers a newer
 * one. Silent on storage errors - autosave never interrupts.
 */
export async function writeWorkingCopy(
  copy: WorkingCopyInput,
  options: WriteOptions = {},
): Promise<WriteResult> {
  const sessionId = options.sessionId ?? getAutosaveSessionId();
  const lastWrittenAt = options.lastWrittenAt ?? null;
  try {
    const stored = await settingsGet<WorkingCopy>(keyFor(sessionId));
    const storedAt = stored?.updatedAt ?? null;
    if (storedAt !== null && lastWrittenAt !== null && storedAt > lastWrittenAt) {
      return { ok: false, reason: 'stale', newerUpdatedAt: storedAt };
    }
    // Monotonic within a session, even on a coarse clock.
    const updatedAt = Math.max(Date.now(), (storedAt ?? 0) + 1, (lastWrittenAt ?? 0) + 1);
    const record: WorkingCopy = {
      ...copy,
      sessionId,
      savedAt: new Date(updatedAt).toISOString(),
      updatedAt,
    };
    await settingsPut(keyFor(sessionId), record);
    announce({ sessionId, updatedAt, tabId: TAB_ID });
    return { ok: true, updatedAt };
  } catch (error) {
    console.error('Autosave failed', error);
    return { ok: false, reason: 'error' };
  }
}

/** Reads one session's working copy (this tab's by default), or null. */
export async function readWorkingCopy(sessionId: string = getAutosaveSessionId()): Promise<WorkingCopy | null> {
  try {
    await migrateLegacyCopy();
    return await settingsGet<WorkingCopy>(keyFor(sessionId));
  } catch {
    return null;
  }
}

/** Every session's working copy, newest first. Migrates a legacy copy. */
export async function listWorkingCopies(): Promise<WorkingCopy[]> {
  try {
    await migrateLegacyCopy();
    const copies = await settingsGetPrefixed<WorkingCopy>(WORKING_COPY_KEY_PREFIX);
    return copies
      .filter((c) => c && typeof c === 'object')
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  } catch {
    return [];
  }
}

/** Clears one session's working copy (explicit save, clear form, discard). */
export async function clearWorkingCopy(sessionId: string = getAutosaveSessionId()): Promise<void> {
  try {
    await settingsDelete(keyFor(sessionId));
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
