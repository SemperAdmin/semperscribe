/**
 * R5 (USER_DRIVEN_ROADMAP) - autofix engine.
 * The reference re-letterer is the risky one: it rewrites in-text
 * citations, so scope and idempotency get the most coverage.
 */
import { describe, it, expect } from 'vitest';
import {
  fixReferenceOrder,
  fixCivilianDates,
  fixAbbreviatedDates,
  fixNotalFormat,
  fixSignatureInitials,
  getFixer,
  hasFixer,
  fixAll,
  DocumentSlices,
} from '@/lib/autofix';
import { validateReferences } from '@/lib/letter-validators';
import type { ParagraphData, FormData } from '@/types';

function slices(paras: string[], references: string[] = [], sig = ''): DocumentSlices {
  return {
    formData: { documentType: 'basic', sig } as FormData,
    paragraphs: paras.map((content, i) => ({ id: i + 1, level: 1, content })) as ParagraphData[],
    vias: [], references, enclosures: [], copyTos: [], distList: [],
  };
}

describe('fixReferenceOrder', () => {
  it('reorders the list into first-citation order', () => {
    // Listed a='REF BEE', b='REF AY', c='REF CEE'. The text cites (b)
    // first, so 'REF AY' must become reference (a) - i.e. move to the
    // front. (The original expectation here was simply wrong: it
    // asserted the input order unchanged. Caught by the first local run.)
    const result = fixReferenceOrder(slices(['Per ref (b) and ref (a), see ref (c).'], ['REF BEE', 'REF AY', 'REF CEE']));
    expect(result.references).toEqual(['REF AY', 'REF BEE', 'REF CEE']);
  });

  it('remaps in-text citations so letters still point at the same reference', () => {
    const result = fixReferenceOrder(slices(['Per ref (b) and ref (a), see ref (c).'], ['REF BEE', 'REF AY', 'REF CEE']));
    // (b)->(a) and (a)->(b): the first-cited reference becomes (a).
    expect(result.paragraphs[0].content).toBe('Per ref (a) and ref (b), see ref (c).');
  });

  it('satisfies the validator it fixes', () => {
    const result = fixReferenceOrder(slices(['Per ref (b) and ref (a).'], ['REF BEE', 'REF AY']));
    const issues = validateReferences(result.references, result.paragraphs);
    expect(issues.some((i) => i.id === 'ref-citation-order')).toBe(false);
  });

  it('never rewrites parentheses outside a reference clause', () => {
    const result = fixReferenceOrder(slices(['Per ref (b), item (a) applies and ref (a) governs.'], ['BEE', 'AY']));
    expect(result.paragraphs[0].content).toContain('item (a) applies');
  });

  it('is idempotent', () => {
    const once = fixReferenceOrder(slices(['Per ref (b) then ref (a).'], ['BEE', 'AY']));
    const twice = fixReferenceOrder(once);
    expect(twice.references).toEqual(once.references);
    expect(twice.paragraphs[0].content).toBe(once.paragraphs[0].content);
  });

  it('no-ops when the order is already correct', () => {
    const input = slices(['Per ref (a) then ref (b).'], ['AY', 'BEE']);
    expect(fixReferenceOrder(input)).toBe(input);
  });

  it('no-ops with fewer than two references', () => {
    const input = slices(['ref (a)'], ['ONLY']);
    expect(fixReferenceOrder(input)).toBe(input);
  });

  it('keeps uncited references after the cited ones', () => {
    const result = fixReferenceOrder(slices(['Only ref (c) is cited.'], ['AY', 'BEE', 'CEE']));
    expect(result.references[0]).toBe('CEE');
  });
});

describe('date fixers', () => {
  it('converts civilian dates to standard', () => {
    expect(fixCivilianDates(slices(['Signed May 23, 2014 at HQ.'])).paragraphs[0].content)
      .toBe('Signed 23 May 2014 at HQ.');
  });

  it('expands abbreviated dates', () => {
    expect(fixAbbreviatedDates(slices(['Due 5 May 15 for review.'])).paragraphs[0].content)
      .toBe('Due 5 May 2015 for review.');
    expect(fixAbbreviatedDates(slices(['Due 1 Jan 26.'])).paragraphs[0].content)
      .toBe('Due 1 January 2026.');
  });

  it('leaves standard dates alone', () => {
    const input = slices(['On 5 May 2015 we met.']);
    expect(fixCivilianDates(input).paragraphs[0].content).toBe('On 5 May 2015 we met.');
    expect(fixAbbreviatedDates(input).paragraphs[0].content).toBe('On 5 May 2015 we met.');
  });

  it('is idempotent', () => {
    const once = fixCivilianDates(slices(['Signed May 23, 2014.']));
    expect(fixCivilianDates(once).paragraphs[0].content).toBe(once.paragraphs[0].content);
  });
});

describe('fixNotalFormat', () => {
  it('parenthesizes a bare NOTAL and leaves a correct one', () => {
    const result = fixNotalFormat(slices([''], ['MCO 1234 NOTAL', 'MCO 5678 (NOTAL)']));
    expect(result.references).toEqual(['MCO 1234 (NOTAL)', 'MCO 5678 (NOTAL)']);
  });

  it('no-ops when nothing to fix', () => {
    const input = slices([''], ['MCO 5678 (NOTAL)']);
    expect(fixNotalFormat(input)).toBe(input);
  });
});

describe('fixSignatureInitials', () => {
  it('reduces a spelled-out first name to an initial', () => {
    expect(fixSignatureInitials(slices([''], [], 'JOHN A. SMITH')).formData.sig).toBe('J. A. SMITH');
  });

  it('leaves proper initials, surname-only, and surname-first alone', () => {
    expect(fixSignatureInitials(slices([''], [], 'J. A. SMITH')).formData.sig).toBe('J. A. SMITH');
    expect(fixSignatureInitials(slices([''], [], 'SMITH')).formData.sig).toBe('SMITH');
    expect(fixSignatureInitials(slices([''], [], 'SMITH, J. A.')).formData.sig).toBe('SMITH, J. A.');
  });
});

describe('registry', () => {
  it('resolves fixers for known issue ids, including prefix matches', () => {
    expect(hasFixer('ref-citation-order')).toBe(true);
    expect(hasFixer('date-civilian-in-text')).toBe(true);
    expect(hasFixer('signature-initials')).toBe(true);
    expect(hasFixer('ref-notal-format-a')).toBe(true);
  });

  it('returns nothing for issues without a fixer', () => {
    expect(hasFixer('window-address-lines')).toBe(false);
    expect(getFixer('acronym-undefined-MCTFS')).toBeUndefined();
  });

  it('exposes a label for the button', () => {
    expect(getFixer('ref-citation-order')?.label).toBe('Reorder references');
  });

  it('fixAll applies each matching fixer once', () => {
    const result = fixAll(slices(['Signed May 23, 2014 and due 5 May 15.']), [
      'date-civilian-in-text', 'date-abbreviated-in-text', 'date-civilian-in-text',
    ]);
    expect(result.paragraphs[0].content).toBe('Signed 23 May 2014 and due 5 May 2015.');
  });
});
