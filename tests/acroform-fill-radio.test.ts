import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PDFDocument, PDFDict, PDFRadioGroup } from 'pdf-lib';
import { fillAcroFormWithReport, type AcroFormFieldMeta } from '@/lib/acroform-fill';
import map from '../tools/aa-forms/navmc11106-map.json';

const here = dirname(fileURLToPath(import.meta.url));
const blank = () => new Uint8Array(readFileSync(resolve(here, '../public/forms/navmc-11106-blank.pdf')));
const fields = map.fields as AcroFormFieldMeta[];
const RAD = 'topmostSubform[0].Page1[0].RadA1[0]';

describe('acroform-fill radio groups', () => {
  it('selects the value and reports it written', async () => {
    const { bytes, report } = await fillAcroFormWithReport(blank(), { [RAD]: 'both' }, { fields });
    expect(report.written).toContain(RAD);
    expect(report.errors).toEqual([]);
    const group = (await PDFDocument.load(bytes)).getForm().getRadioGroup(RAD);
    expect(group.getSelected()).toBe('both');
  });

  it('keeps the form appearance streams rather than redrawing them', async () => {
    const before = (await PDFDocument.load(blank())).getForm().getRadioGroup(RAD);
    const refsBefore = before.acroField.getWidgets().map((w) => w.getAppearances()?.normal);
    expect(refsBefore.every((n) => n instanceof PDFDict)).toBe(true);

    const { bytes } = await fillAcroFormWithReport(blank(), { [RAD]: 'both' }, { fields });
    const group = (await PDFDocument.load(bytes)).getForm().getRadioGroup(RAD);
    expect(group.needsAppearancesUpdate()).toBe(false);
    const states = group.acroField.getWidgets().map((w) => w.getAppearanceState()?.toString());
    expect(states.sort()).toEqual(['/Off', '/Off', '/both']);
  });

  it('reports a bad value instead of throwing, and leaves the group unset', async () => {
    const { bytes, report } = await fillAcroFormWithReport(blank(), { [RAD]: 'nope' }, { fields });
    expect(report.errors[0][0]).toBe(RAD);
    const field = (await PDFDocument.load(bytes)).getForm().getField(RAD);
    expect(field).toBeInstanceOf(PDFRadioGroup);
    expect((field as PDFRadioGroup).getSelected()).toBeUndefined();
  });

  it('leaves untouched groups unset', async () => {
    const { bytes } = await fillAcroFormWithReport(blank(), { [RAD]: 'mem' }, { fields });
    const other = (await PDFDocument.load(bytes)).getForm().getRadioGroup('topmostSubform[0].Page1[0].RadD2B1[0]');
    expect(other.getSelected()).toBeUndefined();
  });
});
