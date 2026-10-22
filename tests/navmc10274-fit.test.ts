/**
 * NAVMC 10274 fit validator: the export gate's one check against text
 * Acrobat would clip on the official form (src/lib/navmc10274-fit.ts).
 */
import { describe, it, expect } from 'vitest';
import { describeAaFit, navmc10274FitReport, validateNavmc10274Fit } from '@/lib/navmc10274-fit';
import { getExportBlockers, runLetterValidators } from '@/lib/letter-validators';
import { TLE_EXTENSION_FIXTURE } from './fixtures/navmc10274-tle-extension';
import type { FormData, ParagraphData } from '@/types';

const fx = TLE_EXTENSION_FIXTURE;
const formData = fx.formData as unknown as FormData;
const paragraphs = fx.paragraphs as unknown as ParagraphData[];
let nextId = 100;
const ones = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: ++nextId, level: 1, content: `Para ${i + 1}` })) as ParagraphData[];
const inputs = (over: Partial<Record<string, unknown>> = {}, paras = paragraphs) => ({
  formData: { ...formData, ...over } as FormData,
  vias: fx.vias,
  references: fx.references,
  enclosures: fx.enclosures,
  copyTos: fx.copyTos,
  paragraphs: paras,
});

describe('navmc10274FitReport', () => {
  it('reports the owner\'s request as fitting block 12 with the name in block 13 and no small box over', () => {
    const r = navmc10274FitReport(inputs());
    expect(r.flow.fits).toBe(true);
    expect(r.flow.signatureBlock).toBe(13);
    expect(r.overflows).toEqual([]);
    expect(r.capacity).toEqual({ block12: 30, block13: 59 });
  });

  it('names a small box whose text takes more lines than it holds', () => {
    const r = navmc10274FitReport(inputs({ to: Array.from({ length: 8 }, (_, i) => `Line ${i + 1}`).join('\n') }));
    expect(r.overflows.map(o => [o.field.block, o.lines, o.capacity, o.formField])).toEqual([[7, 8, 7, 'to']]);
  });

  it('counts the via box with the shared numbering', () => {
    const r = navmc10274FitReport({ ...inputs(), vias: ['A', 'B', 'C'] });
    expect(r.overflows.map(o => o.field.block)).toEqual([6]);
  });
});

describe('validateNavmc10274Fit', () => {
  it('is a no-op for every other document type', () => {
    expect(validateNavmc10274Fit({ ...formData, documentType: 'basic' }, [], [], [], ones(60))).toEqual([]);
  });

  it('warns, not blocks, when the text continues in block 13', () => {
    const issues = validateNavmc10274Fit(formData, fx.vias, fx.references, fx.enclosures, paragraphs);
    expect(issues.map(i => [i.id, i.severity])).toEqual([['aa-form-block13', 'warn']]);
    expect(issues[0].detail).toMatch(/typed name lands in block 13/);
  });

  it('blocks when block 12 plus block 13 cannot hold the text', () => {
    const issues = validateNavmc10274Fit(formData, [], [], [], ones(44));
    expect(issues.map(i => [i.id, i.severity])).toEqual([['aa-form-body-overflow', 'block']]);
    expect(issues[0].rule).toMatch(/hold 89 lines; .* take 90, 2 past block 13/);
  });

  it('is silent when everything fits block 12', () => {
    expect(validateNavmc10274Fit(formData, [], [], [], ones(3))).toEqual([]);
  });

  it('warns per overflowing small box, pointing at its input', () => {
    const issues = validateNavmc10274Fit(
      { ...formData, subj: 'WORD '.repeat(60).trim() }, [], [], [], ones(3),
    );
    expect(issues.map(i => [i.id, i.severity, i.field])).toEqual([['aa-form-box-8', 'warn', 'subj']]);
    expect(issues[0].rule).toMatch(/^Block 8 \(Nature of Action\/Subject\) holds 4 lines at 9 pt; the text takes \d+\.$/);
  });

  it('reaches the export gate through the validator runner', () => {
    const over = { ...formData } as FormData;
    expect(getExportBlockers(over, [], [], ones(44)).map(i => i.id)).toContain('aa-form-body-overflow');
    expect(runLetterValidators(over, fx.vias, fx.references, paragraphs, { enclosures: fx.enclosures }).map(i => i.id))
      .toContain('aa-form-block13');
  });

  it('checks block 9 only from the copy-to lines the caller passes (they live beside the form data)', () => {
    const four = ['A', 'B', 'C', 'D'];
    expect(validateNavmc10274Fit(formData, [], [], [], ones(3), four).map(i => i.id)).toEqual(['aa-form-box-9']);
    expect(validateNavmc10274Fit(formData, [], [], [], ones(3))).toEqual([]);
    expect(runLetterValidators(formData, [], [], ones(3), { copyTos: four }).map(i => i.id)).toContain('aa-form-box-9');
  });
});

describe('describeAaFit', () => {
  it('writes the export toast in the form\'s order', () => {
    const notes = describeAaFit(navmc10274FitReport(inputs({ to: Array.from({ length: 9 }, (_, i) => `L${i}`).join('\n') })));
    expect(notes).toEqual([
      'Block 7 (To) takes 9 lines and holds 7.',
      'Block 12 is full; 4 lines continue in block 13 on page 3.',
    ]);
  });

  it('says nothing when everything fits block 12', () => {
    expect(describeAaFit(navmc10274FitReport(inputs({}, ones(3))))).toEqual([]);
  });
});
