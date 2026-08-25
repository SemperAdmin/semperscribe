/**
 * Items 6 and 7 overflow into item 21.
 *
 * Both are SINGLE LINE fields and clip rather than wrapping. The escape
 * hatch prints "See Supplemental Page" in the field and carries the full
 * text into item 21. Before this existed, ticking the box on item 6 emptied
 * the field and wrote nothing to item 21, so the punishment appeared
 * NOWHERE on the form, and ticking it on item 7 cleared the export blocker
 * while the long text still printed and clipped.
 */

import { describe, it, expect } from 'vitest';
import { navmc10132Values } from '@/lib/navmc10132-acroform';
import type { FormData } from '@/types';

const LITERAL = 'See Supplemental Page';

/** Three punishments and three suspensions, the shape that overflows. */
const heavy = {
  documentType: 'navmc10132',
  punishmentDate: '2026-08-16',
  punishments: [
    { code: 'N09', days: '10' },
    { code: 'N08', gradeReducedTo: 'PFC' },
    { code: 'N13', days: '45' },
  ],
  punishmentsConcurrent: true,
  suspensions: [
    { punishmentIndex: 0, days: '5' },
    { punishmentIndex: 1, months: '3' },
    { punishmentIndex: 2, days: '45' },
  ],
} as unknown as FormData;

describe('item 7 overflow', () => {
  it('prints the full text in the field when it is not flagged', () => {
    const v = navmc10132Values(heavy);
    expect(v['7 SUSPENSION IF ANY']).toContain('unless sooner vacated');
    expect(v['7 SUSPENSION IF ANY']).not.toBe(LITERAL);
  });

  // The defect. Ticking the box used to clear the blocker and leave the
  // long text in place, so the export went out clipped.
  it('substitutes the literal once flagged', () => {
    const v = navmc10132Values({ ...heavy, suspensionOverflowToItem21: true } as FormData);
    expect(v['7 SUSPENSION IF ANY']).toBe(LITERAL);
  });

  it('carries the full text into item 21 under a dated ITEM 7 line', () => {
    const v = navmc10132Values({ ...heavy, suspensionOverflowToItem21: true } as FormData);
    const remarks = String(v['21 REMARKS'] ?? '');
    expect(remarks).toContain('Item 7. 16 Aug 26.');
    expect(remarks).toContain('unless sooner vacated');
  });

  // The item 21 line opens with the date already. Printing the renderer's
  // own date prefix as well would date the entry twice.
  it('does not date the entry twice', () => {
    const v = navmc10132Values({ ...heavy, suspensionOverflowToItem21: true } as FormData);
    const line = String(v['21 REMARKS'] ?? '')
      .split('\n')
      .find((l) => l.startsWith('Item 7.')) ?? '';
    // "Item 7. 16 Aug 26. 16 Aug 26, Extra du ..." would be the failure.
    expect(line).not.toMatch(/^Item 7\. \d{1,2} \w{3} \d{2}\. \d{1,2} \w{3} \d{2},/);
  });
});

describe('item 6 overflow', () => {
  // Item 6 substituted the literal already and wrote NOTHING to item 21, so
  // the punishment existed nowhere on the printed form.
  it('carries the full punishment text into item 21', () => {
    const v = navmc10132Values({ ...heavy, punishmentOverflowToItem21: true } as FormData);
    expect(v['6 PUNISHMENT IMPOSED']).toBe(LITERAL);
    const remarks = String(v['21 REMARKS'] ?? '');
    expect(remarks).toContain('Item 6. 16 Aug 26.');
    expect(remarks).toContain('Extra du for 10 days');
  });

  it('leaves item 21 alone when nothing overflows', () => {
    const v = navmc10132Values(heavy);
    const remarks = String(v['21 REMARKS'] ?? '');
    expect(remarks).not.toContain('Item 6.');
    expect(remarks).not.toContain('Item 7.');
  });

  it('carries both when both overflow', () => {
    const v = navmc10132Values({
      ...heavy,
      punishmentOverflowToItem21: true,
      suspensionOverflowToItem21: true,
    } as FormData);
    const remarks = String(v['21 REMARKS'] ?? '');
    expect(remarks).toContain('Item 6.');
    expect(remarks).toContain('Item 7.');
    expect(v['6 PUNISHMENT IMPOSED']).toBe(LITERAL);
    expect(v['7 SUSPENSION IF ANY']).toBe(LITERAL);
  });
});

describe('the app never warns on its own item 21 output', () => {
  it('accepts both overflow lines as prescribed format', async () => {
    const { isPrescribedFormat } = await import('@/lib/navmc10132-remarks');
    const v = navmc10132Values({
      ...heavy,
      punishmentOverflowToItem21: true,
      suspensionOverflowToItem21: true,
    } as FormData);
    for (const line of String(v['21 REMARKS'] ?? '').split('\n')) {
      if (line.trim() === '') continue;
      expect(isPrescribedFormat(line)).toBe(true);
    }
  });
});
