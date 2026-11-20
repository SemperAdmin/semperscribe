/**
 * NAVMC 10922 fillable rebuild (owner decision 2026-11-20,
 * docs/NAVMC_10922_SPEC.md section 11): the layout-faithful redraw is a
 * standard AcroForm, prefilled and still editable, never flattened.
 *
 * Both artwork modes are covered: the Adobe-print background the browser
 * loads, and the programmatic redraw used when it cannot.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  PDFDocument, PDFName, PDFDict, PDFArray, PDFTextField, PDFRadioGroup, PDFCheckBox,
  PDFDropdown, PDFSignature, PDFField,
} from 'pdf-lib';
import {
  generateNavmc10922, navmc10922FieldName, NAVMC10922_SECTION8_FIELDS, ATTESTING_OFFICER_FIELD,
} from '@/services/pdf/navmc10922Generator';
import { addMultipleSignatureFields } from '@/lib/pdf-signature-field';
import { mergeAttachmentsIntoPdf } from '@/lib/enclosure-attachments';
import { baseline } from './navmc10922-cases';
import type { FormData } from '@/types';

const BG = [1, 2, 3].map((n) => readFileSync(join(__dirname, '..', 'public', 'templates', 'navmc10922', `page${n}.pdf`)));

function sample(): FormData {
  const d = baseline();
  d.memberPrevMarried = 'yes';
  d.memberPrevMarriedTimes = '1';
  d.dissolutions[0] = {
    formerMarriageOf: 'self', spouseName: 'PRIOR P SPOUSE',
    dateOfDissolution: '2019-03-15', placeOfDissolution: 'WASHOE COUNTY NV', reason: 'divorce',
  };
  d.swornDay = '20'; d.swornMonth = 'July'; d.swornYear2Digit = '26';
  d.attestingOfficerGrade = 'SSGT';
  d.attestingOfficerTitle = 'ADMIN CHIEF';
  return d;
}

async function load(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes);
  return { doc, form: doc.getForm() };
}

function countByType(fields: PDFField[]) {
  const count = { text: 0, radio: 0, checkbox: 0, dropdown: 0, signature: 0 };
  for (const f of fields) {
    if (f instanceof PDFTextField) count.text++;
    else if (f instanceof PDFRadioGroup) count.radio++;
    else if (f instanceof PDFCheckBox) count.checkbox++;
    else if (f instanceof PDFDropdown) count.dropdown++;
    else if (f instanceof PDFSignature) count.signature++;
  }
  return count;
}

describe.each([
  ['Adobe-print background', BG as Uint8Array[] | null],
  ['programmatic redraw', null],
])('NAVMC 10922 fillable rebuild (%s)', (_mode, backgrounds) => {
  it('carries an AcroForm with every value cell as a field of the right type', async () => {
    const { form } = await load(await generateNavmc10922(sample(), backgrounds));
    const fields = form.getFields();
    // 102 XFA indices (index 94 is one field with a widget on pages 1 and
    // 2) + the attesting officer's typed line + the five unbindable boxes.
    expect(fields.length).toBe(108);
    expect(countByType(fields)).toEqual({ text: 82, radio: 17, checkbox: 5, dropdown: 1, signature: 3 });
    expect(new Set(fields.map((f) => f.getName())).size).toBe(108);
    expect(form.getTextField('s1.nameOfMarine').acroField.getWidgets().length).toBe(2);
  });

  it('lands sample values in the right named fields', async () => {
    const { form } = await load(await generateNavmc10922(sample(), backgrounds));
    expect(form.getTextField('s1.dateOfApplication').getText()).toBe('Jul 1, 2026');
    expect(form.getTextField('s1.nameOfMarine').getText()).toBe('MARINE, ALONZO DEAN');
    expect(form.getTextField('s1.edipi').getText()).toBe('1234567890');
    expect(form.getTextField('s1.organizationStation').getText()).toBe('1ST BN 6TH MARINES 2D MARDIV\nCAMP LEJEUNE NC 28547');
    expect(form.getTextField('s2.dep1.name').getText()).toBe('TONYA CAROL MARINE');
    expect(form.getTextField('s2.dep1.dob').getText()).toBe('7/7/97');
    expect(form.getTextField('s2.dep2.name').getText() ?? '').toBe('');
    expect(form.getTextField('s4.memberPrevMarriedTimes').getText()).toBe('1');
    expect(form.getTextField('s4.diss1.spouseName').getText()).toBe('PRIOR P SPOUSE');
    expect(form.getTextField('s4.diss1.date').getText()).toBe('3/15/19');
    expect(form.getTextField('s7.documentsViewed').getText()).toBe('MARRIAGE CERTIFICATE');
    expect(form.getTextField('s7.edipi').getText()).toBe('1234567890');
    expect(form.getDropdown('s7.swornMonth').getSelected()).toEqual(['July']);
    expect(form.getTextField('s7.swornDay').getText()).toBe('20');
    // Radios carry the XFA value maps (spec section 4).
    expect(form.getRadioGroup('s1.reason').getSelected()).toBe('3'); // GAIN
    expect(form.getRadioGroup('s1.typeOfService').getSelected()).toBe('2'); // USMC
    expect(form.getRadioGroup('s4.memberPrevMarried').getSelected()).toBe('1'); // YES
    expect(form.getRadioGroup('s4.diss1.reason').getSelected()).toBe('3'); // DIVORCE
    expect(form.getRadioGroup('s6.spouseBaq').getSelected()).toBeUndefined();
    expect(form.getCheckBox('s1.start').isChecked()).toBe(false);
  });

  it('checks START for a START application, and leaves the reason radio empty', async () => {
    const d = sample();
    d.reason = 'start';
    const { form } = await load(await generateNavmc10922(d, backgrounds));
    expect(form.getCheckBox('s1.start').isChecked()).toBe(true);
    expect(form.getRadioGroup('s1.reason').getSelected()).toBeUndefined();
  });

  it('creates every Section 8 field empty and editable, whatever the document holds', async () => {
    const d = sample() as FormData & Record<string, unknown>;
    // Even stray values on the document must not reach Section 8.
    Object.assign(d, { unitDesignation: '1ST BN 6TH MAR', coTypedNameGrade: 'LTCOL X', approvedAsClaimed: true });
    const { form } = await load(await generateNavmc10922(d, backgrounds));
    expect(NAVMC10922_SECTION8_FIELDS.length).toBe(13);
    for (const name of NAVMC10922_SECTION8_FIELDS) {
      const field = form.getField(name);
      expect(field.isReadOnly(), name).toBe(false);
      if (field instanceof PDFTextField) expect(field.getText() ?? '', name).toBe('');
      else if (field instanceof PDFCheckBox) expect(field.isChecked(), name).toBe(false);
      else if (field instanceof PDFSignature) expect(field.acroField.dict.has(PDFName.of('V')), name).toBe(false);
      else throw new Error(`unexpected Section 8 field type: ${name}`);
    }
    for (const name of ['s7.documentViewed', 's8.approvedAsClaimed', 's8.approvedForDependentNumbers', 's8.forwardedToCmc']) {
      expect(form.getCheckBox(name).isChecked(), name).toBe(false);
    }
  });

  it('prints the attesting officer typed name, grade and title, and leaves it empty when all are blank', async () => {
    const { form } = await load(await generateNavmc10922(sample(), backgrounds));
    expect(form.getTextField(ATTESTING_OFFICER_FIELD).getText()).toBe('SSGT STEWART, THOMAS J / ADMIN CHIEF');

    const blank = sample();
    blank.attestingOfficerName = '';
    blank.attestingOfficerGrade = '';
    blank.attestingOfficerTitle = '';
    const again = await load(await generateNavmc10922(blank, backgrounds));
    expect(again.form.getTextField(ATTESTING_OFFICER_FIELD).getText() ?? '').toBe('');
  });

  it('places the attesting officer line under the signature area, inside its cell', async () => {
    const { form } = await load(await generateNavmc10922(sample(), backgrounds));
    const line = form.getTextField(ATTESTING_OFFICER_FIELD).acroField.getWidgets()[0].getRectangle();
    const sig = form.getSignature('s7.attestingOfficerSignature').acroField.getWidgets()[0].getRectangle();
    expect(line.y + line.height).toBeLessThanOrEqual(sig.y); // fully below the signature area
    expect(line.x).toBeGreaterThanOrEqual(sig.x - 0.01);
    expect(line.x + line.width).toBeLessThanOrEqual(sig.x + sig.width + 0.01);
  });

  it('is not flattened: fields stay editable and carry appearance streams', async () => {
    const bytes = await generateNavmc10922(sample(), backgrounds);
    const { doc, form } = await load(bytes);
    for (const field of form.getFields()) {
      expect(field.isReadOnly(), field.getName()).toBe(false);
      for (const w of field.acroField.getWidgets()) {
        if (field instanceof PDFSignature) continue;
        expect(w.dict.lookup(PDFName.of('AP')), `${field.getName()} has /AP`).toBeInstanceOf(PDFDict);
      }
    }
    // Every page carries its widgets.
    const annots = doc.getPages().map((p) => (p.node.lookup(PDFName.of('Annots')) as PDFArray | undefined)?.size() ?? 0);
    expect(annots[0]).toBeGreaterThan(50);
    expect(annots[1]).toBeGreaterThan(30);
    // The default resources name the value font, so a viewer redraws an edit in it.
    const dr = form.acroForm.dict.lookup(PDFName.of('DR'), PDFDict);
    expect(dr.lookup(PDFName.of('Font'), PDFDict).keys().length).toBeGreaterThan(0);
    // Nothing is signed: no SigFlags claiming signatures exist.
    expect(form.acroForm.dict.has(PDFName.of('SigFlags'))).toBe(false);

    // A viewer edit works: fill, check, select, and save again.
    form.getTextField('s8.unitDiary.number').setText('123');
    form.getCheckBox('s8.approvedAsClaimed').check();
    form.getRadioGroup('s6.spouseBaq').select('1');
    const edited = await load(await doc.save());
    expect(edited.form.getTextField('s8.unitDiary.number').getText()).toBe('123');
    expect(edited.form.getCheckBox('s8.approvedAsClaimed').isChecked()).toBe(true);
  });
});

describe('NAVMC 10922 rebuild with user signature fields and bound enclosures', () => {
  it('keeps every form field when signature fields are stamped and an enclosure is merged', async () => {
    const base = await generateNavmc10922(sample(), null);
    const signed = await addMultipleSignatureFields(base, [{ page: 2, x: 400, y: 100, width: 120, height: 30, signerName: 'CO' }]);
    const encl = await PDFDocument.create();
    encl.addPage([612, 792]);
    const merged = await mergeAttachmentsIntoPdf(signed, [{
      number: 1,
      attachment: { title: 'Marriage certificate', fileName: 'cert.pdf', mimeType: 'application/pdf', bytes: await encl.save() },
    } as never], { coverPages: false });
    const { doc, form } = await load(merged);
    expect(doc.getPageCount()).toBe(4);
    expect(form.getFields().length).toBe(109);
    expect(form.getTextField('s1.edipi').getText()).toBe('1234567890');
    expect(form.getSignature('Signature_1_CO')).toBeDefined();
  });
});

describe('field naming', () => {
  it('names rows by section and position', () => {
    expect(navmc10922FieldName(11)).toBe('s2.dep1.name');
    expect(navmc10922FieldName(40)).toBe('s2.dep6.allowanceClaimedFrom');
    expect(navmc10922FieldName(52)).toBe('s4.diss1.formerMarriageOf');
    expect(navmc10922FieldName(71)).toBe('s4.diss4.date');
    expect(navmc10922FieldName(100)).toBe('s8.coTypedNameGrade');
  });
});
