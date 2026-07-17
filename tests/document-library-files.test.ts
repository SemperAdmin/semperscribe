/**
 * ENC (docs/ENCLOSURE_UPLOAD_PLAN.md) - enclosure file store, DB v3.
 *
 * The invariants worth paying for:
 * - cascade: deleting a document deletes its files in the SAME
 *   transaction (no orphan bytes),
 * - re-parent: Save moves files from the working-copy id to the saved
 *   id atomically,
 * - upgrade: a v2 database (documents + settings only) upgrades to v3
 *   without losing documents.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import {
  openDb,
  libPut,
  libDelete,
  libClear,
  libLoadAll,
  filePut,
  fileDelete,
  fileLoadForDoc,
  fileDeleteForDoc,
  fileReparent,
  FILES_STORE,
  StoredEnclosureFile,
} from '@/lib/document-library';
import type { SavedLetter } from '@/types';

function makeLetter(id: string): SavedLetter {
  return {
    id,
    savedAt: 'x',
    updatedAt: '2026-07-16T00:00:00.000Z',
    documentType: 'basic',
    vias: [], references: [], enclosures: [], copyTos: [], paragraphs: [],
  } as unknown as SavedLetter;
}

function makeFile(fileId: string, docId: string): StoredEnclosureFile {
  return {
    fileId,
    docId,
    fileName: `${fileId}.pdf`,
    title: fileId,
    mimeType: 'application/pdf',
    bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer, // %PDF
    byteLength: 4,
  };
}

beforeEach(() => {
  // Fresh database per test - fake-indexeddb persists per factory.
  indexedDB = new IDBFactory();
});

describe('DB v3 schema', () => {
  it('creates the enclosureFiles store with a docId index', async () => {
    const db = await openDb();
    expect(Array.from(db.objectStoreNames)).toContain(FILES_STORE);
    const tx = db.transaction(FILES_STORE, 'readonly');
    expect(Array.from(tx.objectStore(FILES_STORE).indexNames)).toContain('docId');
    db.close();
  });

  it('upgrades a v2 database without losing documents', async () => {
    // Build a v2-shaped database by hand.
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('semperscribe', 2);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('documents', { keyPath: 'id' });
        req.result.createObjectStore('settings');
      };
      req.onsuccess = () => {
        const tx = req.result.transaction('documents', 'readwrite');
        tx.objectStore('documents').put(makeLetter('legacy-1'));
        tx.oncomplete = () => { req.result.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });

    // openDb runs the v2 -> v3 upgrade.
    const letters = await libLoadAll();
    expect(letters.map((l) => l.id)).toEqual(['legacy-1']);
    const db = await openDb();
    expect(Array.from(db.objectStoreNames)).toContain(FILES_STORE);
    db.close();
  });
});

describe('file CRUD', () => {
  it('round-trips a file with its bytes', async () => {
    await filePut(makeFile('f1', 'doc-a'));
    const files = await fileLoadForDoc('doc-a');
    expect(files).toHaveLength(1);
    expect(files[0].fileName).toBe('f1.pdf');
    expect(new Uint8Array(files[0].bytes)[0]).toBe(0x25);
  });

  it('loads only the owning document\'s files', async () => {
    await filePut(makeFile('f1', 'doc-a'));
    await filePut(makeFile('f2', 'doc-b'));
    expect(await fileLoadForDoc('doc-a')).toHaveLength(1);
    expect(await fileLoadForDoc('doc-b')).toHaveLength(1);
    expect(await fileLoadForDoc('doc-c')).toHaveLength(0);
  });

  it('deletes one file by id', async () => {
    await filePut(makeFile('f1', 'doc-a'));
    await filePut(makeFile('f2', 'doc-a'));
    await fileDelete('f1');
    const files = await fileLoadForDoc('doc-a');
    expect(files.map((f) => f.fileId)).toEqual(['f2']);
  });

  it('deletes all files for a document', async () => {
    await filePut(makeFile('f1', 'doc-a'));
    await filePut(makeFile('f2', 'doc-a'));
    await filePut(makeFile('f3', 'doc-b'));
    await fileDeleteForDoc('doc-a');
    expect(await fileLoadForDoc('doc-a')).toHaveLength(0);
    expect(await fileLoadForDoc('doc-b')).toHaveLength(1);
  });
});

describe('cascade delete', () => {
  it('libDelete removes the document AND its files', async () => {
    await libPut(makeLetter('doc-a'));
    await filePut(makeFile('f1', 'doc-a'));
    await filePut(makeFile('f2', 'doc-a'));
    await libDelete('doc-a');
    expect(await libLoadAll()).toHaveLength(0);
    expect(await fileLoadForDoc('doc-a')).toHaveLength(0);
  });

  it('libDelete leaves other documents\' files alone', async () => {
    await libPut(makeLetter('doc-a'));
    await libPut(makeLetter('doc-b'));
    await filePut(makeFile('f1', 'doc-a'));
    await filePut(makeFile('f2', 'doc-b'));
    await libDelete('doc-a');
    expect(await fileLoadForDoc('doc-b')).toHaveLength(1);
  });

  it('libClear removes all files too', async () => {
    await libPut(makeLetter('doc-a'));
    await filePut(makeFile('f1', 'doc-a'));
    await libClear();
    expect(await fileLoadForDoc('doc-a')).toHaveLength(0);
  });
});

describe('fileReparent', () => {
  it('moves every file to the new owner', async () => {
    await filePut(makeFile('f1', 'working-copy'));
    await filePut(makeFile('f2', 'working-copy'));
    await fileReparent('working-copy', 'doc-saved');
    expect(await fileLoadForDoc('working-copy')).toHaveLength(0);
    const moved = await fileLoadForDoc('doc-saved');
    expect(moved.map((f) => f.fileId).sort()).toEqual(['f1', 'f2']);
  });

  it('no-ops when source and target match', async () => {
    await filePut(makeFile('f1', 'doc-a'));
    await fileReparent('doc-a', 'doc-a');
    expect(await fileLoadForDoc('doc-a')).toHaveLength(1);
  });

  it('does not touch files owned by others', async () => {
    await filePut(makeFile('f1', 'working-copy'));
    await filePut(makeFile('f2', 'doc-other'));
    await fileReparent('working-copy', 'doc-saved');
    expect(await fileLoadForDoc('doc-other')).toHaveLength(1);
  });
});
