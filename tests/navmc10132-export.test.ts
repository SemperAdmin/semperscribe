/**
 * Which NAVMC 10132 export path runs, and what the caller is told about it.
 *
 * AUDIT P6-1. The base file used to be keyed to the working-copy id no
 * matter which document was open, and the export read it with no id at
 * all. Load a signed UPB for Marine A, start a fresh document for Marine
 * B, export: B's data was patched INTO A's signed file. The base now
 * belongs to the document that loaded it, by an id recorded on
 * `formData.navmc10132BaseFileId`, and the incremental path runs only when
 * the document also carries the load report that says a signed file is
 * behind it.
 *
 * AUDIT P6-5 / P6-6. A storage failure reading the base was swallowed to
 * "no base", so an incremental write silently became a blank fill with
 * every signature gone, and refused field writes reached the console only.
 * Both now reach the caller: the read error as a thrown export failure,
 * the refusals on the export report.
 *
 * The blank fill and the incremental writer are both mocked here: what a
 * fill produces is proved elsewhere (node-render.test.ts,
 * navmc10132-incremental-write.test.ts). This file proves WHICH one ran and
 * on WHOSE bytes.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import type { FormData } from '@/types';
import { fileGet } from '@/lib/document-library';
import {
  putNavmc10132Base,
  getNavmc10132Base,
  Navmc10132BaseReadError,
} from '@/lib/navmc10132-base-file';
import { writeNavmc10132Incremental } from '@/lib/navmc10132-incremental-write';
import { fillAcroForm } from '@/lib/acroform-fill';
import {
  exportNavmc10132Form,
  exportNavmc10132FormWithReport,
} from '@/lib/navmc10132-export';

vi.mock('@/lib/navmc10132-incremental-write', () => ({
  writeNavmc10132Incremental: vi.fn(async (base: Uint8Array) => ({
    bytes: new Uint8Array([...base, 0xaa]),
    written: ['6 PUNISHMENT IMPOSED'],
    refused: [],
    unchanged: [],
    skippedEmpty: [],
    deltaBytes: 1,
  })),
  Navmc10132WriteError: class extends Error {},
}));

vi.mock('@/lib/acroform-fill', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/acroform-fill')>();
  return {
    ...actual,
    fillAcroForm: vi.fn(async () => new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x00])),
  };
});

vi.mock('@/lib/assets', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/assets')>();
  return { ...actual, loadAssetBytes: vi.fn(async () => new Uint8Array([0x25, 0x50, 0x44, 0x46])) };
});

vi.mock('@/lib/document-library', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/document-library')>();
  return { ...actual, fileGet: vi.fn(actual.fileGet) };
});

const SIGNED_A = () => new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x41]).buffer;

const LOAD_REPORT = {
  fileName: 'NAVMC 10132 - A.pdf',
  signedSignatures: ['2 ACCUSED SIGNATURE'],
  lockedFields: ['18 ACCUSED FULL NAME'],
  appLockedFields: [],
  lockedFieldCount: 1,
};

function upb(extra: Record<string, unknown> = {}): FormData {
  return { documentType: 'navmc10132', accusedName: 'THOMPSON, JAMAL R', ...extra } as FormData;
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  vi.mocked(writeNavmc10132Incremental).mockClear();
  vi.mocked(fillAcroForm).mockClear();
  vi.mocked(fileGet).mockClear();
});

describe('P6-1: the base belongs to the document that loaded it', () => {
  it('a fresh document without a load report fills the blank, and leaves A\'s bytes alone', async () => {
    // Document A loads a signed file.
    const idA = await putNavmc10132Base(SIGNED_A(), 'NAVMC 10132 - A.pdf');
    // The clerk moves on to Marine B: a fresh document, no report, no id.
    const documentB = upb({ accusedName: 'BROWN, TERRY L' });

    const { report } = await exportNavmc10132FormWithReport(documentB);

    expect(report.path).toBe('blank');
    expect(writeNavmc10132Incremental).not.toHaveBeenCalled();
    expect(fillAcroForm).toHaveBeenCalledTimes(1);
    // A's signed bytes are exactly as stored.
    const a = await getNavmc10132Base(idA);
    expect([...a!.bytes]).toEqual([...new Uint8Array(SIGNED_A())]);
  });

  it('a document carrying a base id but NO load report still fills the blank', async () => {
    const idA = await putNavmc10132Base(SIGNED_A(), 'NAVMC 10132 - A.pdf');
    const { report } = await exportNavmc10132FormWithReport(upb({ navmc10132BaseFileId: idA }));
    expect(report.path).toBe('blank');
    expect(writeNavmc10132Incremental).not.toHaveBeenCalled();
  });

  it('a load report whose base id does not resolve fills the blank and says so', async () => {
    const { report } = await exportNavmc10132FormWithReport(
      upb({ navmc10132LoadReport: LOAD_REPORT, navmc10132BaseFileId: 'navmc10132-base:gone' }),
    );
    expect(report.path).toBe('blank');
    expect(report.baseMissing).toBe(true);
    expect(writeNavmc10132Incremental).not.toHaveBeenCalled();
  });

  it('load report present and the id resolves: the incremental path, on THAT file\'s bytes', async () => {
    const idA = await putNavmc10132Base(SIGNED_A(), 'NAVMC 10132 - A.pdf');
    const documentA = upb({ navmc10132LoadReport: LOAD_REPORT, navmc10132BaseFileId: idA });

    const { blob, report } = await exportNavmc10132FormWithReport(documentA);

    expect(report.path).toBe('incremental');
    expect(report.baseMissing).toBe(false);
    expect(fillAcroForm).not.toHaveBeenCalled();
    expect(writeNavmc10132Incremental).toHaveBeenCalledTimes(1);
    const [baseArg] = vi.mocked(writeNavmc10132Incremental).mock.calls[0];
    expect([...baseArg]).toEqual([...new Uint8Array(SIGNED_A())]);
    expect(blob.size).toBe(SIGNED_A().byteLength + 1);
  });

  it('two documents, two bases: each exports into its own', async () => {
    const idA = await putNavmc10132Base(SIGNED_A(), 'A.pdf');
    const idB = await putNavmc10132Base(new Uint8Array([0x42]).buffer, 'B.pdf');
    expect(idA).not.toBe(idB);

    await exportNavmc10132FormWithReport(upb({ navmc10132LoadReport: LOAD_REPORT, navmc10132BaseFileId: idB }));
    const [baseB] = vi.mocked(writeNavmc10132Incremental).mock.calls[0];
    expect([...baseB]).toEqual([0x42]);

    await exportNavmc10132FormWithReport(upb({ navmc10132LoadReport: LOAD_REPORT, navmc10132BaseFileId: idA }));
    const [baseA] = vi.mocked(writeNavmc10132Incremental).mock.calls[1];
    expect([...baseA]).toEqual([...new Uint8Array(SIGNED_A())]);
  });

  it('the Blob-returning wrapper takes the same path', async () => {
    const idA = await putNavmc10132Base(SIGNED_A(), 'A.pdf');
    const blob = await exportNavmc10132Form(upb({ navmc10132LoadReport: LOAD_REPORT, navmc10132BaseFileId: idA }));
    expect(blob.size).toBe(SIGNED_A().byteLength + 1);
    expect(writeNavmc10132Incremental).toHaveBeenCalledTimes(1);
  });
});

describe('P6-6: a storage failure is an export failure, not a silent blank', () => {
  it('an IndexedDB read error propagates with a clear message', async () => {
    const idA = await putNavmc10132Base(SIGNED_A(), 'A.pdf');
    const failure = new Error('QuotaExceededError: the store is unreadable');
    vi.mocked(fileGet).mockRejectedValueOnce(failure).mockRejectedValueOnce(failure);

    const documentA = upb({ navmc10132LoadReport: LOAD_REPORT, navmc10132BaseFileId: idA });
    await expect(exportNavmc10132FormWithReport(documentA)).rejects.toThrowError(Navmc10132BaseReadError);
    await expect(exportNavmc10132FormWithReport(documentA)).rejects.toThrow(/signed NAVMC 10132/);

    // Nothing was filled, nothing was written: no blank went out in the
    // signed file's place.
    expect(fillAcroForm).not.toHaveBeenCalled();
    expect(writeNavmc10132Incremental).not.toHaveBeenCalled();
  });

  it('getNavmc10132Base itself throws rather than returning null on a read error', async () => {
    vi.mocked(fileGet).mockRejectedValueOnce(new Error('boom'));
    await expect(getNavmc10132Base('navmc10132-base:x')).rejects.toThrowError(Navmc10132BaseReadError);
  });
});

describe('P6-5: refused field writes reach the caller', () => {
  it('the report names every field the writer refused', async () => {
    vi.mocked(writeNavmc10132Incremental).mockResolvedValueOnce({
      bytes: new Uint8Array([1]),
      written: [],
      refused: ['18 ACCUSED FULL NAME', '17 UNIT'],
      unchanged: [],
      skippedEmpty: [],
      deltaBytes: 0,
    });
    const idA = await putNavmc10132Base(SIGNED_A(), 'A.pdf');
    const { report } = await exportNavmc10132FormWithReport(
      upb({ navmc10132LoadReport: LOAD_REPORT, navmc10132BaseFileId: idA }),
    );
    expect(report.path).toBe('incremental');
    expect(report.refused).toEqual(['18 ACCUSED FULL NAME', '17 UNIT']);
  });

  it('the blank path reports no refusals', async () => {
    const { report } = await exportNavmc10132FormWithReport(upb());
    expect(report.refused).toEqual([]);
  });
});
