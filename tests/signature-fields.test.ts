/**
 * S1 — sign-ready export (docs/SIGNATURE_COLLECTION_PLAN.md, Gate S1).
 *
 * Acceptance: (a) zero page-content-stream delta when fields are
 * added (the pre-S1 code drew "sign here" ink into page content —
 * permanent marks on official correspondence); (b) AcroForm SigFlags
 * and field rect as computed; (c) deterministic per-signer field
 * names; (d) widget carries a normal appearance (/AP /N) so the cue
 * lives on the annotation Acrobat replaces at signing time.
 */
import { describe, it, expect } from 'vitest';
import {
  PDFDocument, PDFName, PDFDict, PDFArray, PDFRawStream, PDFRef,
  decodePDFRawStream, StandardFonts,
} from 'pdf-lib';
import {
  addSignatureField,
  addSignatureFieldAtPosition,
  addMultipleSignatureFields,
  buildSignatureFieldName,
} from '@/lib/pdf-signature-field';
import { PDF_INDENTS, PDF_MARGINS } from '@/lib/pdf-settings';

async function makeBasePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Courier);
  page.drawText('Subj:  TEST LETTER', { x: 72, y: 700, size: 12, font });
  // Typed signature name at the signature indent (auto-anchor target)
  page.drawText('I. M. MARINE', {
    x: PDF_MARGINS.left + PDF_INDENTS.signature, y: 300, size: 12, font,
  });
  return doc.save();
}

function decodedContents(doc: PDFDocument, pageIdx: number): string {
  const page = doc.getPages()[pageIdx];
  const raw = page.node.Contents();
  const chunks: Uint8Array[] = [];
  if (raw instanceof PDFRawStream) chunks.push(decodePDFRawStream(raw).decode());
  else if (raw instanceof PDFArray) {
    for (let i = 0; i < raw.size(); i++) {
      const s = page.doc.context.lookup(raw.get(i)) ?? raw.lookup(i);
      if (s instanceof PDFRawStream) chunks.push(decodePDFRawStream(s).decode());
    }
  }
  return chunks.map((c) => new TextDecoder('latin1').decode(c)).join('');
}

function acroFields(doc: PDFDocument): PDFDict[] {
  const acro = doc.context.lookup(doc.catalog.get(PDFName.of('AcroForm'))) as PDFDict;
  expect(acro, 'AcroForm present').toBeDefined();
  const fields = doc.context.lookup(acro.get(PDFName.of('Fields'))) as PDFArray;
  const out: PDFDict[] = [];
  for (let i = 0; i < fields.size(); i++) out.push(doc.context.lookup(fields.get(i)) as PDFDict);
  return out;
}

describe('S1 field naming', () => {
  it('builds deterministic slugs', () => {
    expect(buildSignatureFieldName(1, 'I. M. MARINE')).toBe('Signature_1_I_M_MARINE');
    expect(buildSignatureFieldName(2, 'Smith, by direction')).toBe('Signature_2_SMITH_BY_DIRECTION');
    expect(buildSignatureFieldName(3)).toBe('Signature_3');
  });
});

describe('S1 annotation-only guarantee', () => {
  it('manual placement leaves the page content stream byte-identical', async () => {
    const base = await makeBasePdf();
    const before = decodedContents(await PDFDocument.load(base), 0);
    const out = await addSignatureFieldAtPosition(base, {
      page: 1, x: 100, y: 280, width: 108, height: 36, signerName: 'I. M. MARINE',
    });
    const after = decodedContents(await PDFDocument.load(out), 0);
    expect(after).toBe(before);
  });

  it('auto-anchor path draws no page content either', async () => {
    const base = await makeBasePdf();
    const before = decodedContents(await PDFDocument.load(base), 0);
    const out = await addSignatureField(base, { signerName: 'I. M. MARINE' });
    const after = decodedContents(await PDFDocument.load(out), 0);
    expect(after).toBe(before);
  });
});

describe('S1 field structure', () => {
  it('creates a named /Sig widget with appearance, SigFlags 3, correct rect', async () => {
    const base = await makeBasePdf();
    const out = await addSignatureFieldAtPosition(base, {
      page: 1, x: 100, y: 280, width: 108, height: 36, signerName: 'I. M. MARINE',
    });
    const doc = await PDFDocument.load(out);
    const acro = doc.context.lookup(doc.catalog.get(PDFName.of('AcroForm'))) as PDFDict;
    expect(String(acro.get(PDFName.of('SigFlags')))).toBe('3');
    const [field] = acroFields(doc);
    expect(String(field.get(PDFName.of('FT')))).toBe('/Sig');
    expect(String(field.get(PDFName.of('T')))).toContain('Signature_1_I_M_MARINE');
    const rect = doc.context.lookup(field.get(PDFName.of('Rect'))) ?? field.get(PDFName.of('Rect'));
    expect(String(rect)).toBe('[ 100 280 208 316 ]');
    const ap = field.get(PDFName.of('AP'));
    expect(ap, 'widget /AP present').toBeDefined();
    const apDict = (doc.context.lookup(ap) ?? ap) as PDFDict;
    const n = apDict.get(PDFName.of('N'));
    expect(n, '/AP /N appearance stream').toBeDefined();
    const apStream = doc.context.lookup(n as PDFRef);
    expect(apStream).toBeInstanceOf(PDFRawStream);
    const apOps = new TextDecoder('latin1').decode(decodePDFRawStream(apStream as PDFRawStream).decode());
    expect(apOps).toContain('Sign here: I. M. MARINE');
    // annotation registered on the page
    const annots = doc.context.lookup(doc.getPages()[0].node.get(PDFName.of('Annots'))) as PDFArray;
    expect(annots.size()).toBeGreaterThanOrEqual(1);
  });

  it('auto-anchor lands the field above the typed name at the signature indent', async () => {
    const base = await makeBasePdf();
    const out = await addSignatureField(base, { signerName: 'I. M. MARINE' });
    const doc = await PDFDocument.load(out);
    const [field] = acroFields(doc);
    const rect = String(doc.context.lookup(field.get(PDFName.of('Rect'))) ?? field.get(PDFName.of('Rect')));
    const nums = rect.replace(/[\[\]]/g, '').trim().split(/\s+/).map(Number);
    const x = PDF_MARGINS.left + PDF_INDENTS.signature;
    expect(nums[0]).toBe(x);
    // name drawn at y=300; field bottom = 300 + 24 (yAboveName)
    expect(nums[1]).toBe(324);
  });

  it('multiple positions get unique deterministic names', async () => {
    const base = await makeBasePdf();
    const out = await addMultipleSignatureFields(base, [
      { page: 1, x: 100, y: 280, width: 108, height: 36, signerName: 'A. SIGNER' },
      { page: 1, x: 100, y: 200, width: 108, height: 36, signerName: 'B. ENDORSER' },
    ]);
    const doc = await PDFDocument.load(out);
    const names = acroFields(doc).map((f) => String(f.get(PDFName.of('T'))));
    expect(names.some((n) => n.includes('Signature_1_A_SIGNER'))).toBe(true);
    expect(names.some((n) => n.includes('Signature_2_B_ENDORSER'))).toBe(true);
  });
});
