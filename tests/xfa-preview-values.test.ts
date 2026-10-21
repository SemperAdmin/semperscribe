/**
 * pdf.js trims a data value's leading whitespace; the preview puts it
 * back from the values the app wrote (src/lib/xfa-preview-values.ts).
 */
import { describe, it, expect } from 'vitest';
import { applyXfaFieldValues, xfaFieldNameOf, type XfaHtmlNode } from '@/lib/xfa-preview-values';
import { navmc10274FieldValues, buildNavmc10274Xml } from '@/lib/xfa-form-fill';
import { aaSignatureLead } from '@/lib/navmc10274-layout';
import { TLE_EXTENSION_FIXTURE } from './fixtures/navmc10274-tle-extension';
import type { FormData, ParagraphData } from '@/types';

const fx = TLE_EXTENSION_FIXTURE;
const slices = {
  formData: fx.formData as unknown as FormData,
  vias: fx.vias, references: fx.references, enclosures: fx.enclosures, copyTos: fx.copyTos,
  paragraphs: fx.paragraphs as unknown as ParagraphData[],
};

describe('xfaFieldNameOf', () => {
  it('reads the field name off pdf.js\'s dataId and nothing else', () => {
    const names = ['ProcAct', 'Via1', 'Encl1', 'Date'];
    expect(xfaFieldNameOf('ProcAct582', names)).toBe('ProcAct');
    expect(xfaFieldNameOf('Via1574', names)).toBe('Via1'); // the field's own digit is not the uid
    expect(xfaFieldNameOf('Encl1580', names)).toBe('Encl1');
    expect(xfaFieldNameOf('field1187', names)).toBeNull();
    expect(xfaFieldNameOf('Date', names)).toBeNull(); // no uid
    expect(xfaFieldNameOf(undefined, names)).toBeNull();
  });
});

describe('applyXfaFieldValues', () => {
  const tree = (): XfaHtmlNode => ({
    name: 'div',
    children: [
      { name: 'div', children: [{ name: 'textarea', attributes: { dataId: 'ProcAct582', textContent: 'S. N. SHORTER' } }] },
      { name: 'input', attributes: { dataId: 'Date570', value: '2026-10-19' } },
      { name: 'textarea', attributes: { dataId: 'CopyTo578', textContent: '' } },
      null,
      { name: 'textarea', attributes: { textContent: 'no data id' } },
    ],
  });

  it('restores leading blank lines and the centring lead, by field name, inputs and textareas alike', () => {
    const t = tree();
    const n = applyXfaFieldValues(t, { ProcAct: '\n\n\n    S. N. SHORTER', Date: '2026-10-19' });
    expect(n).toBe(2);
    const textarea = t.children![0]!.children![0]!;
    expect(textarea.attributes!.textContent).toBe('\n\n\n    S. N. SHORTER');
    expect(t.children![2]!.attributes!.textContent).toBe('');
    expect(t.children![4]!.attributes!.textContent).toBe('no data id');
  });

  it('normalises carriage returns and tolerates an empty tree', () => {
    const t = tree();
    applyXfaFieldValues(t, { ProcAct: 'A\r\nB\rC' });
    expect(t.children![0]!.children![0]!.attributes!.textContent).toBe('A\nB\nC');
    expect(applyXfaFieldValues(null, { ProcAct: 'x' })).toBe(0);
  });
});

describe('navmc10274FieldValues', () => {
  it('is the table the datasets are written from, with block 13 opening on three blank lines and the lead', () => {
    const v = navmc10274FieldValues(slices);
    const lead = ' '.repeat(aaSignatureLead());
    expect(v.ProcAct).toBe(`\n\n\n${lead}F. M. LASTNAME`);
    expect(v.Date).toBe('2026-10-19');
    expect(v.SuppInfo.startsWith('1.  Per references')).toBe(true);
    const xml = buildNavmc10274Xml(slices);
    expect(xml).toContain(`<ProcAct>&#xD;&#xD;&#xD;${lead}F. M. LASTNAME</ProcAct>`);
    expect(xml).toContain('<Date>2026-10-19</Date>');
  });
});
