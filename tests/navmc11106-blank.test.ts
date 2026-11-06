// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  PDFDict, PDFDocument, PDFName, PDFButton, PDFRadioGroup, PDFSignature, PDFTextField,
} from 'pdf-lib';
import map from '../tools/aa-forms/navmc11106-map.json';

const here = dirname(fileURLToPath(import.meta.url));
const blankPath = resolve(here, '../public/forms/navmc-11106-blank.pdf');

let bytes: Uint8Array;
let doc: PDFDocument;

beforeAll(async () => {
  bytes = new Uint8Array(readFileSync(blankPath));
  doc = await PDFDocument.load(bytes);
});

describe('NAVMC 11106 normalized blank', () => {
  it('has no XFA layer, usage rights, or document JavaScript', () => {
    const acro = doc.catalog.lookup(PDFName.of('AcroForm'), PDFDict);
    expect(acro.has(PDFName.of('XFA'))).toBe(false);
    expect(doc.catalog.has(PDFName.of('Perms'))).toBe(false);
    const names = doc.catalog.lookupMaybe(PDFName.of('Names'), PDFDict);
    expect(names?.has(PDFName.of('JavaScript')) ?? false).toBe(false);
  });

  it('dropped the Print and Reset buttons and kept both signature fields', () => {
    const fields = doc.getForm().getFields();
    expect(fields.filter((f) => f instanceof PDFButton)).toHaveLength(0);
    const sigs = fields.filter((f) => f instanceof PDFSignature).map((f) => f.getName());
    expect(sigs.sort()).toEqual([
      'topmostSubform[0].Page1[0].SigCO[0]',
      'topmostSubform[0].Page1[0].SigMem[0]',
    ]);
  });

  it('carries no preset values', () => {
    for (const f of doc.getForm().getFields()) {
      if (f instanceof PDFTextField) expect(f.getText() ?? '').toBe('');
      if (f instanceof PDFRadioGroup) expect(f.getSelected()).toBeUndefined();
    }
  });

  it('keeps the form radio appearances, so pdf-lib will not redraw them as dots', () => {
    for (const f of doc.getForm().getFields()) {
      if (f instanceof PDFRadioGroup) expect(f.needsAppearancesUpdate()).toBe(false);
    }
  });

  it('prints EDIPI and no longer prints SSN', async () => {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const loaded = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
    const content = await (await loaded.getPage(1)).getTextContent();
    const text = content.items.map((i) => ('str' in i ? i.str : '')).join(' ');
    expect(text).toContain('EDIPI');
    expect(text).not.toContain('SSN');
  });

  it('matches its field map', () => {
    const names = doc.getForm().getFields().map((f) => f.getName()).sort();
    expect(map.fields.map((f) => f.name).sort()).toEqual(names);
    expect(map.fieldCount).toBe(45);
    expect(map.sourceSha256).toBe('8d2bfef56dbc0a1ad75337968724b0a3ea4d92a19faad8875307c27ca13b2485');
  });
});
