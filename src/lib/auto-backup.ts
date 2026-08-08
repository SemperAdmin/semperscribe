/**
 * P1.3 (DONDOCS_PARITY_PLAN) - automatic backup to a local folder.
 *
 * File System Access API: the user picks a folder once, the directory
 * handle persists in IndexedDB, and every library save writes a
 * portable .nldp snapshot into that folder. Nothing leaves the
 * machine - this is a local-disk mirror of the document library, so
 * clearing browser storage no longer costs work.
 *
 * Chromium-only (Edge and Chrome cover the target userbase). Firefox
 * and Safari fall back to a "not supported" notice in the UI.
 */

import { SavedLetter } from '@/types';
import { libLoadAll } from '@/lib/document-library';
import {
  settingsGet, settingsPut, settingsDelete,
  isDirectoryPickerSupported,
  type DirectoryPickerWindow, type PermissionCapableHandle,
} from '@/lib/idb-settings';

const BACKUP_DIR_KEY = 'backupDir';

export type BackupStatus =
  | { state: 'unsupported' }
  | { state: 'off' }
  | { state: 'on'; folderName: string }
  | { state: 'permission-needed'; folderName: string };

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
      ? { state: 'on', folderName: handle.name }
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
 * Writes one document into the backup folder as a portable .nldp.
 * Silent no-op when backup is off; throws on write failure so the
 * caller decides how loudly to report it.
 */
export async function backupDocument(letter: SavedLetter): Promise<boolean> {
  const status = await getBackupStatus();
  if (status.state !== 'on') return false;
  const handle = await settingsGet<FileSystemDirectoryHandle>(BACKUP_DIR_KEY);
  if (!handle) return false;
  const stamp = (letter.updatedAt ?? new Date().toISOString()).replace(/[:.]/g, '-');
  const fileName = `${sanitizeFilename(letter.name || letter.subj || 'Untitled')}_${stamp}.nldp`;
  const fileHandle = await handle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(toNldp(letter));
  await writable.close();
  return true;
}

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
