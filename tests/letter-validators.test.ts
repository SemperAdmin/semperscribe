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
  validateDirectiveTypography,
  validateDirectiveSchema, validateBulletinCancellation,
  validateRevisionSuffix } from '@/lib/letter-validators';
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

describe('P3.2 directive typewriter spacing (warn only)', () => {
  const base = { documentType: 'mco' } as never;
  const paras = (content: string) => [{ id: 1, level: 1, content }] as never[];

  it('warns on single space after a sentence period in a directive', () => {
    const issues = validateDirectiveTypography(base, paras('First sentence. Second sentence.'));
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('warn');
  });

  it('does not flag two-space sentences', () => {
    expect(validateDirectiveTypography(base, paras('First sentence.  Second sentence.'))).toHaveLength(0);
  });

  it('does not flag abbreviations like U.S. or e.g.', () => {
    expect(validateDirectiveTypography(base, paras('Per U.S. Code and e.g. Title 10.'))).toHaveLength(0);
  });

  it('never fires for correspondence', () => {
    expect(validateDirectiveTypography({ documentType: 'basic' } as never, paras('One. Two.'))).toHaveLength(0);
  });
});

describe('P3.5 directive paragraph schemas (MCO 5215.1K)', () => {
  const titled = (titles: string[]) =>
    titles.map((t, i) => ({ id: i + 1, level: 1, content: 'x', title: t })) as never[];
  const SMEAC = ['Situation', 'Mission', 'Execution', 'Administration and Logistics', 'Command and Signal'];

  it('passes a complete SMEAC order', () => {
    expect(validateDirectiveSchema({ documentType: 'mco' } as never, titled(SMEAC))).toHaveLength(0);
  });

  it('passes SMEAC with Cancellation second', () => {
    expect(validateDirectiveSchema({ documentType: 'mco' } as never,
      titled(['Situation', 'Cancellation', 'Mission', 'Execution', 'Administration and Logistics', 'Command and Signal']))).toHaveLength(0);
  });

  it('warns on a missing Mission paragraph (Fig 1-1 reduced formats exempt)', () => {
    const issues = validateDirectiveSchema({ documentType: 'mco' } as never,
      titled(['Situation', 'Execution', 'Administration and Logistics', 'Command and Signal']));
    const miss = issues.find((i) => i.id === 'directive-missing-mission');
    expect(miss).toBeDefined();
    expect(miss!.severity).toBe('warn');
  });

  it('assumption-of-command short form (Fig 1-1) draws warns only, no fails', () => {
    const issues = validateDirectiveSchema({ documentType: 'mco' } as never,
      titled(['Situation', 'Cancellation', 'Execution']));
    expect(issues.every((i) => i.severity === 'warn')).toBe(true);
  });

  it('fails out-of-order mandatory paragraphs', () => {
    const issues = validateDirectiveSchema({ documentType: 'mco' } as never,
      titled(['Mission', 'Situation', 'Execution', 'Administration and Logistics', 'Command and Signal']));
    expect(issues.map((i) => i.id)).toContain('directive-paragraph-order');
  });

  it('fails Cancellation in any slot but second', () => {
    const issues = validateDirectiveSchema({ documentType: 'mco' } as never,
      titled(['Situation', 'Mission', 'Cancellation', 'Execution', 'Administration and Logistics', 'Command and Signal']));
    expect(issues.map((i) => i.id)).toContain('directive-cancellation-position');
  });

  it('fails a bulletin whose first paragraph is not Purpose', () => {
    const issues = validateDirectiveSchema({ documentType: 'bulletin' } as never,
      titled(['Background', 'Purpose']));
    expect(issues.map((i) => i.id)).toContain('bulletin-purpose-first');
  });

  it('fails Cancellation Contingency anywhere but last', () => {
    const issues = validateDirectiveSchema({ documentType: 'bulletin' } as never,
      titled(['Purpose', 'Cancellation Contingency', 'Action']));
    expect(issues.map((i) => i.id)).toContain('bulletin-canc-contingency-last');
  });

  it('ignores correspondence', () => {
    expect(validateDirectiveSchema({ documentType: 'basic' } as never, titled(['Anything']))).toHaveLength(0);
  });
});

describe('P3.5 bulletin cancellation date rules', () => {
  const bul = (canc: string, date = '2026-06-10') =>
    ({ documentType: 'bulletin', cancellationDate: canc, date } as never);

  it('passes a month-end date within 12 months', () => {
    expect(validateBulletinCancellation(bul('2026-12-31'))).toHaveLength(0);
  });

  it('fails a missing cancellation date', () => {
    expect(validateBulletinCancellation({ documentType: 'bulletin' } as never)
      .map((i) => i.id)).toContain('bulletin-canc-missing');
  });

  it('fails a mid-month date', () => {
    expect(validateBulletinCancellation(bul('2026-12-15')).map((i) => i.id))
      .toContain('bulletin-canc-month-end');
  });

  it('fails a date past the 12-month ceiling', () => {
    expect(validateBulletinCancellation(bul('2027-08-31')).map((i) => i.id))
      .toContain('bulletin-canc-ceiling');
  });

  it('accepts exactly 12 months out (boundary)', () => {
    expect(validateBulletinCancellation(bul('2027-05-31', '2026-06-10'))
      .map((i) => i.id)).not.toContain('bulletin-canc-ceiling');
  });

  it('never fires for non-bulletins', () => {
    expect(validateBulletinCancellation({ documentType: 'mco' } as never)).toHaveLength(0);
  });
});

describe('P4.4 revision suffix rules (MCO 5215.1K, audit line 151)', () => {
  const mco = (ssic: string) => ({ documentType: 'mco', ssic } as never);

  it.each(['I', 'O', 'Q'])('fails suffix %s on a USMC directive', (sfx) => {
    const issues = validateRevisionSuffix(mco(`5215.1${sfx}`));
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('fail');
  });

  it('passes permitted suffixes and unrevised points', () => {
    expect(validateRevisionSuffix(mco('5215.1K'))).toHaveLength(0);
    expect(validateRevisionSuffix(mco('5210.11'))).toHaveLength(0);
    expect(validateRevisionSuffix(mco('5215.1Z'))).toHaveLength(0);
  });

  it('fails a two-letter suffix (past Z needs a new point number)', () => {
    const issues = validateRevisionSuffix(mco('5215.1AA'));
    expect(issues.map((i) => i.id)).toContain('revision-suffix-past-z');
  });

  it('ignores the w/ ch annotation and lowercase input', () => {
    expect(validateRevisionSuffix(mco('5215.1K w/ ch 2'))).toHaveLength(0);
    expect(validateRevisionSuffix(mco('5215.1q')).map((i) => i.id)).toContain('revision-suffix-q');
  });

  it('never fires for correspondence', () => {
    expect(validateRevisionSuffix({ documentType: 'basic', ssic: '5215.1Q' } as never)).toHaveLength(0);
  });
});
