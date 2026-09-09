/**
 * The uploaded signed PDF the app writes into: who owns it, what discards
 * it, and what must NOT discard it.
 *
 * STEPHEN, 2026-08-26, asked when the base file goes away: "Clear Form
 * deletes it add a button for this at the top". That holds for an UNSAVED
 * document: the base is stored under the working-copy owner and Clear
 * Form's `fileDeleteForDoc(WORKING_COPY_DOC_ID)` sweeps it with the
 * enclosures.
 *
 * AUDIT P6-1 / P6-7. It must NOT hold for a saved one. The base used to be
 * keyed to the working-copy id for every document, so Save could not carry
 * it (the re-parent list omitted it) and Clear Form after Save deleted the
 * saved document's signed file; and the next document, with no file of its
 * own, exported INTO the previous Marine's signed UPB. The base is keyed by
 * a per-load id now, recorded on `formData.navmc10132BaseFileId`, and Save
 * re-parents it with the enclosures.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  fileDeleteForDoc,
  fileGet,
  fileReparentByIds,
  WORKING_COPY_DOC_ID,
} from '@/lib/document-library';
import {
  putNavmc10132Base,
  getNavmc10132Base,
  clearNavmc10132Base,
  navmc10132BaseFileIdOf,
} from '@/lib/navmc10132-base-file';
import type { FormData } from '@/types';

/** The signature of a real PDF, as an ArrayBuffer, which is what the store
 *  takes: the upload path hands it the bytes it read off the file. */
const BYTES = () => new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]).buffer;
const OF = (buffer: ArrayBuffer) => [...new Uint8Array(buffer)];

beforeEach(() => {
  // A fresh database per test, so a leftover base from an earlier test
  // cannot mask the very failure this file exists to catch.
  globalThis.indexedDB = new IDBFactory();
});

describe('the base file round trip', () => {
  it('reads back the bytes and the file name it was stored with, by the id put returned', async () => {
    const id = await putNavmc10132Base(BYTES(), 'NAVMC 10132 - THOMPSON JAMAL R.pdf');
    const back = await getNavmc10132Base(id);
    expect(back).not.toBeNull();
    expect(back!.fileName).toBe('NAVMC 10132 - THOMPSON JAMAL R.pdf');
    expect([...back!.bytes]).toEqual(OF(BYTES()));
  });

  it('is null for an id nothing was stored under, and for no id at all', async () => {
    expect(await getNavmc10132Base('navmc10132-base:never')).toBeNull();
    expect(await getNavmc10132Base(null)).toBeNull();
    expect(await getNavmc10132Base(undefined)).toBeNull();
  });

  it('every put gets its own id, namespaced away from enclosure ids', async () => {
    const a = await putNavmc10132Base(BYTES(), 'a.pdf');
    const b = await putNavmc10132Base(BYTES(), 'b.pdf');
    expect(a).not.toBe(b);
    expect(a.startsWith('navmc10132-base:')).toBe(true);
    expect(b.startsWith('navmc10132-base:')).toBe(true);
  });

  it('is owned by the working copy until Save re-parents it', async () => {
    const id = await putNavmc10132Base(BYTES(), 'a.pdf');
    expect((await fileGet(id))!.docId).toBe(WORKING_COPY_DOC_ID);
  });

  it('reads the recorded id off document state', () => {
    expect(navmc10132BaseFileIdOf({ documentType: 'navmc10132', navmc10132BaseFileId: 'navmc10132-base:x' } as FormData)).toBe('navmc10132-base:x');
    expect(navmc10132BaseFileIdOf({ documentType: 'navmc10132' } as FormData)).toBeNull();
    expect(navmc10132BaseFileIdOf({ documentType: 'navmc10132', navmc10132BaseFileId: '' } as FormData)).toBeNull();
    expect(navmc10132BaseFileIdOf({ documentType: 'navmc10132', navmc10132BaseFileId: 42 } as FormData)).toBeNull();
  });
});

describe('a second load replaces the first', () => {
  it('drops the base it was told it replaces', async () => {
    const first = await putNavmc10132Base(new Uint8Array([1, 2, 3]).buffer, 'first.pdf');
    const second = await putNavmc10132Base(new Uint8Array([9, 9]).buffer, 'second.pdf', { replaces: first });
    expect(await getNavmc10132Base(first)).toBeNull();
    const back = await getNavmc10132Base(second);
    expect(back!.fileName).toBe('second.pdf');
    expect([...back!.bytes]).toEqual([9, 9]);
  });

  it('the direct clear removes one base and no other', async () => {
    const a = await putNavmc10132Base(BYTES(), 'a.pdf');
    const b = await putNavmc10132Base(BYTES(), 'b.pdf');
    await clearNavmc10132Base(a);
    expect(await getNavmc10132Base(a)).toBeNull();
    expect(await getNavmc10132Base(b)).not.toBeNull();
  });
});

describe('Clear Form on an UNSAVED document discards it', () => {
  it('fileDeleteForDoc on the working copy removes the base', async () => {
    const id = await putNavmc10132Base(BYTES(), 'signed.pdf');
    expect(await getNavmc10132Base(id)).not.toBeNull();

    await fileDeleteForDoc(WORKING_COPY_DOC_ID);

    expect(await getNavmc10132Base(id)).toBeNull();
  });
});

describe('P6-7: Clear Form after Save keeps the saved document\'s base', () => {
  /**
   * Save re-parents every bound file to the saved document id and Clear
   * Form sweeps the working copy. With the base in the re-parent list it
   * survives; without it, a clerk who saved a case and cleared the form
   * lost the signed file behind the save.
   */
  it('re-parented with the enclosures, the sweep leaves it alone', async () => {
    const id = await putNavmc10132Base(BYTES(), 'signed.pdf');
    const savedId = '2026-09-07T12:00:00.000Z';

    await fileReparentByIds([id], savedId);
    await fileDeleteForDoc(WORKING_COPY_DOC_ID);

    const back = await getNavmc10132Base(id);
    expect(back).not.toBeNull();
    expect([...back!.bytes]).toEqual(OF(BYTES()));
    expect((await fileGet(id))!.docId).toBe(savedId);
  });

  it('not re-parented (the old behaviour), the sweep deletes it', async () => {
    const id = await putNavmc10132Base(BYTES(), 'signed.pdf');
    await fileReparentByIds([], 'saved');
    await fileDeleteForDoc(WORKING_COPY_DOC_ID);
    expect(await getNavmc10132Base(id)).toBeNull();
  });

  /**
   * THE LINK TO page.tsx. The Save handler builds `boundIds` from the
   * enclosure rows and the same-page host; the base id has to be in that
   * list too, or the test above proves nothing about the app. A source
   * scan, in the style of navmc10132-stage-seeding-guard.test.ts.
   */
  it('the Save handler in page.tsx puts the base id in the re-parent list', () => {
    const source = readFileSync(path.resolve(__dirname, '../src/app/page.tsx'), 'utf8');
    const saveBlock = source.slice(source.indexOf('const boundIds'), source.indexOf('fileReparentByIds(boundIds'));
    expect(saveBlock).toContain('navmc10132BaseFileIdOf');
  });

  it('a load, an import, a draft and a template never inherit the previous document\'s base', () => {
    const source = readFileSync(path.resolve(__dirname, '../src/app/page.tsx'), 'utf8');
    // handleImport merges over the previous state, so page.tsx has to clear
    // the id and the report before every merge-style load.
    expect(source).toContain('dropNavmc10132Base');
    // Every merge-style entry goes through the wrapper, not the raw hook.
    expect(source).toMatch(/onLoadDraft=\{handleLoadDraftFresh\}/);
    expect(source).toMatch(/onLoad=\{handleLoadDraftFresh\}/);
    expect(source).toMatch(/onRestore=\{handleLoadDraftFresh\}/);
    expect(source).toMatch(/onImport=\{handleImportFresh\}/);
    expect(source).toMatch(/useShareLinkLoader\(\{\s*handleImport: handleImportFresh/);
    // The raw template loader is called once: inside its wrapper.
    expect(source.match(/[^A-Za-z]handleLoadTemplateUrl\(/g)).toHaveLength(1);
    expect(source).toMatch(/dropNavmc10132Base\(\);\s*return handleLoadTemplateUrl\(url\);/);
  });
});
