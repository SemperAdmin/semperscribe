/**
 * XFA official-form export (docs/AA_FORMS_TEMPLATE_PLAN.md addendum).
 *
 * The round-trip test runs against the REAL bundled NAVMC blanks in
 * public/forms/ - fill the datasets stream, re-open the output, decode
 * the stream, and assert the values landed. Adobe rendering was gated
 * by hand (2026-07-17); this guards the mechanics from regressing.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PDFDocument, PDFName, PDFDict, PDFArray, PDFString, PDFHexString, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import {
  buildNavmc10274Xml,
  buildNavmc11811Xml,
  fillXfaDatasets,
  officialFormPath,
  FormSlices,
} from '@/lib/xfa-form-fill';
import type { FormData } from '@/types';

const FORMS_DIR = join(__dirname, '..', 'public', 'forms');

async function readDatasets(bytes: Uint8Array): Promise<string> {
  const doc = await PDFDocument.load(bytes);
  const acroForm = doc.catalog.lookup(PDFName.of('AcroForm'), PDFDict);
  const xfa = acroForm.lookup(PDFName.of('XFA')) as PDFArray;
  for (let i = 0; i < xfa.size() - 1; i += 2) {
    const name = xfa.get(i);
    const text = name instanceof PDFString || name instanceof PDFHexString ? name.decodeText() : '';
    if (text === 'datasets') {
      const stream = xfa.lookup(i + 1) as PDFRawStream;
      return new TextDecoder().decode(decodePDFRawStream(stream).decode());
    }
  }
  throw new Error('datasets not found');
}

function slices(over: Partial<FormData> = {}): FormSlices {
  return {
    formData: {
      documentType: 'aa-form', date: '17 Jul 26', actionNo: '001-26', ssic: '7220',
      from: 'Sgt Test A. Marine, 1234567890/0111, USMC',
      orgStation: 'TEST UNIT\n123 STREET\nQUANTICO VA 22134',
      to: 'CMC (MMIB-3)', subj: 'REQUEST FOR <TEST> & VERIFICATION',
      startingReferenceLevel: 'a', startingEnclosureNumber: '1',
      ...over,
    } as FormData,
    vias: ['CO, Test Battalion'],
    references: ['JTR', 'MCO 7220.56A'],
    enclosures: ['BASIC ORDERS'],
    copyTos: ['(1) SNM'],
    paragraphs: [
      { id: 1, level: 1, content: 'First paragraph.' },
      { id: 2, level: 2, content: 'Sub item.' },
    ],
  };
}

describe('XML builders', () => {
  it('escapes XML metacharacters and renumbers lists', () => {
    const xml = buildNavmc10274Xml(slices());
    expect(xml).toContain('REQUEST FOR &lt;TEST&gt; &amp; VERIFICATION');
    expect(xml).toContain('(a) JTR');
    expect(xml).toContain('(b) MCO 7220.56A');
    expect(xml).toContain('(1) BASIC ORDERS');
    expect(xml).not.toContain('<REQUEST'); // raw < must never survive
  });

  it('converts newlines to XFA CR entities', () => {
    const xml = buildNavmc10274Xml(slices());
    expect(xml).toContain('TEST UNIT&#xD;123 STREET&#xD;QUANTICO VA 22134');
  });

  it('reconstructs paragraph citations like the flattened renderer', () => {
    const xml = buildNavmc10274Xml(slices());
    expect(xml).toContain('1.  First paragraph.');
    expect(xml).toContain('a.  Sub item.');
  });

  it('builds page11 XML from the left-flow fields', () => {
    const xml = buildNavmc11811Xml({
      documentType: 'page11', name: 'MARINE, TEST A.', edipi: '1234567890',
      remarksLeft: 'Entry text line one.\nLine two.', remarksRight: '',
    } as FormData);
    expect(xml).toContain('<NameLFM>MARINE, TEST A.</NameLFM>');
    expect(xml).toContain('Entry text line one.&#xD;Line two.');
    expect(xml).toContain('<Remarks2/>');
  });
});

describe('fillXfaDatasets round-trip on the real blanks', () => {
  it('NAVMC 10274: filled values land in the datasets stream', async () => {
    const base = readFileSync(join(FORMS_DIR, 'navmc-10274-blank.pdf'));
    const out = await fillXfaDatasets(base, buildNavmc10274Xml(slices()));
    const ds = await readDatasets(out);
    expect(ds).toContain('REQUEST FOR &lt;TEST&gt; &amp; VERIFICATION');
    expect(ds).toContain('(a) JTR');
    expect(ds).toContain('1.  First paragraph.');
  });

  it('NAVMC 118(11): filled values land in the datasets stream', async () => {
    const base = readFileSync(join(FORMS_DIR, 'navmc-118-11-blank.pdf'));
    const xml = buildNavmc11811Xml({
      documentType: 'page11', name: 'MARINE, TEST A.', edipi: '1234567890',
      remarksLeft: 'Round trip.', remarksRight: '',
    } as FormData);
    const ds = await readDatasets(await fillXfaDatasets(base, xml));
    expect(ds).toContain('MARINE, TEST A.');
    expect(ds).toContain('Round trip.');
  });

  it('keeps the dynamic-XFA flag so Adobe re-renders', async () => {
    const base = readFileSync(join(FORMS_DIR, 'navmc-10274-blank.pdf'));
    const out = await fillXfaDatasets(base, buildNavmc10274Xml(slices()));
    const doc = await PDFDocument.load(out);
    const nr = doc.catalog.lookup(PDFName.of('NeedsRendering'));
    expect(String(nr)).toBe('true');
  });

  it('refuses a non-XFA base', async () => {
    const plain = await PDFDocument.create();
    plain.addPage();
    const bytes = await plain.save();
    await expect(fillXfaDatasets(bytes, '<x/>')).rejects.toThrow(/XFA/);
  });
});

describe('routing table', () => {
  it('maps only the two form types', () => {
    expect(officialFormPath('aa-form')).toContain('navmc-10274-blank.pdf');
    expect(officialFormPath('page11')).toContain('navmc-118-11-blank.pdf');
    expect(officialFormPath('basic')).toBeNull();
  });
});
