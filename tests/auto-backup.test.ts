/**
 * P3-3 and P6-16 (remediation 2026-09) - the backup folder.
 *
 * - P6-16: a failed File System Access write left a zero-byte file
 *   behind; the writable is now aborted before the error propagates.
 * - P3-3: the folder never pruned (every save added a file forever),
 *   deleting a library document left its snapshots behind, and the
 *   "nothing leaves the machine" claim ignored synced folders. The
 *   newest five snapshots per document survive a write, libDelete
 *   removes a document's snapshots through a hook the library calls,
 *   and a folder named for a sync client carries a warning.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { libPut, libDelete, libLoadAll } from '@/lib/document-library';

// A directory handle is structured-cloneable in a browser; the fake
// below is not, so the settings store is an in-memory map here.
const settings = new Map<string, unknown>();
vi.mock('@/lib/idb-settings', () => ({
  settingsGet: async (key: string) => settings.get(key) ?? null,
  settingsPut: async (key: string, value: unknown) => { settings.set(key, value); },
  settingsDelete: async (key: string) => { settings.delete(key); },
  isDirectoryPickerSupported: () => true,
}));
const settingsPut = async (key: string, value: unknown) => { settings.set(key, value); };
import {
  backupDocument,
  deleteBackupsFor,
  syncFolderWarning,
  getBackupStatus,
  BACKUP_KEEP,
} from '@/lib/auto-backup';
import type { SavedLetter } from '@/types';

interface FakeFile { content: string; failWrite?: boolean }

/** An in-memory FileSystemDirectoryHandle: enough surface for the backup code. */
function fakeDir(name: string) {
  const files = new Map<string, FakeFile>();
  const aborted: string[] = [];
  const failNext = { write: false };
  const dir = {
    kind: 'directory',
    name,
    queryPermission: async () => 'granted' as PermissionState,
    getFileHandle: async (fileName: string, opts?: { create?: boolean }) => {
      if (!files.has(fileName)) {
        if (!opts?.create) throw new Error('NotFoundError');
        files.set(fileName, { content: '' });
      }
      return {
        kind: 'file',
        name: fileName,
        createWritable: async () => {
          let buffer = '';
          return {
            write: async (data: string) => {
              if (failNext.write) { failNext.write = false; throw new Error('disk full'); }
              buffer += data;
            },
            close: async () => { files.set(fileName, { content: buffer }); },
            abort: async () => { aborted.push(fileName); files.delete(fileName); },
          };
        },
      };
    },
    removeEntry: async (fileName: string) => { files.delete(fileName); },
    keys: async function* () { for (const k of Array.from(files.keys())) yield k; },
  };
  return { dir: dir as unknown as FileSystemDirectoryHandle, files, aborted, failNext };
}

function letter(id: string, name: string, updatedAt: string): SavedLetter {
  return {
    id, name, subj: name, savedAt: 'x', updatedAt, documentType: 'basic',
    vias: [], references: [], enclosures: [], copyTos: [], paragraphs: [],
  } as unknown as SavedLetter;
}

const stamp = (n: number) => `2026-09-07T10:${String(n).padStart(2, '0')}:00.000Z`;

beforeEach(() => {
  indexedDB = new IDBFactory();
  settings.clear();
});

describe('P6-16 backupDocument aborts a failed write', () => {
  it('aborts the writable so no zero-byte file is left, then rethrows', async () => {
    const fake = fakeDir('Backups');
    await settingsPut('backupDir', fake.dir);
    fake.failNext.write = true;
    await expect(backupDocument(letter('a', 'Alpha', stamp(1)))).rejects.toThrow('disk full');
    expect(fake.aborted).toHaveLength(1);
    expect(fake.files.size).toBe(0);
  });
});

describe('P3-3 prune, cascade delete, sync warning', () => {
  it('keeps only the newest BACKUP_KEEP snapshots of one document, leaving other documents alone', async () => {
    const fake = fakeDir('Backups');
    await settingsPut('backupDir', fake.dir);
    await backupDocument(letter('other', 'Other', stamp(0)));
    for (let i = 1; i <= BACKUP_KEEP + 3; i++) {
      await backupDocument(letter('doc-1', 'Alpha', stamp(i)));
    }
    const names = Array.from(fake.files.keys()).sort();
    const alpha = names.filter((n) => n.startsWith('Alpha_'));
    expect(alpha).toHaveLength(BACKUP_KEEP);
    // The survivors are the newest ones.
    for (let i = 4; i <= BACKUP_KEEP + 3; i++) {
      expect(alpha.some((n) => n.includes(stamp(i).replace(/[:.]/g, '-')))).toBe(true);
    }
    expect(names.filter((n) => n.startsWith('Other_'))).toHaveLength(1);
  });

  it('prunes by document id, so a renamed document still counts toward one set', async () => {
    const fake = fakeDir('Backups');
    await settingsPut('backupDir', fake.dir);
    for (let i = 1; i <= BACKUP_KEEP; i++) await backupDocument(letter('doc-1', 'Alpha', stamp(i)));
    for (let i = BACKUP_KEEP + 1; i <= BACKUP_KEEP + 2; i++) await backupDocument(letter('doc-1', 'Bravo', stamp(i)));
    expect(fake.files.size).toBe(BACKUP_KEEP);
  });

  it('deleteBackupsFor removes every snapshot of the document and nothing else', async () => {
    const fake = fakeDir('Backups');
    await settingsPut('backupDir', fake.dir);
    await backupDocument(letter('doc-1', 'Alpha', stamp(1)));
    await backupDocument(letter('doc-1', 'Alpha', stamp(2)));
    await backupDocument(letter('doc-2', 'Bravo', stamp(3)));
    expect(await deleteBackupsFor('doc-1')).toBe(2);
    expect(fake.files.size).toBe(1);
    expect(Array.from(fake.files.keys())[0]).toMatch(/^Bravo_/);
  });

  it('libDelete removes the document AND its snapshots through the hook', async () => {
    const fake = fakeDir('Backups');
    await settingsPut('backupDir', fake.dir);
    await libPut(letter('doc-1', 'Alpha', stamp(1)));
    await backupDocument(letter('doc-1', 'Alpha', stamp(1)));
    expect(fake.files.size).toBe(1);
    await libDelete('doc-1');
    expect(await libLoadAll()).toHaveLength(0);
    expect(fake.files.size).toBe(0);
  });

  it('deleteBackupsFor is a no-op when backup is off', async () => {
    expect(await deleteBackupsFor('doc-1')).toBe(0);
  });

  it('names sync clients in the status warning', async () => {
    expect(syncFolderWarning('Backups')).toBeNull();
    for (const name of ['OneDrive - USMC', 'Google Drive', 'Dropbox', 'iCloud Drive', 'Box']) {
      expect(syncFolderWarning(name)).toMatch(/leave(s)? this (machine|computer)/i);
    }
    const fake = fakeDir('OneDrive');
    await settingsPut('backupDir', fake.dir);
    const status = await getBackupStatus();
    expect(status.state).toBe('on');
    expect(status.state === 'on' && status.syncWarning).toMatch(/OneDrive/);
  });
});
