/**
 * Phase 2 validator tests. Each rule carries its citation.
 */
import { describe, it, expect } from 'vitest';
import {
  validateDateSlots,
  validateReferences,
  validateParagraphStructure,
  validateWindowEnvelope,
  validateActionAddressees,
  getExportBlockers,
  indexToRefLetter,
} from '@/lib/letter-validators';
import type { ParagraphData, FormData } from '@/types';

const p = (id: number, level: number, content: string): ParagraphData => ({ id, level, content });
const fd = (extra: Record<string, unknown> = {}): FormData => ({ documentType: 'basic', ...extra });

describe('reference letters past (z)', () => {
  // audit line 147: >26 references -> (aa)+
  it('27th reference letters as (aa), 28th as (ab)', () => {
    expect(indexToRefLetter(26)).toBe('z');
    expect(indexToRefLetter(27)).toBe('aa');
    expect(indexToRefLetter(28)).toBe('ab');
  });
});

describe('validateReferences (M-5216.5; audit line 24)', () => {
  it('passes when every ref is cited in listing order', () => {
    const issues = validateReferences(
      ['(a) MCO 1', '(b) MCO 2'],
      [p(1, 1, 'Per ref (a) and ref (b), execute.')],
    );
    expect(issues.filter((i) => i.severity !== 'warn')).toEqual([]);
  });

  it('fails each listed ref never cited', () => {
    const issues = validateReferences(['(a) MCO 1', '(b) MCO 2'], [p(1, 1, 'Per ref (a) only.')]);
    expect(issues.map((i) => i.id)).toContain('ref-not-cited-b');
  });

  it('fails citations beyond the list', () => {
    const issues = validateReferences(['(a) MCO 1'], [p(1, 1, 'See ref (c).')]);
    expect(issues.map((i) => i.id)).toContain('ref-cited-not-listed-c');
  });

  it('fails out-of-order first citations', () => {
    const issues = validateReferences(
      ['(a) MCO 1', '(b) MCO 2'],
      [p(1, 1, 'Per ref (b), then ref (a).')],
    );
    expect(issues.map((i) => i.id)).toContain('ref-citation-order');
  });

  it('handles multi-citation clauses: "refs (a) and (b)"', () => {
    const issues = validateReferences(
      ['(a) MCO 1', '(b) MCO 2'],
      [p(1, 1, 'Per refs (a) and (b), execute.')],
    );
    expect(issues.filter((i) => i.severity === 'fail')).toEqual([]);
  });

  it('warns (plan-only provenance) on unparenthesized NOTAL', () => {
    const issues = validateReferences(['(a) MCO 1 NOTAL'], [p(1, 1, 'ref (a)')]);
    const w = issues.find((i) => i.id.startsWith('ref-notal-format'));
    expect(w?.severity).toBe('warn');
    expect(w?.citation).toContain('plan-only');
  });
});

describe('validateParagraphStructure (M-5216.5; audit line 148)', () => {
  it('fails a lone subdivision: 1a without 1b', () => {
    const issues = validateParagraphStructure([
      p(1, 1, 'parent'), p(2, 2, 'lone child'), p(3, 1, 'next major'),
    ]);
    expect(issues.map((i) => i.id)).toContain('lone-subdivision-2');
  });

  it('passes paired subdivisions', () => {
    const issues = validateParagraphStructure([
      p(1, 1, 'parent'), p(2, 2, 'a'), p(3, 2, 'b'),
    ]);
    expect(issues).toEqual([]);
  });

  it('treats deeper structure between siblings correctly', () => {
    // 1, 1a, 1a(1), 1a(2), 1b — "a" group has two members, paren group has two.
    const issues = validateParagraphStructure([
      p(1, 1, 'one'), p(2, 2, 'a'), p(3, 3, '(1)'), p(4, 3, '(2)'), p(5, 2, 'b'),
    ]);
    expect(issues).toEqual([]);
  });

  it('fails levels past 8', () => {
    const issues = validateParagraphStructure([p(1, 1, 'x'), p(2, 9 as never, 'too deep')]);
    expect(issues.map((i) => i.id)).toContain('level-cap-2');
  });
});

describe('validateWindowEnvelope — HARD BLOCK (audit lines 29, 69)', () => {
  it('inactive without the window flag', () => {
    expect(validateWindowEnvelope(fd({ to: 'a\nb\nc\nd\ne\nf' }), ['via'])).toEqual([]);
  });

  it('blocks an address over 5 lines', () => {
    const issues = validateWindowEnvelope(
      fd({ isWindowEnvelope: true, to: 'l1\nl2\nl3\nl4\nl5\nl6' }), [],
    );
    expect(issues[0]?.id).toBe('window-address-lines');
    expect(issues[0]?.severity).toBe('block');
  });

  it('blocks any Via addressee', () => {
    const issues = validateWindowEnvelope(fd({ isWindowEnvelope: true, to: 'one line' }), ['Via X']);
    expect(issues.map((i) => i.id)).toContain('window-via');
  });

  it('does NOT block stale vias on a business letter (no Via line rendered)', () => {
    // user-reported false positive 2026-06-10: via entries persisting
    // from a previously selected letter type are not in the document.
    const issues = validateWindowEnvelope(
      fd({ documentType: 'business-letter', isWindowEnvelope: true, to: 'one line' }),
      ['Stale Via Entry'],
    );
    expect(issues).toEqual([]);
  });

  it('blocks a classified SSIC prefix', () => {
    const issues = validateWindowEnvelope(
      fd({ isWindowEnvelope: true, to: 'one line', ssic: 'C5216' }), [],
    );
    expect(issues.map((i) => i.id)).toContain('window-classified');
  });

  it('export gate surfaces blocks and only blocks', () => {
    const blockers = getExportBlockers(
      fd({ isWindowEnvelope: true, to: 'one' }),
      ['Via X'],
      ['(a) never cited'],
      [p(1, 1, 'no citations here'), p(2, 2, 'lone')],
    );
    expect(blockers.length).toBe(1);
    expect(blockers[0].id).toBe('window-via');
  });
});

describe('validateActionAddressees (M-5216.5 Ch 8; audit line 26)', () => {
  it('fails 5+ action addressees without Distribution', () => {
    const issues = validateActionAddressees(
      fd({ distribution: { recipients: ['1', '2', '3', '4', '5'] } }),
    );
    expect(issues[0]?.id).toBe('addressees-over-four');
  });

  it('passes 5+ addressees when Distribution mode is on', () => {
    const issues = validateActionAddressees(
      fd({ distribution: { recipients: ['1', '2', '3', '4', '5'], toDistribution: true } }),
    );
    expect(issues).toEqual([]);
  });

  it('passes 4 or fewer', () => {
    expect(validateActionAddressees(fd({ distribution: { recipients: ['1', '2', '3', '4'] } }))).toEqual([]);
  });
});

describe('validateDateSlots (M-5216.5 2-2; plan item 6)', () => {
  it('fails civilian-format dates in naval letter text', () => {
    const issues = validateDateSlots(fd(), [p(1, 1, 'Effective May 23, 2014, this applies.')]);
    expect(issues.map((i) => i.id)).toContain('date-civilian-in-text');
  });

  it('fails abbreviated dates in naval letter text', () => {
    const issues = validateDateSlots(fd(), [p(1, 1, 'Signed on 15 Feb 09 at the command.')]);
    expect(issues.map((i) => i.id)).toContain('date-abbreviated-in-text');
  });

  it('passes the standard text date (5 May 2015)', () => {
    const issues = validateDateSlots(fd(), [p(1, 1, 'Effective 5 May 2015, this applies.')]);
    expect(issues).toEqual([]);
  });

  it('allows civilian dates in business letters', () => {
    const issues = validateDateSlots(
      fd({ documentType: 'business-letter' }),
      [p(1, 1, 'Effective May 23, 2014.')],
    );
    expect(issues).toEqual([]);
  });
});
