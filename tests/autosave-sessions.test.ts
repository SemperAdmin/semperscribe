/**
 * P6-4 (remediation 2026-09) - per-tab autosave sessions.
 *
 * One working-copy key and one file owner id were shared by every tab,
 * so a second tab's Discard deleted the first tab's live enclosure bytes,
 * and a stale tab could overwrite a newer copy. The working copy is now
 * keyed by a per-tab session id (sessionStorage), the write-through file
 * owner id folds that id in, a write compares updatedAt before it lands,
 * and a keyless legacy copy migrates on first read.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import {
  getAutosaveSessionId,
  rotateAutosaveSession,
  writeWorkingCopy,
  readWorkingCopy,
  listWorkingCopies,
  clearWorkingCopy,
  subscribeWorkingCopyWrites,
  LEGACY_WORKING_COPY_KEY,
  LEGACY_SESSION_ID,
  AUTOSAVE_CHANNEL,
} from '@/lib/autosave';
import {
  openDb, filePut, fileLoadForDoc, fileDeleteForDoc, txDone,
  SETTINGS_STORE, WORKING_COPY_DOC_ID, workingCopyDocIdFor,
} from '@/lib/document-library';
import type { FormData, ParagraphData } from '@/types';

function slices(subj: string) {
  return {
    formData: { documentType: 'basic', subj } as unknown as FormData,
    paragraphs: [{ id: 1, level: 1, content: 'body', acronymError: '' }] as ParagraphData[],
    vias: [], references: [], enclosures: [], copyTos: [], distList: [],
  };
}

function pdf(fileId: string, docId: string) {
  return {
    fileId, docId, fileName: `${fileId}.pdf`, title: fileId,
    mimeType: 'application/pdf' as const,
    bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer, byteLength: 4,
  };
}

beforeEach(() => {
  indexedDB = new IDBFactory();
  sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('session id', () => {
  it('is minted once per tab and kept in sessionStorage', () => {
    const a = getAutosaveSessionId();
    expect(a).toMatch(/^[0-9a-f-]{36}$/);
    expect(getAutosaveSessionId()).toBe(a);
    expect(sessionStorage.getItem('semperscribe-autosave-session')).toBe(a);
  });

  it('rotates to a fresh id on demand', () => {
    const a = getAutosaveSessionId();
    const b = rotateAutosaveSession();
    expect(b).not.toBe(a);
    expect(getAutosaveSessionId()).toBe(b);
  });

  it('folds into the write-through file owner id', () => {
    expect(workingCopyDocIdFor('abc')).toBe(`${WORKING_COPY_DOC_ID}:abc`);
    // The pre-session copy owned its files under the bare id.
    expect(workingCopyDocIdFor(LEGACY_SESSION_ID)).toBe(WORKING_COPY_DOC_ID);
  });
});

describe('per-session working copies', () => {
  it('discarding one session leaves the other session\'s copy and files', async () => {
    const A = 'session-a';
    const B = 'session-b';
    expect((await writeWorkingCopy(slices('A'), { sessionId: A, lastWrittenAt: null })).ok).toBe(true);
    expect((await writeWorkingCopy(slices('B'), { sessionId: B, lastWrittenAt: null })).ok).toBe(true);
    await filePut(pdf('file-a', workingCopyDocIdFor(A)));
    await filePut(pdf('file-b', workingCopyDocIdFor(B)));

    const before = await listWorkingCopies();
    expect(before.map(c => c.sessionId).sort()).toEqual([A, B]);

    // Discard = the copy it shows plus that copy's files, nothing else.
    await clearWorkingCopy(A);
    await fileDeleteForDoc(workingCopyDocIdFor(A));

    const after = await listWorkingCopies();
    expect(after.map(c => c.sessionId)).toEqual([B]);
    expect(await readWorkingCopy(A)).toBeNull();
    expect((await readWorkingCopy(B))?.formData.subj).toBe('B');
    expect(await fileLoadForDoc(workingCopyDocIdFor(A))).toHaveLength(0);
    expect((await fileLoadForDoc(workingCopyDocIdFor(B))).map(f => f.fileId)).toEqual(['file-b']);
  });

  it('lists copies newest first', async () => {
    await writeWorkingCopy(slices('old'), { sessionId: 'old', lastWrittenAt: null });
    await new Promise(r => setTimeout(r, 5));
    await writeWorkingCopy(slices('new'), { sessionId: 'new', lastWrittenAt: null });
    const copies = await listWorkingCopies();
    expect(copies.map(c => c.sessionId)).toEqual(['new', 'old']);
    expect(copies[0].updatedAt).toBeGreaterThan(copies[1].updatedAt);
  });
});

describe('stale writes', () => {
  it('refuses a write whose last-known updatedAt is older than the stored copy', async () => {
    const S = 'shared-session';
    const first = await writeWorkingCopy(slices('tab1 v1'), { sessionId: S, lastWrittenAt: null });
    expect(first.ok).toBe(true);
    const tab1At = first.ok ? first.updatedAt : 0;

    // A duplicated tab (same sessionStorage) writes a newer copy.
    await new Promise(r => setTimeout(r, 5));
    const second = await writeWorkingCopy(slices('tab2 v2'), { sessionId: S, lastWrittenAt: null });
    expect(second.ok).toBe(true);
    const tab2At = second.ok ? second.updatedAt : 0;
    expect(tab2At).toBeGreaterThan(tab1At);

    // Tab 1 still believes its own write is the latest.
    const stale = await writeWorkingCopy(slices('tab1 v3'), { sessionId: S, lastWrittenAt: tab1At });
    expect(stale.ok).toBe(false);
    if (!stale.ok && stale.reason === 'stale') {
      expect(stale.newerUpdatedAt).toBe(tab2At);
    } else {
      throw new Error('expected a stale refusal');
    }
    expect((await readWorkingCopy(S))?.formData.subj).toBe('tab2 v2');

    // A writer that knows the newer stamp may proceed.
    const fresh = await writeWorkingCopy(slices('tab2 v4'), { sessionId: S, lastWrittenAt: tab2At });
    expect(fresh.ok).toBe(true);
    expect((await readWorkingCopy(S))?.formData.subj).toBe('tab2 v4');
  });

  it('announces each write on the autosave channel and delivers foreign ones to subscribers', async () => {
    const posted: unknown[] = [];
    const listeners: ((ev: { data: unknown }) => void)[] = [];
    class FakeChannel {
      name: string;
      onmessage: ((ev: { data: unknown }) => void) | null = null;
      constructor(name: string) { this.name = name; listeners.push((ev) => this.onmessage?.(ev)); }
      postMessage(data: unknown) { posted.push(data); }
      close() {}
    }
    vi.stubGlobal('BroadcastChannel', FakeChannel);

    const seen: { sessionId: string; updatedAt: number }[] = [];
    const unsubscribe = subscribeWorkingCopyWrites((msg) => seen.push({ sessionId: msg.sessionId, updatedAt: msg.updatedAt }));

    const r = await writeWorkingCopy(slices('x'), { sessionId: 'S', lastWrittenAt: null });
    expect(r.ok).toBe(true);
    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject({ sessionId: 'S', updatedAt: r.ok ? r.updatedAt : -1 });
    expect((posted[0] as { channel?: string }).channel ?? AUTOSAVE_CHANNEL).toBe(AUTOSAVE_CHANNEL);

    // A message from another tab reaches the subscriber; our own does not.
    for (const l of listeners) l({ data: posted[0] });
    expect(seen).toHaveLength(0);
    for (const l of listeners) l({ data: { sessionId: 'S', updatedAt: 999, tabId: 'other-tab' } });
    expect(seen).toEqual([{ sessionId: 'S', updatedAt: 999 }]);

    unsubscribe();
    vi.unstubAllGlobals();
  });
});

describe('legacy keyless copy', () => {
  it('migrates to the legacy session on first read and is offered like any other', async () => {
    const db = await openDb();
    const tx = db.transaction(SETTINGS_STORE, 'readwrite');
    tx.objectStore(SETTINGS_STORE).put({ ...slices('legacy work'), savedAt: '2026-09-01T10:00:00.000Z' }, LEGACY_WORKING_COPY_KEY);
    await txDone(tx);
    db.close();

    const copies = await listWorkingCopies();
    expect(copies).toHaveLength(1);
    expect(copies[0].sessionId).toBe(LEGACY_SESSION_ID);
    expect(copies[0].formData.subj).toBe('legacy work');
    expect(copies[0].updatedAt).toBe(Date.parse('2026-09-01T10:00:00.000Z'));

    // The keyless record is gone, so it is not migrated twice.
    const db2 = await openDb();
    const tx2 = db2.transaction(SETTINGS_STORE, 'readonly');
    const raw = await new Promise<unknown>((resolve) => {
      const req = tx2.objectStore(SETTINGS_STORE).get(LEGACY_WORKING_COPY_KEY);
      req.onsuccess = () => resolve(req.result);
    });
    db2.close();
    expect(raw).toBeUndefined();

    expect((await readWorkingCopy(LEGACY_SESSION_ID))?.formData.subj).toBe('legacy work');
    await clearWorkingCopy(LEGACY_SESSION_ID);
    expect(await listWorkingCopies()).toHaveLength(0);
  });
});
