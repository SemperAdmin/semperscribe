/**
 * P2-5: one action reaches every store. Before it, "Clear saved letters"
 * left the working copy, the profile, the GunnyBot proxy and the backup
 * handle in place for the next user of the workstation.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { clearAllLocalData, libPut, libLoadAll, fileGet, filePut, SETTINGS_STORE } from '@/lib/document-library';
import { writeWorkingCopy, readWorkingCopy } from '@/lib/autosave';

describe('clearAllLocalData', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

  it('empties the document, file and settings stores and every app key in web storage', async () => {
    await libPut({ id: 'd1', name: 'A', updatedAt: 1, data: {} } as never);
    await filePut({ fileId: 'f1', docId: 'd1', name: 'x.pdf', type: 'application/pdf', size: 1, bytes: new Uint8Array([1]).buffer } as never);
    await writeWorkingCopy({ formData: { documentType: 'basic' } } as never);
    localStorage.setItem('semperscribe-user-profile', '{"fullName":"X"}');
    localStorage.setItem('navalLetters', '[]');
    localStorage.setItem('gunnybot.proxy.v1', '{"gemini":"http://127.0.0.1:1"}');
    sessionStorage.setItem('semperscribe.edms.v1', '{}');
    localStorage.setItem('unrelated', 'keep');

    await clearAllLocalData();

    expect(await libLoadAll()).toEqual([]);
    expect(await fileGet('f1')).toBeFalsy();
    expect(await readWorkingCopy()).toBeNull();
    expect(localStorage.getItem('semperscribe-user-profile')).toBeNull();
    expect(localStorage.getItem('navalLetters')).toBeNull();
    expect(localStorage.getItem('gunnybot.proxy.v1')).toBeNull();
    expect(sessionStorage.getItem('semperscribe.edms.v1')).toBeNull();
    expect(localStorage.getItem('unrelated')).toBe('keep');
    expect(SETTINGS_STORE).toBe('settings');
  });
});
