/**
 * The data-package import check (src/lib/nldp-import-check.ts): shapes
 * the app opens, the ones it refuses, and the integrity warning.
 */
import { describe, it, expect } from 'vitest';
import { checkImportedPackage, describeOversize, MAX_PACKAGE_BYTES } from '@/lib/nldp-import-check';
import { createNLDPFile, calculateCRC32 } from '@/lib/nldp-utils';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FormData, ParagraphData } from '@/types';

const formData = { documentType: 'basic', subj: 'TEST', from: 'A', to: 'B' } as unknown as FormData;
const paragraphs = [{ id: 1, level: 1, content: 'One.' }] as ParagraphData[];

describe('checkImportedPackage', () => {
  it('opens a package the app exported, with no warning', async () => {
    const pkg = await createNLDPFile(formData, ['V'], ['R'], ['E'], [], paragraphs, { package: { title: 'T', description: '' } });
    const check = await checkImportedPackage(JSON.parse(JSON.stringify(pkg)));
    expect(check).toEqual({ ok: true, errors: [], warnings: [] });
  });

  it('warns, and still opens, when the data changed after export', async () => {
    const pkg = await createNLDPFile(formData, [], [], [], [], paragraphs, { package: { title: 'T', description: '' } });
    const edited = JSON.parse(JSON.stringify(pkg));
    edited.data.formData.subj = 'EDITED BY HAND';
    const check = await checkImportedPackage(edited);
    expect(check.ok).toBe(true);
    expect(check.warnings).toEqual(['The package was changed after it was exported (CRC32 and SHA-256 mismatch).']);
  });

  it('runs the SHA-256 check even when the CRC32 still matches', async () => {
    const pkg = await createNLDPFile(formData, [], [], [], [], paragraphs, { package: { title: 'T', description: '' } });
    const edited = JSON.parse(JSON.stringify(pkg));
    edited.data.formData.subj = 'EDITED BY HAND';
    // A forged CRC32 over the edited bytes: only the hash can catch it.
    edited.integrity.crc32 = calculateCRC32(JSON.stringify(edited.data));
    const check = await checkImportedPackage(edited);
    expect(check.ok).toBe(true);
    expect(check.warnings).toEqual(['The package was changed after it was exported (SHA-256 mismatch).']);
  });

  it('opens the shipped templates, which carry no integrity block', async () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'public', 'templates', 'global', 'aa-oconus-extension.nldp'), 'utf8'));
    expect(await checkImportedPackage(pkg)).toEqual({ ok: true, errors: [], warnings: [] });
  });

  it('opens a bare data block and the legacy bare form record', async () => {
    expect((await checkImportedPackage({ formData: { documentType: 'basic' }, paragraphs: [] })).ok).toBe(true);
    expect((await checkImportedPackage({ documentType: 'basic', subj: 'X' })).ok).toBe(true);
  });

  it('refuses what is not a letter, naming the reason', async () => {
    expect((await checkImportedPackage(null)).ok).toBe(false);
    expect((await checkImportedPackage([1, 2])).ok).toBe(false);
    expect((await checkImportedPackage({ hello: 'world' })).ok).toBe(false);
    const wrongLists = await checkImportedPackage({ data: { formData: {}, paragraphs: 'not a list' } });
    expect(wrongLists.ok).toBe(false);
    expect(wrongLists.errors[0]).toMatch(/data\.paragraphs/);
  });

  it('refuses a file over the cap before reading its shape', async () => {
    const check = await checkImportedPackage({ data: { formData: {} } }, MAX_PACKAGE_BYTES + 1);
    expect(check.ok).toBe(false);
    expect(check.errors[0]).toMatch(/10 MB/);
    // The caller's pre-read gate, on the File's byte count alone.
    expect(describeOversize(MAX_PACKAGE_BYTES)).toBeNull();
    expect(describeOversize(MAX_PACKAGE_BYTES + 1)).toMatch(/10 MB/);
  });
});
