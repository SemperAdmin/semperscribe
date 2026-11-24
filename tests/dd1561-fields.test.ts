/** DD 1561 DEC 2017 blank and field map stay in step (docs/DD1561_FSA_SPEC.md, Phase 1). */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PDFDocument, PDFCheckBox, PDFSignature, PDFTextField, PDFName, PDFString, PDFHexString } from 'pdf-lib';
import { DD1561_ALL_FIELD_NAMES, DD1561_FIELDS, DD1561_FSA_R, DD1561_FSA_T_ROWS } from '@/lib/dd1561-fields';

const BLANK = join(__dirname, '..', 'public', 'forms', 'dd-1561-blank.pdf');

async function load() {
  return PDFDocument.load(new Uint8Array(readFileSync(BLANK)));
}

describe('DD 1561 blank', () => {
  it('is a one-page, unencrypted AcroForm with no XFA layer', async () => {
    const doc = await load();
    expect(doc.getPageCount()).toBe(1);
    expect(doc.isEncrypted).toBe(false);
    const acro = doc.catalog.lookup(PDFName.of('AcroForm'));
    expect(acro && 'get' in acro ? (acro as { get(n: PDFName): unknown }).get(PDFName.of('XFA')) : undefined).toBeUndefined();
  });

  it('is the DEC 2017 edition with a DoD ID block, not SSN', async () => {
    const form = (await load()).getForm();
    const tooltip = (name: string) => {
      const tu = form.getField(name).acroField.dict.lookup(PDFName.of('TU'));
      return tu instanceof PDFString || tu instanceof PDFHexString ? tu.decodeText() : '';
    };
    expect(tooltip(DD1561_FIELDS.dodId)).toBe('3. DoD ID NUMBER');
    const all = form.getFields().map((f) => tooltip(f.getName())).join(' ');
    expect(all).not.toMatch(/social security|SSN/i);
  });
});

describe('DD 1561 field map', () => {
  it('names 49 fields, every one present on the blank', async () => {
    const form = (await load()).getForm();
    expect(DD1561_ALL_FIELD_NAMES).toHaveLength(49);
    expect(new Set(DD1561_ALL_FIELD_NAMES).size).toBe(49);
    for (const name of DD1561_ALL_FIELD_NAMES) {
      expect(form.getFieldMaybe(name), name).toBeDefined();
    }
  });

  it('covers every fillable field on the blank (only the reset button is unmapped)', async () => {
    const onBlank = (await load()).getForm().getFields().map((f) => f.getName());
    const unmapped = onBlank.filter((n) => !DD1561_ALL_FIELD_NAMES.includes(n));
    expect(unmapped).toEqual(['form1[0].#pageSet[0].Page1[0].ResetButton[0]']);
  });

  it('types match: checkboxes, signatures and text where expected', async () => {
    const form = (await load()).getForm();
    const checkboxes = [
      DD1561_FIELDS.typeFsaT, DD1561_FIELDS.typeFsaR, DD1561_FIELDS.typeFsaS,
      DD1561_FIELDS.cert8a, DD1561_FIELDS.cert8b, DD1561_FIELDS.cert8c, DD1561_FIELDS.cert8d,
      DD1561_FIELDS.cert8e, DD1561_FIELDS.cert8f, DD1561_FIELDS.cert8fSpouseWas, DD1561_FIELDS.cert8fSpouseWasNot,
      DD1561_FIELDS.cert8g, DD1561_FIELDS.cert8gLastTdyWas, DD1561_FIELDS.cert8gLastTdyWasNot,
    ];
    for (const n of checkboxes) expect(form.getField(n), n).toBeInstanceOf(PDFCheckBox);
    for (const n of [DD1561_FIELDS.memberSignature, DD1561_FIELDS.certifierSignature]) {
      expect(form.getField(n), n).toBeInstanceOf(PDFSignature);
    }
    const text = DD1561_ALL_FIELD_NAMES.filter((n) => !checkboxes.includes(n as never)
      && n !== DD1561_FIELDS.memberSignature && n !== DD1561_FIELDS.certifierSignature);
    expect(text).toHaveLength(33);
    for (const n of text) expect(form.getField(n), n).toBeInstanceOf(PDFTextField);
  });

  it('has three FSA-T rows and the six FSA-R fields', () => {
    expect(DD1561_FSA_T_ROWS).toHaveLength(3);
    expect(Object.keys(DD1561_FSA_R)).toHaveLength(6);
  });
});
