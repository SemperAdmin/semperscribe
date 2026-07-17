/**
 * ENC (docs/ENCLOSURE_UPLOAD_PLAN.md) - merge engine.
 *
 * The defect this build killed: v1 kept uploads in a second list and
 * guessed their numbers. Position-based numbering gets the coverage,
 * plus the M-5216.5 marking rules: stamp EVERY page by default
 * (2026-07-16 ruling), cover sheet (carrying the mark, banner when
 * classified) as the fallback, never both.
 */
import { describe, it, expect } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import {
  fileToAttachment,
  computeMergeItems,
  mergeAttachmentsIntoPdf,
  reconcileRows,
  newRow,
  EnclosureAttachment,
  EnclosureRow,
} from '@/lib/enclosure-attachments';

// 1x1 red PNG
const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function pngBytes(): ArrayBuffer {
  const bin = atob(PNG_B64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

async function makePdf(label: string, pages: number): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pages; i++) {
    const p = doc.addPage([612, 792]);
    p.drawText(`${label} P${i}`, { x: 72, y: 700, size: 14, font });
  }
  const bytes = await doc.save();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function att(id: string, title: string, mime: EnclosureAttachment['mimeType'], bytes: ArrayBuffer): EnclosureAttachment {
  return { id, fileName: `${title}.bin`, title, mimeType: mime, bytes };
}

describe('computeMergeItems - position IS the number', () => {
  const files = new Map<string, EnclosureAttachment>([
    ['f1', att('f1', 'Cert', 'application/pdf', new ArrayBuffer(4))],
    ['f2', att('f2', 'Photo', 'image/png', new ArrayBuffer(4))],
  ]);

  it('numbers bound rows by their position', () => {
    const rows: EnclosureRow[] = [
      { key: 'r1', title: 'Cert', fileId: 'f1' },
      { key: 'r2', title: 'Photo', fileId: 'f2' },
    ];
    const items = computeMergeItems(rows, files, 1);
    expect(items.map(i => i.number)).toEqual([1, 2]);
  });

  it('an unbound row consumes its number (physical enclosure)', () => {
    const rows: EnclosureRow[] = [
      { key: 'r1', title: 'Physical item, sep cover' },
      { key: 'r2', title: 'Cert', fileId: 'f1' },
    ];
    const items = computeMergeItems(rows, files, 1);
    expect(items).toHaveLength(1);
    expect(items[0].number).toBe(2);
  });

  it('respects startingEnclosureNumber (endorsement continuation)', () => {
    const rows: EnclosureRow[] = [{ key: 'r1', title: 'Cert', fileId: 'f1' }];
    expect(computeMergeItems(rows, files, 4)[0].number).toBe(4);
  });

  it('skips a binding whose file is absent from the map', () => {
    const rows: EnclosureRow[] = [{ key: 'r1', title: 'Ghost', fileId: 'nope' }];
    expect(computeMergeItems(rows, files, 1)).toHaveLength(0);
  });
});

describe('mergeAttachmentsIntoPdf', () => {
  it('stamp mode: appends pages, no cover pages', async () => {
    const base = await makePdf('BASE', 1);
    const encl = await makePdf('ENCL', 2);
    const items = computeMergeItems(
      [{ key: 'r1', title: 'Cert', fileId: 'f1' }, { key: 'r2', title: 'Photo', fileId: 'f2' }],
      new Map([
        ['f1', att('f1', 'Cert', 'application/pdf', encl)],
        ['f2', att('f2', 'Photo', 'image/png', pngBytes())],
      ]),
      1,
    );
    const merged = await mergeAttachmentsIntoPdf(base, items, { coverPages: false });
    const doc = await PDFDocument.load(merged);
    // 1 base + 2 pdf + 1 image page, no covers
    expect(doc.getPageCount()).toBe(4);
  });

  it('cover mode: one generated cover before each file', async () => {
    const base = await makePdf('BASE', 1);
    const encl = await makePdf('ENCL', 2);
    const items = computeMergeItems(
      [{ key: 'r1', title: 'Cert', fileId: 'f1' }, { key: 'r2', title: 'Photo', fileId: 'f2' }],
      new Map([
        ['f1', att('f1', 'Cert', 'application/pdf', encl)],
        ['f2', att('f2', 'Photo', 'image/png', pngBytes())],
      ]),
      1,
    );
    const merged = await mergeAttachmentsIntoPdf(base, items, { coverPages: true, bannerText: 'CUI' });
    const doc = await PDFDocument.load(merged);
    // 1 base + (1 cover + 2 pdf) + (1 cover + 1 image)
    expect(doc.getPageCount()).toBe(6);
  });

  it('a corrupt PDF names its enclosure number and file', async () => {
    const base = await makePdf('BASE', 1);
    const bad = new TextEncoder().encode('%PDF-not really a pdf');
    const items = computeMergeItems(
      [{ key: 'r1', title: 'Broken', fileId: 'fx' }],
      new Map([['fx', att('fx', 'Broken', 'application/pdf', bad.buffer as ArrayBuffer)]]),
      3,
    );
    await expect(mergeAttachmentsIntoPdf(base, items, { coverPages: false }))
      .rejects.toThrow(/Enclosure \(3\).*Broken/);
  });
});

describe('fileToAttachment', () => {
  it('detects PDF, PNG, JPG by magic bytes', async () => {
    const pdf = await fileToAttachment(new File([new Uint8Array(await makePdf('X', 1))], 'doc.pdf'));
    expect(pdf.mimeType).toBe('application/pdf');
    expect(pdf.title).toBe('doc');
    const png = await fileToAttachment(new File([new Uint8Array(pngBytes())], 'pic.png'));
    expect(png.mimeType).toBe('image/png');
    const jpg = await fileToAttachment(new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0])], 'pic.jpg'));
    expect(jpg.mimeType).toBe('image/jpeg');
  });

  it('refuses non-PDF/JPG/PNG with save-as-PDF guidance', async () => {
    const docx = new File([new TextEncoder().encode('PK docx-ish')], 'memo.docx');
    await expect(fileToAttachment(docx)).rejects.toThrow(/save as PDF first/);
  });

  it('refuses files over the 25 MB cap', async () => {
    const big = new File([new Uint8Array(26 * 1024 * 1024)], 'big.pdf');
    await expect(fileToAttachment(big)).rejects.toThrow(/limit is 25 MB/);
  });
});

describe('reconcileRows - the legacy string[] adapter', () => {
  it('keeps keys and bindings when titles change in place', () => {
    const prev: EnclosureRow[] = [
      { key: 'a', title: 'One', fileId: 'f1' },
      { key: 'b', title: 'Two' },
    ];
    const next = reconcileRows(prev, ['One edited', 'Two']);
    expect(next[0]).toMatchObject({ key: 'a', title: 'One edited', fileId: 'f1' });
    expect(next[1]).toBe(prev[1]); // untouched row keeps identity
  });

  it('appends fresh unbound rows for extra titles', () => {
    const next = reconcileRows([{ key: 'a', title: 'One' }], ['One', 'Two']);
    expect(next).toHaveLength(2);
    expect(next[1].fileId).toBeUndefined();
    expect(next[1].key).not.toBe('a');
  });

  it('drops trailing rows (and their bindings) when titles shrink', () => {
    const prev: EnclosureRow[] = [
      { key: 'a', title: 'One' },
      { key: 'b', title: 'Two', fileId: 'f2' },
    ];
    expect(reconcileRows(prev, ['One'])).toHaveLength(1);
  });

  it('newRow issues unique keys', () => {
    expect(newRow().key).not.toBe(newRow().key);
  });
});
