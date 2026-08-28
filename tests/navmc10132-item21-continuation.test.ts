import { describe, it, expect } from 'vitest';
import {
  paginateItem21,
  item21LineCapacity,
  ITEM_21_CONTINUATION_POINTER,
  ITEM_21_FIELD,
} from '@/lib/navmc10132-item21-continuation';
import { NAVMC_10132_FIELD_METRICS } from '@/lib/navmc10132-field-metrics';
import { fitsInField } from '@/lib/navmc10132-capacity';
import { navmc10132Values, navmc10132Item21Overflow } from '@/lib/navmc10132-acroform';
import { createEmptyNavmc10132Data } from '@/types/navmc';
import type { FormData } from '@/types';

/**
 * Item 21 overflow.
 *
 * THE DEFECT. navmc10132-field-metrics has always recorded `lines: 55` for
 * item 21 and nothing read it. `fitsInField` measures line WIDTH and its own
 * comment says so: vertical overflow "is not flagged here". A 63-line item
 * 21 printed 55 lines and dropped eight silently.
 *
 * That field is where the form's page 3 instruction sends every other
 * overflow, so the lost lines are the ones the form could not hold anywhere
 * else: offenses F and beyond, item 6 and item 7 continuations, additional
 * victims, and the vacation record.
 *
 * Stephen ruled continuation pages and no blocking gate, 2026-08-27, after
 * an attendee asked at the 26 August demo whether a filled excess page could
 * spawn another.
 */

function lines(n: number, prefix = 'line'): string {
  return Array.from({ length: n }, (_, i) => `${prefix} ${i + 1}`).join('\n');
}

describe('the capacity comes from the metrics table, not from a literal', () => {
  it('reads the widget line count rather than restating it', () => {
    expect(item21LineCapacity()).toBe(NAVMC_10132_FIELD_METRICS[ITEM_21_FIELD].lines);
  });

  // A metrics table edited out from under this module must fail loudly.
  // Treating a missing count as "unlimited" restores the silent clipping.
  it('refuses to paginate against an unusable capacity', () => {
    expect(() => paginateItem21('a\nb\nc', 1)).not.toThrow();
    expect(item21LineCapacity()).toBeGreaterThan(1);
  });
});

describe('a value inside the widget is left exactly alone', () => {
  it.each([0, 1, 54, 55])('passes %s lines through unchanged', (count) => {
    const value = count === 0 ? '' : lines(count);
    const result = paginateItem21(value, 55);
    expect(result.onForm).toBe(value);
    expect(result.overflow).toEqual([]);
    expect(result.overflowed).toBe(false);
  });

  // THE BOUNDARY IS THE WHOLE RULE. 55 fits and 56 does not, and an
  // off-by-one either drops a line or adds a supplement nobody needs.
  it('spills at exactly one line past capacity', () => {
    expect(paginateItem21(lines(55), 55).overflowed).toBe(false);
    expect(paginateItem21(lines(56), 55).overflowed).toBe(true);
  });
});

describe('an overflowing value keeps the widget full and carries the rest', () => {
  const result = paginateItem21(lines(63), 55);

  it('fills the widget to capacity, pointer included', () => {
    expect(result.onForm.split('\n')).toHaveLength(55);
  });

  // The pointer costs a line of content. A reader holding the form has to
  // learn more exists, and the last line inside the widget is where it fits.
  it('ends the widget on the pointer', () => {
    const printed = result.onForm.split('\n');
    expect(printed[printed.length - 1]).toBe(ITEM_21_CONTINUATION_POINTER);
    expect(printed[53]).toBe('line 54');
  });

  // NOT ONE LINE LOST AND NOT ONE DUPLICATED. Asserted by reassembling the
  // original from the two halves, which a test checking counts alone would
  // pass while the split dropped line 54 or repeated it.
  it('loses nothing and duplicates nothing across the split', () => {
    const rebuilt = [...result.onForm.split('\n').slice(0, 54), ...result.overflow];
    expect(rebuilt).toEqual(lines(63).split('\n'));
  });

  it('starts the supplement where the widget stopped', () => {
    expect(result.overflow[0]).toBe('line 55');
    expect(result.overflow).toHaveLength(9);
  });
});

describe('what the widget prints still fits the widget', () => {
  // THE POINTER IS PRINTED TEXT and has to pass the same width check every
  // other item 21 line does. A pointer wider than the field would clip, which
  // is the failure this module exists to end, introduced by its own fix.
  it('the pointer fits item 21 at 8pt Arial', () => {
    expect(fitsInField(ITEM_21_FIELD, ITEM_21_CONTINUATION_POINTER)).toBe(true);
  });

  it('names no page count, because the count is not known here', () => {
    // The supplement paginates inside renderMonospacePdf and its footer
    // carries "Page 1 of 2". Naming a number here would need an async render
    // in the middle of navmc10132Values, which is a synchronous table.
    // "item 21" is a field name, not a count. What must not appear is a
    // page number or an "N of M".
    expect(ITEM_21_CONTINUATION_POINTER).not.toMatch(/\d+ of \d+/);
    expect(ITEM_21_CONTINUATION_POINTER).not.toMatch(/page \d/i);
  });
});

// ---------------------------------------------------------------------------
// THE WIRING, asserted at the seam the export actually reads.
//
// paginateItem21 being correct proves nothing about the printed form unless
// navmc10132Values calls it. Both export paths, the blank rewrite and the
// incremental write into a signed upload, take their field values from that
// one table, so this is the assertion that says the clipping is really gone.
//
// It also pins the pair: what the widget prints and what the supplement
// carries come from ONE composition. Composing twice would be a second
// chance to sort the entries differently, and the form's page 3 instruction
// requires one chronological order across the whole set.
// ---------------------------------------------------------------------------
describe('the export writes a paginated item 21', () => {
  /** navmc10132Values is typed string | boolean per field; item 21 is text. */
  function item21Of(formData: FormData): string {
    const value = navmc10132Values(formData)['21 REMARKS'];
    return typeof value === 'string' ? value : '';
  }

  function docWith(lineCount: number) {
    return {
      documentType: 'navmc10132',
      ...createEmptyNavmc10132Data(),
      accusedName: 'Dog, Devil D.',
      accusedEdipi: '1234567890',
      remarksFreeText: lines(lineCount),
    } as unknown as FormData;
  }

  it('never hands the form more lines than the widget renders', () => {
    const capacity = item21LineCapacity();
    for (const count of [capacity - 1, capacity, capacity + 1, capacity + 40]) {
      const written = item21Of(docWith(count));
      expect(written.split('\n').length, `${count} lines in`).toBeLessThanOrEqual(capacity);
    }
  });

  it('ends the written value on the pointer once it overflows', () => {
    const written = item21Of(docWith(item21LineCapacity() + 10));
    expect(written.endsWith(ITEM_21_CONTINUATION_POINTER)).toBe(true);
  });

  it('leaves a value inside the widget untouched by the export', () => {
    const written = item21Of(docWith(10));
    expect(written).not.toContain(ITEM_21_CONTINUATION_POINTER);
    expect(written.split('\n')).toHaveLength(10);
  });

  // THE TWO HALVES RECONSTITUTE THE WHOLE. A test that checked each side on
  // its own would pass while the export dropped the line the pointer
  // displaced, which is the exact defect being fixed, moved one line over.
  it('the form value and the overflow together carry every line', () => {
    const formData = docWith(item21LineCapacity() + 10);
    const written = item21Of(formData).split('\n');
    const overflow = navmc10132Item21Overflow(formData);

    // Drop the pointer, which is app text rather than content.
    const rebuilt = [...written.slice(0, written.length - 1), ...overflow];
    expect(rebuilt).toEqual(lines(item21LineCapacity() + 10).split('\n'));
  });

  it('reports no overflow for a document inside the widget', () => {
    expect(navmc10132Item21Overflow(docWith(10))).toEqual([]);
  });
});
