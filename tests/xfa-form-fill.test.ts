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
  bindEdipiField,
  officialFormPath,
  FormSlices,
} from '@/lib/xfa-form-fill';
import type { FormData } from '@/types';

const FORMS_DIR = join(__dirname, '..', 'public', 'forms');

/** Decodes one named packet out of a file's /XFA array. */
async function readPacket(bytes: Uint8Array, want: string): Promise<string> {
  const doc = await PDFDocument.load(bytes);
  const acroForm = doc.catalog.lookup(PDFName.of('AcroForm'), PDFDict);
  const xfa = acroForm.lookup(PDFName.of('XFA')) as PDFArray;
  for (let i = 0; i < xfa.size() - 1; i += 2) {
    const name = xfa.get(i);
    const text = name instanceof PDFString || name instanceof PDFHexString ? name.decodeText() : '';
    if (text === want) {
      const stream = xfa.lookup(i + 1) as PDFRawStream;
      return new TextDecoder().decode(decodePDFRawStream(stream).decode());
    }
  }
  throw new Error(`${want} not found`);
}

const readDatasets = (bytes: Uint8Array) => readPacket(bytes, 'datasets');

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

  /**
   * THE EDIPI FIELD, AND WHY THE TEST ABOVE WAS NOT ENOUGH.
   *
   * "NAVMC 118(11): filled values land in the datasets stream" passed every
   * day while the EDIPI box printed blank, because landing in the datasets
   * is not the same as reaching the page. Stephen reported the blank box on
   * 2026-08-28 and I had told him on 2026-08-27 it was not a defect, on the
   * strength of reading four exports and finding the field present in all
   * four. Present it was. Bound it was not.
   *
   * The blank's template declares <bind match="none"/> on EDIPI, which tells
   * Adobe not to bind it to the data DOM at all. These cases assert the
   * template that ships in the OUTPUT, which is the layer that decides
   * whether a value is drawn.
   */
  it('frees the EDIPI field to take its datasets value', async () => {
    const base = readFileSync(join(FORMS_DIR, 'navmc-118-11-blank.pdf'));
    const xml = buildNavmc11811Xml({
      documentType: 'page11', name: 'MARINE, TEST A.', edipi: '1234567890',
      remarksLeft: 'Round trip.', remarksRight: '',
    } as FormData);
    const out = await fillXfaDatasets(base, xml);

    // The value is in the data...
    expect(await readDatasets(out)).toContain('<EDIPI>1234567890</EDIPI>');
    // ...and the field will now accept it.
    const template = await readPacket(out, 'template');
    const edipi = template.slice(
      template.indexOf('<field name="EDIPI"'),
      template.indexOf('</field', template.indexOf('<field name="EDIPI"')),
    );
    expect(edipi).toContain('<bind match="once"');
    expect(edipi).not.toContain('<bind match="none"');
  });

  /**
   * THE OTHER FIVE STAY REFUSED. Three signature fields and two buttons
   * carry the same attribute, and each of them SHOULD. A signature field
   * bound to data would take a typed value where a signature belongs, and a
   * button bound to data is meaningless. Anchoring on match="none" itself
   * would have hit whichever came first.
   */
  it('leaves every other unbound field unbound', async () => {
    const base = readFileSync(join(FORMS_DIR, 'navmc-118-11-blank.pdf'));
    const before = await readPacket(new Uint8Array(base), 'template');
    expect((before.match(/<bind match="none"/g) ?? []).length).toBe(6);

    const out = await fillXfaDatasets(
      base,
      buildNavmc11811Xml({ documentType: 'page11', name: 'X', edipi: '1' } as FormData),
    );
    const after = await readPacket(out, 'template');
    expect((after.match(/<bind match="none"/g) ?? []).length).toBe(5);
    expect((after.match(/<bind match="once"/g) ?? []).length).toBe(1);

    // Named, so a future edit that frees a signature field reds this.
    for (const field of ['SignatureField1', 'ResetButton1', 'PrintButton1']) {
      const at = after.indexOf(`<field name="${field}"`);
      expect(at, field).toBeGreaterThan(-1);
      expect(after.slice(at, after.indexOf('</field', at)), field).toContain(
        '<bind match="none"',
      );
    }
  });

  /**
   * NOTHING ELSE IN THE TEMPLATE MOVES. The patch is one attribute; a
   * decompress and recompress that dropped or reordered anything would be
   * invisible to the assertions above and fatal in Adobe.
   */
  it('changes exactly nine characters of the template', async () => {
    const base = readFileSync(join(FORMS_DIR, 'navmc-118-11-blank.pdf'));
    const before = await readPacket(new Uint8Array(base), 'template');
    const out = await fillXfaDatasets(
      base,
      buildNavmc11811Xml({ documentType: 'page11', name: 'X', edipi: '1' } as FormData),
    );
    const after = await readPacket(out, 'template');

    expect(after.length).toBe(before.length);
    expect(after).toBe(before.replace('<bind match="none"\n/><validate', '<bind match="once"\n/><validate'));
  });

  // The other two blanks carry no EDIPI field, so the anchor is absent and
  // their templates must come through untouched.
  it.each([
    ['navmc-10274-blank.pdf', 'aa-form'],
    ['navmc-10922-blank.pdf', 'navmc10922'],
  ])('leaves the %s template alone', async (file) => {
    const base = readFileSync(join(FORMS_DIR, file));
    const before = await readPacket(new Uint8Array(base), 'template');
    expect(bindEdipiField(before)).toBe(before);
  });

  it('refuses a non-XFA base', async () => {
    const plain = await PDFDocument.create();
    plain.addPage();
    const bytes = await plain.save();
    await expect(fillXfaDatasets(bytes, '<x/>')).rejects.toThrow(/XFA/);
  });
});

describe('routing table', () => {
  it('maps only the three form types', () => {
    expect(officialFormPath('aa-form')).toContain('navmc-10274-blank.pdf');
    expect(officialFormPath('page11')).toContain('navmc-118-11-blank.pdf');
    expect(officialFormPath('navmc10922')).toContain('navmc-10922-blank.pdf');
    expect(officialFormPath('basic')).toBeNull();
  });
});
