/**
 * Two layout changes Stephen asked for on 2026-08-26, and the priced ceiling.
 *
 * A-1-c and A-1-d are JAGMAN appendices reproduced verbatim, so anything
 * this file asserts about their text is a deliberate departure from the
 * printed form and has to say why. Neither change alters a word.
 */

import { describe, it, expect } from 'vitest';
import { APPENDIX_A_1_C, APPENDIX_A_1_D } from '@/lib/jagman-appendix-a1';
import { appendixWidth } from '@/lib/jagman-a1-wrap';
import { maximumPunishment } from '@/lib/njp-maximum-punishment';
import { forfeitureLadder } from '@/lib/navmc10132-forfeiture-ladder';
import { advisementForfeitureLadder } from '@/lib/njp-package';
import { createEmptyNavmc10132Data } from '@/types/navmc';
import type { FormData } from '@/types';

const DATE = '2026-08-05';

describe('the numbered rights are separated by one blank line each', () => {
  /**
   * "we need a hard space betwen (2) and (3)", Stephen, 2026-08-26, reading
   * A-1-d page 2. He is right, and A-1-c proves it: the same paragraph in
   * the sibling appendix carries the blank at that exact position. The
   * extraction dropped it from A-1-d alone.
   */
  it('A-1-d puts a blank line between every numbered right, (2) and (3) included', () => {
    const text = APPENDIX_A_1_D.text;
    for (const n of ['(1)', '(2)', '(3)', '(4)', '(5)', '(6)']) {
      const at = text.findIndex((line) => line.trimStart().startsWith(`${n} To be`) || line.trimStart().startsWith(`${n}  `));
      if (at <= 0) continue;
      expect(text[at - 1].trim(), `no blank line before ${n}`).toBe('');
    }
  });

  it('A-1-c already did, which is why this is parity and not invention', () => {
    const text = APPENDIX_A_1_C.text;
    const at = text.findIndex((line) => line.includes('(3) To be accompanied by a spokesperson'));
    expect(at).toBeGreaterThan(0);
    expect(text[at - 1].trim()).toBe('');
  });
});

describe('the signature and its date sit on one line', () => {
  /**
   * "This will remove the date placeholders and allow then to write it on
   * the same line as teh signature", Stephen, 2026-08-26. A DELIBERATE
   * departure, and the only layout change in the appendix file. The same two
   * signatures and the same two dates are still collected. A-1-g already
   * prints "(Signature of Accused and Date)" on one line, so the pattern
   * comes from the appendix set itself.
   */
  for (const appendix of [APPENDIX_A_1_C, APPENDIX_A_1_D]) {
    it(`${appendix.designator} labels both signature rules with their dates`, () => {
      const merged = appendix.text.filter((line) =>
        line.includes('(Signature of witness) (Date)') && line.includes('(Signature of Accused) (Date)'),
      );
      expect(merged).toHaveLength(2);
    });

    it(`${appendix.designator} carries no standalone date placeholder line`, () => {
      const orphaned = appendix.text.filter((line) => line.trim() === '(Date)' || /^\s+\(Date\)\s+\(Date\)\s*$/.test(line));
      expect(orphaned).toEqual([]);
    });

    it(`${appendix.designator} still holds every line inside its own measure`, () => {
      const width = appendixWidth(appendix);
      expect(appendix.text.filter((line) => line.length > width)).toEqual([]);
    });

    // One signature rule per label line, and both labels under their rules.
    it(`${appendix.designator} keeps a rule line above each merged label`, () => {
      appendix.text.forEach((line, i) => {
        if (!line.includes('(Signature of witness) (Date)')) return;
        expect(appendix.text[i - 1]).toContain('____');
      });
    });
  }
});

// ---------------------------------------------------------------------------
// The priced ceiling
// ---------------------------------------------------------------------------

const ladder = (payGrade: string, yos: string) =>
  forfeitureLadder({ payGrade, yearsOfService: yos, punishmentDate: DATE });

const priced = (authorityPayGrade: string, payGrade: string, yos: string) =>
  maximumPunishment({
    authorityPayGrade,
    accusedPayGrade: payGrade,
    accusedYearsOfService: yos,
    forfeiture: ladder(payGrade, yos),
  });

const textOf = (max: ReturnType<typeof maximumPunishment>) =>
  (max?.blocks ?? []).map((b) => b.text).join('\n');

describe('the maximum punishment carries the figure, not only the fraction', () => {
  /**
   * "We should list the max based on the rank and times of service",
   * Stephen, 2026-08-26. An accused deciding whether to refuse NJP and
   * demand a court-martial is told he faces "one-half of one month's pay per
   * month for two months". That is a fraction, not a number.
   */
  it('a field-grade ceiling names the monthly dollar figure at the accused grade', () => {
    const text = textOf(priced('O5', 'E6', '12'));
    expect(text).toContain('one-half of one month');
    expect(text).toContain('at E-6 with 12 years of service');
    expect(text).toMatch(/\$[\d,]+ per month/);
  });

  it('a company-grade ceiling names the seven-day figure instead', () => {
    const text = textOf(priced('O3', 'E3', '2'));
    expect(text).toContain("Forfeiture of not more than 7 days’ pay, which at E-3 with 2 years");
    expect(text).not.toContain('per month');
  });

  // The pay table writes E3; a rights advisement served on a Marine reads E-3.
  it('hyphenates the pay grade the way the appendix does', () => {
    expect(textOf(priced('O5', 'E4', '4'))).toContain('at E-4');
    expect(textOf(priced('O5', 'E4', '4'))).not.toMatch(/at E4\b/);
  });

  // A figure the app cannot stand behind is worse than the fraction.
  it('prints the words alone when the ladder declines', () => {
    const bare = maximumPunishment({ authorityPayGrade: 'O5', accusedPayGrade: 'E6' });
    const text = textOf(bare);
    expect(text).toContain('one-half of one month');
    expect(text).not.toMatch(/\$/);
  });

  // A source line citing a pay table nothing was computed from would suggest
  // the words above carry a number they do not.
  it('names the pay table only where a figure priced on it was printed', () => {
    expect(textOf(priced('O5', 'E6', '12'))).toContain('basic pay table effective');
    expect(
      textOf(maximumPunishment({ authorityPayGrade: 'O5', accusedPayGrade: 'E6' })),
    ).not.toContain('basic pay table effective');
  });

  it('calls the figures ceilings rather than amounts imposed', () => {
    expect(textOf(priced('O5', 'E6', '12'))).toContain('ceilings, not amounts imposed');
  });
});

describe('the reduced-grade restatement', () => {
  // MCM Part V para 5.c(8). The accused told only the present-grade figure
  // has been told the higher of two ceilings and none of the reason.
  it('states the reduced-grade ceiling where a reduction is on the list', () => {
    const text = textOf(priced('O5', 'E3', '2'));
    expect(text).toContain('MCM Part V para 5.c(8)');
    expect(text).toContain('At E-2');
  });

  /**
   * ONLY THE CEILING THE LIST ACTUALLY CARRIES. The first version restated
   * both the monthly and the seven-day figure regardless of level, so a
   * company-grade advisement offered a monthly forfeiture no company-grade
   * commander may impose, under a list that correctly omitted it.
   */
  it('restates the seven-day figure alone for a company-grade authority', () => {
    const text = textOf(priced('O3', 'E3', '2'));
    expect(text).toContain('At E-2 the ceiling above is $');
    expect(text).not.toContain('per month');
  });

  it('restates the monthly figure alone for a field-grade authority', () => {
    const text = textOf(priced('O5', 'E3', '2'));
    expect(text).toMatch(/At E-2 the ceiling above is \$[\d,]+ per month\./);
  });

  // Reduction is barred at E-6 for a Marine, so there is no second basis.
  it('says nothing about a reduced grade where reduction is barred', () => {
    const text = textOf(priced('O5', 'E6', '12'));
    expect(text).not.toContain('5.c(8)');
    expect(text).not.toContain('If a reduction is imposed as well');
  });
});

describe('advisementForfeitureLadder prices on the advisement date', () => {
  const doc = (o: Record<string, unknown>): FormData =>
    ({ documentType: 'navmc10132', ...createEmptyNavmc10132Data(),
       accusedPayGrade: 'E4', accusedYearsOfService: '4', ...o } as unknown as FormData);

  /**
   * A-1-c and A-1-d are served BEFORE the hearing, so item 6 carries no date
   * and pricing on it would decline on every advisement ever generated. The
   * date that matters is the day the accused is advised, because that is the
   * day he decides whether to refuse NJP on the strength of the figure.
   */
  it('uses the item 2 election date', () => {
    expect(advisementForfeitureLadder(doc({ electionDate: DATE })).rungs.length).toBeGreaterThan(0);
  });

  it('falls back to the item 3 attestation, then to item 6', () => {
    expect(advisementForfeitureLadder(doc({ rightsAttestDate: DATE })).rungs.length).toBeGreaterThan(0);
    expect(advisementForfeitureLadder(doc({ punishmentDate: DATE })).rungs.length).toBeGreaterThan(0);
  });

  it('declines with no date at all rather than pricing on an assumed table', () => {
    const l = advisementForfeitureLadder(doc({}));
    expect(l.rungs).toEqual([]);
    expect(l.unavailable?.reason).toBe('table-not-current');
  });

  // Nothing is imposed when an advisement is served, so the accused's own
  // grade is the operative basis and the reduced rung is the "if a reduction
  // is imposed as well" case.
  it('passes no reduction target, leaving the accused own grade operative', () => {
    const l = advisementForfeitureLadder(doc({ electionDate: DATE }));
    expect(l.rungs[0].operative).toBe(true);
    expect(l.rungs[0].reduced).toBe(false);
  });
});
