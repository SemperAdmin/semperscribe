/**
 * P1.3 (DONDOCS_PARITY_PLAN) - automatic backup to a local folder.
 *
 * File System Access API: the user picks a folder once, the directory
 * handle persists in IndexedDB, and every library save writes a
 * portable .nldp snapshot into that folder. This is a local-disk
 * mirror of the document library, so clearing browser storage no
 * longer costs work. Nothing leaves the machine UNLESS the chosen
 * folder is one a sync client watches (OneDrive, Google Drive,
 * Dropbox, iCloud, Box) - then every snapshot is uploaded by that
 * client, and the status carries a warning saying so (P3-3).
 *
 * P3-3: the folder keeps the newest BACKUP_KEEP snapshots per
 * document (older ones are deleted on write) and a document deleted
 * from the library takes its snapshots with it, through the hook
 * document-library calls on libDelete.
 *
 * Chromium-only (Edge and Chrome cover the target userbase). Firefox
 * and Safari fall back to a "not supported" notice in the UI.
 */

import { SavedLetter } from '@/types';
import { libLoadAll, registerBackupDeleteHook } from '@/lib/document-library';
import {
  settingsGet, settingsPut, settingsDelete,
  isDirectoryPickerSupported,
  type DirectoryPickerWindow, type PermissionCapableHandle,
} from '@/lib/idb-settings';

const BACKUP_DIR_KEY = 'backupDir';

/** P3-3: snapshots kept per document; older ones go on the next write. */
export const BACKUP_KEEP = 5;

export type BackupStatus =
  | { state: 'unsupported' }
  | { state: 'off' }
  | { state: 'on'; folderName: string; syncWarning: string | null }
  | { state: 'permission-needed'; folderName: string };

/**
 * P3-3: the folder names the sync clients use. A backup written there
 * is uploaded by that client, so "nothing leaves the machine" no
 * longer holds and the UI has to say so.
 */
const SYNC_FOLDER_PATTERNS: Array<[RegExp, string]> = [
  [/onedrive/i, 'OneDrive'],
  [/google\s*drive/i, 'Google Drive'],
  [/dropbox/i, 'Dropbox'],
  [/icloud/i, 'iCloud'],
  [/^box\b|\bbox\s*(drive|sync)?$/i, 'Box'],
];

/** One warning line for the backup UI, or null for a plain local folder. */
export function syncFolderWarning(folderName: string): string | null {
  for (const [pattern, client] of SYNC_FOLDER_PATTERNS) {
    if (pattern.test(folderName)) {
      return `"${folderName}" looks like a ${client} folder. Backups written there are uploaded by ${client} and leave this machine; pick a local folder if the documents must stay here.`;
    }
  }
  return null;
}

export function isBackupSupported(): boolean {
  return isDirectoryPickerSupported();
}

/**
 * Prompts the user to pick (or change) the backup folder.
 * Must run inside a user gesture. Returns the folder name.
 */
export async function enableAutoBackup(): Promise<string> {
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
  if (!picker) throw new Error('Folder backup is not supported in this browser');
  const handle = await picker({ id: 'semperscribe-backup', mode: 'readwrite' });
  await settingsPut(BACKUP_DIR_KEY, handle);
  return handle.name;
}

export async function disableAutoBackup(): Promise<void> {
  await settingsDelete(BACKUP_DIR_KEY);
}

/**
 * Reports the current backup configuration without prompting.
 */
export async function getBackupStatus(): Promise<BackupStatus> {
  if (!isBackupSupported()) return { state: 'unsupported' };
  let handle: PermissionCapableHandle | null;
  try {
    handle = await settingsGet<PermissionCapableHandle>(BACKUP_DIR_KEY);
  } catch {
    return { state: 'off' };
  }
  if (!handle) return { state: 'off' };
  try {
    const perm = handle.queryPermission ? await handle.queryPermission({ mode: 'readwrite' }) : 'granted';
    return perm === 'granted'
      ? { state: 'on', folderName: handle.name, syncWarning: syncFolderWarning(handle.name) }
      : { state: 'permission-needed', folderName: handle.name };
  } catch {
    return { state: 'permission-needed', folderName: handle.name };
  }
}

/**
 * Re-requests folder permission (user gesture required).
 */
export async function reauthorizeBackup(): Promise<boolean> {
  const handle = await settingsGet<PermissionCapableHandle>(BACKUP_DIR_KEY);
  if (!handle || !handle.requestPermission) return false;
  const perm = await handle.requestPermission({ mode: 'readwrite' });
  return perm === 'granted';
}

function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9 _-]+/g, '').trim().replace(/\s+/g, '_');
  return cleaned.length > 0 ? cleaned.slice(0, 60) : 'Untitled';
}

function toNldp(letter: SavedLetter): string {
  return JSON.stringify(
    {
      metadata: {
        packageId: `backup_${letter.id}`,
        formatVersion: '1.0.0',
        createdAt: new Date().toISOString(),
        author: { name: letter.from || 'Unknown' },
        package: {
          title: letter.name || letter.subj || 'Untitled',
          description: 'SemperScribe automatic backup',
          subject: letter.subj,
          documentType: letter.documentType,
        },
      },
      data: {
        formData: letter,
        vias: letter.vias,
        references: letter.references,
        enclosures: letter.enclosures,
        copyTos: letter.copyTos,
        distList: letter.distList,
        paragraphs: letter.paragraphs,
      },
    },
    null,
    2,
  );
}

/**
 * P3-3: the document id as it appears in a snapshot's file name, so
 * prune and delete find a document's snapshots whatever the document
 * was called at the time. Ids are ISO timestamps, so this is short.
 */
function idToken(id: string): string {
  return id.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'id';
}

function snapshotName(letter: SavedLetter): string {
  const stamp = (letter.updatedAt ?? new Date().toISOString()).replace(/[:.]/g, '-');
  return `${sanitizeFilename(letter.name || letter.subj || 'Untitled')}_${idToken(letter.id)}_${stamp}.nldp`;
}

/** Every snapshot of one document in the folder, oldest first. */
async function snapshotsFor(handle: FileSystemDirectoryHandle, id: string): Promise<string[]> {
  const iter = handle as unknown as { keys?: () => AsyncIterable<string> };
  if (typeof iter.keys !== 'function') return [];
  const marker = `_${idToken(id)}_`;
  const names: string[] = [];
  for await (const name of iter.keys()) {
    if (name.endsWith('.nldp') && name.includes(marker)) names.push(name);
  }
  // The stamp is the file name's tail and is ISO-shaped, so the names
  // of one document sort by time; the document title prefix is the
  // same within one id unless renamed, in which case sort by the tail.
  return names.sort((a, b) => a.slice(a.indexOf(marker)).localeCompare(b.slice(b.indexOf(marker))));
}

async function currentBackupDir(): Promise<FileSystemDirectoryHandle | null> {
  const status = await getBackupStatus();
  if (status.state !== 'on') return null;
  return settingsGet<FileSystemDirectoryHandle>(BACKUP_DIR_KEY);
}

/**
 * Writes one document into the backup folder as a portable .nldp.
 * Silent no-op when backup is off; throws on write failure so the
 * caller decides how loudly to report it. P6-16: a write that fails is
 * aborted, so the folder never holds a zero-byte snapshot under the
 * name of a good one. P3-3: older snapshots past BACKUP_KEEP go after
 * the new one is safely closed.
 */
export async function backupDocument(letter: SavedLetter): Promise<boolean> {
  const handle = await currentBackupDir();
  if (!handle) return false;
  const fileName = snapshotName(letter);
  const fileHandle = await handle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(toNldp(letter));
    await writable.close();
  } catch (error) {
    try {
      await writable.abort();
    } catch {
      // The abort failing changes nothing about the write failure.
    }
    throw error;
  }
  const older = (await snapshotsFor(handle, letter.id)).filter((name) => name !== fileName);
  const excess = older.length - (BACKUP_KEEP - 1);
  for (const name of older.slice(0, Math.max(0, excess))) {
    try {
      await handle.removeEntry(name);
    } catch (error) {
      console.warn('Backup prune failed', name, error);
    }
  }
  return true;
}

/**
 * P3-3: removes every snapshot of a document from the backup folder.
 * Returns the number removed; 0 when backup is off. Registered with
 * document-library so libDelete calls it.
 */
export async function deleteBackupsFor(id: string): Promise<number> {
  const handle = await currentBackupDir();
  if (!handle) return 0;
  let removed = 0;
  for (const name of await snapshotsFor(handle, id)) {
    await handle.removeEntry(name);
    removed += 1;
  }
  return removed;
}

registerBackupDeleteHook(deleteBackupsFor);

/**
 * Backs up every document in the library. Returns the count written.
 */
export async function backupAll(): Promise<number> {
  const letters = await libLoadAll();
  let written = 0;
  for (const letter of letters) {
    if (await backupDocument(letter)) written += 1;
  }
  return written;
}
