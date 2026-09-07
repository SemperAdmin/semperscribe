/**
 * The uploaded signed PDF the app writes into, and the one action that
 * discards it.
 *
 * STEPHEN, 2026-08-26, asked when the base file goes away: "Clear Form
 * deletes it add a button for this at the top". That answer only holds if
 * Clear Form's file cleanup really reaches the base, and nothing tested the
 * link. The base is stored by `putNavmc10132Base` under the working-copy
 * document id; Clear Form calls `fileDeleteForDoc(WORKING_COPY_DOC_ID)`.
 * Those are two modules agreeing on one id, which is exactly the kind of
 * agreement that breaks silently.
 *
 * WHAT BREAKS IF IT DOES. Every export and every live preview writes into
 * the base once one exists. A base surviving a Clear Form means the next
 * Marine's Unit Punishment Book exports as the PREVIOUS Marine's signed
 * file with new data patched into it.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { fileDeleteForDoc, WORKING_COPY_DOC_ID } from '@/lib/document-library';
import {
  putNavmc10132Base,
  getNavmc10132Base,
  clearNavmc10132Base,
} from '@/lib/navmc10132-base-file';

/** The signature of a real PDF, as an ArrayBuffer, which is what the store
 *  takes: the upload path hands it the bytes it read off the file. */
const BYTES = () => new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]).buffer;
const OF = (buffer: ArrayBuffer) => [...new Uint8Array(buffer)];

beforeEach(() => {
  // A fresh database per test: the store is a singleton keyed by one id, so
  // a leftover base from an earlier test would mask the very failure this
  // file exists to catch.
  globalThis.indexedDB = new IDBFactory();
});

describe('the base file round trip', () => {
  it('reads back the bytes and the file name it was stored with', async () => {
    await putNavmc10132Base(BYTES(), 'NAVMC 10132 - THOMPSON JAMAL R.pdf');
    const back = await getNavmc10132Base();
    expect(back).not.toBeNull();
    expect(back!.fileName).toBe('NAVMC 10132 - THOMPSON JAMAL R.pdf');
    expect([...back!.bytes]).toEqual(OF(BYTES()));
  });

  // The export and the preview both branch on this being null.
  it('is null when nothing has been uploaded', async () => {
    expect(await getNavmc10132Base()).toBeNull();
  });
});

describe('Clear Form discards it, which is the whole answer', () => {
  /**
   * THE LINK BETWEEN TWO MODULES. `resetDocumentState` calls exactly this,
   * with exactly this id. If `putNavmc10132Base` ever stored under a
   * different owner, this test reds and the button at the top of the form
   * would be lying about what it does.
   */
  it('fileDeleteForDoc on the working copy removes the base', async () => {
    await putNavmc10132Base(BYTES(), 'signed.pdf');
    expect(await getNavmc10132Base()).not.toBeNull();

    await fileDeleteForDoc(WORKING_COPY_DOC_ID);

    expect(await getNavmc10132Base()).toBeNull();
  });

  it('the direct clear does the same, for a caller holding one id', async () => {
    await putNavmc10132Base(BYTES(), 'signed.pdf');
    await clearNavmc10132Base();
    expect(await getNavmc10132Base()).toBeNull();
  });

  // Uploading a second file replaces the first rather than stacking, so the
  // app is never holding two candidate base files.
  it('a second upload replaces the first', async () => {
    await putNavmc10132Base(new Uint8Array([1, 2, 3]).buffer, 'first.pdf');
    await putNavmc10132Base(new Uint8Array([9, 9]).buffer, 'second.pdf');
    const back = await getNavmc10132Base();
    expect(back!.fileName).toBe('second.pdf');
    expect([...back!.bytes]).toEqual([9, 9]);
  });
});
