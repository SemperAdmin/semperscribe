/**
 * The rank and pay grade vocabularies, items 8A, 19, and 24.
 *
 * The Marine list is CLOSED by the form's page 3 RANK/GRADE note, so the
 * highest-value assertion here is that the app offers nothing outside it.
 */

import { splitRankGrade } from '@/lib/navmc10132-ranks';
import { describe, it, expect } from 'vitest';
import {
  NAVMC_10132_ENLISTED_PAY_GRADES,
  NAVMC_10132_USMC_ENLISTED_RANKS,
  NAVMC_10132_USN_APPRENTICESHIPS,
  NAVMC_10132_USN_RATING_SUFFIX,
  NAVMC_10132_REDUCTION_BAR_FLOOR,
  composeNavyAbbreviation,
  formatRankGrade,
  payGradeOf,
  rankGradeDiverges,
  reducibleGrades,
  reductionBarred,
  reducedPayGrade,
  ranksAtGrade,
} from '@/lib/navmc10132-ranks';

// Transcribed from the form's page 3 note, enlisted portion only.
const FORM_ALLOWED_USMC_ENLISTED = [
  'Pvt', 'PFC', 'LCpl', 'Cpl', 'Sgt', 'SSgt', 'GySgt', 'MSgt', '1stSgt', 'MGySgt', 'SgtMaj',
];

describe('the Marine enlisted list matches the form exactly', () => {
  it('offers every rank the note allows and nothing else', () => {
    expect(NAVMC_10132_USMC_ENLISTED_RANKS.map((r) => r.abbreviation)).toEqual(
      FORM_ALLOWED_USMC_ENLISTED,
    );
  });

  // "Do not include periods in Marine ranks."
  it('carries no periods in any abbreviation', () => {
    for (const rank of NAVMC_10132_USMC_ENLISTED_RANKS) {
      expect(rank.abbreviation).not.toContain('.');
    }
  });

  // "nor dashes in pay grades"
  it('carries no dashes in any pay grade', () => {
    for (const grade of NAVMC_10132_ENLISTED_PAY_GRADES) {
      expect(grade).not.toContain('-');
    }
    for (const rank of NAVMC_10132_USMC_ENLISTED_RANKS) {
      expect(rank.payGrade).not.toContain('-');
    }
  });

  it('gives E8 and E9 two ranks each', () => {
    expect(ranksAtGrade('E8').map((r) => r.abbreviation)).toEqual(['MSgt', '1stSgt']);
    expect(ranksAtGrade('E9').map((r) => r.abbreviation)).toEqual(['MGySgt', 'SgtMaj']);
  });
});

describe('Navy abbreviations follow the rating rule', () => {
  // "For Navy petty officers, use the rating abbreviation."
  it('composes a rating plus its grade suffix', () => {
    expect(composeNavyAbbreviation('HM', 'E4')).toBe('HM3');
    expect(composeNavyAbbreviation('HM', 'E5')).toBe('HM2');
    expect(composeNavyAbbreviation('HM', 'E6')).toBe('HM1');
    expect(composeNavyAbbreviation('HM', 'E7')).toBe('HMC');
    expect(composeNavyAbbreviation('HM', 'E8')).toBe('HMCS');
    expect(composeNavyAbbreviation('HM', 'E9')).toBe('HMCM');
  });

  // The whole reason a plain E1 to E9 dropdown is wrong.
  it('never emits PO1, PO2, or PO3', () => {
    for (const grade of NAVMC_10132_ENLISTED_PAY_GRADES) {
      const out = composeNavyAbbreviation('HM', grade);
      if (out !== null) expect(out).not.toMatch(/^PO\d$/);
    }
  });

  it('returns null below E4, where the rating is not used', () => {
    expect(composeNavyAbbreviation('HM', 'E1')).toBeNull();
    expect(composeNavyAbbreviation('HM', 'E2')).toBeNull();
    expect(composeNavyAbbreviation('HM', 'E3')).toBeNull();
  });

  it('returns null rather than guessing on an empty rating', () => {
    expect(composeNavyAbbreviation('', 'E5')).toBeNull();
    expect(composeNavyAbbreviation('   ', 'E5')).toBeNull();
  });

  // An E3 corpsman is HN, an E3 in the deck force is SN. Not interchangeable.
  it('keeps the apprenticeship abbreviations distinct by community', () => {
    const byCommunity = Object.fromEntries(
      NAVMC_10132_USN_APPRENTICESHIPS.map((a) => [a.community, a.grades]),
    );
    expect(byCommunity['Hospitalman'][2]).toBe('HN');
    expect(byCommunity['Seaman'][2]).toBe('SN');
    expect(byCommunity['Fireman'][2]).toBe('FN');
  });

  it('has a suffix for every petty officer grade and none below', () => {
    expect(Object.keys(NAVMC_10132_USN_RATING_SUFFIX).sort()).toEqual([
      'E4', 'E5', 'E6', 'E7', 'E8', 'E9',
    ]);
  });
});

describe('formatRankGrade prints item 19 the way the form does', () => {
  it('joins rank and pay grade with a comma', () => {
    expect(formatRankGrade('Sgt', 'E5')).toBe('Sgt, E5');
  });

  it('degrades cleanly when half the pair is missing', () => {
    expect(formatRankGrade('Sgt', '')).toBe('Sgt');
    expect(formatRankGrade('', 'E5')).toBe('E5');
    expect(formatRankGrade('', '')).toBe('');
  });
});

describe('rank and pay grade are allowed to diverge', () => {
  // The note names frocking explicitly. A frocked Marine wears Sgt on E4 pay.
  it('reports a frocked Marine as diverging without calling it an error', () => {
    expect(rankGradeDiverges('Sgt', 'E4')).toBe(true);
    expect(rankGradeDiverges('Sgt', 'E5')).toBe(false);
  });

  it('stays silent when the pay grade is not yet entered', () => {
    expect(rankGradeDiverges('Sgt', '')).toBe(false);
  });

  it('stays silent on a rank it does not recognise', () => {
    expect(rankGradeDiverges('HM2', 'E5')).toBe(false);
  });

  it('gives the usual pay grade for a rank', () => {
    expect(payGradeOf('Sgt')).toBe('E5');
    expect(payGradeOf('1stSgt')).toBe('E8');
    expect(payGradeOf('NotARank')).toBeUndefined();
  });
});

describe('reducibleGrades honours both limits', () => {
  // MCO 5800.16 Vol 14 para 010302.C bars reduction at E6 and above.
  it('refuses any reduction at E6 and above', () => {
    expect(reducibleGrades('E6')).toEqual([]);
    expect(reducibleGrades('E7')).toEqual([]);
    expect(reducibleGrades('E9')).toEqual([]);
  });

  it('offers every lower grade below E6, most senior first', () => {
    expect(reducibleGrades('E5')).toEqual(['E4', 'E3', 'E2', 'E1']);
    expect(reducibleGrades('E2')).toEqual(['E1']);
  });

  // N08 is reduction to the NEXT inferior grade, 10 U.S.C. 815(b)(2)(D).
  it('offers exactly one grade under nextInferiorOnly', () => {
    expect(reducibleGrades('E5', { nextInferiorOnly: true })).toEqual(['E4']);
    expect(reducibleGrades('E2', { nextInferiorOnly: true })).toEqual(['E1']);
  });

  it('offers nothing at E1, where there is nothing below', () => {
    expect(reducibleGrades('E1')).toEqual([]);
    expect(reducibleGrades('E1', { nextInferiorOnly: true })).toEqual([]);
  });

  it('offers nothing for a grade it does not recognise', () => {
    expect(reducibleGrades('')).toEqual([]);
    expect(reducibleGrades('O3')).toEqual([]);
  });

  // MCO 5800.16 Vol 14 para 010302.C sets TWO floors, not one: E-6 for
  // Marines, E-7 for Sailors. A Navy E-6 MAY be reduced; only USMC bars it.
  it('service-aware: a Navy E-6 may still be reduced, options.service USN', () => {
    expect(reducibleGrades('E6', { service: 'USN' })).not.toEqual([]);
    expect(reducibleGrades('E6', { service: 'USN' })).toEqual(['E5', 'E4', 'E3', 'E2', 'E1']);
  });

  it('service-aware: the same E-6 is barred for USMC and for the omitted default', () => {
    expect(reducibleGrades('E6', { service: 'USMC' })).toEqual([]);
    expect(reducibleGrades('E6')).toEqual([]);
  });

  it('E-7 is barred outright for both services: USMC by its own E-6 floor, USN by its own E-7 floor', () => {
    expect(reducibleGrades('E7', { service: 'USMC' })).toEqual([]);
    expect(reducibleGrades('E7', { service: 'USN' })).toEqual([]);
  });
});

describe('reductionBarred reads the floor from the accused service, MCO 5800.16 Vol 14 para 010302.C', () => {
  // "Marines in the grade of E-6 or above ... may not be reduced in paygrade."
  it('USMC: barred at E6 and above, not below', () => {
    expect(reductionBarred('E5', 'USMC')).toBe(false);
    expect(reductionBarred('E6', 'USMC')).toBe(true);
    expect(reductionBarred('E7', 'USMC')).toBe(true);
  });

  // "and Sailors in the grade of E-7 or above may not be reduced in paygrade."
  // THIS IS THE FLOOR THE SINGLE-CONSTANT BUG GOT WRONG: a Navy E-6 is NOT barred.
  it('USN: barred at E7 and above, but E6 is NOT barred (a different floor than USMC)', () => {
    expect(reductionBarred('E5', 'USN')).toBe(false);
    expect(reductionBarred('E6', 'USN')).toBe(false);
    expect(reductionBarred('E7', 'USN')).toBe(true);
  });

  it('an omitted service argument defaults to USMC, this being a NAVMC form', () => {
    expect(reductionBarred('E5')).toBe(false);
    expect(reductionBarred('E6')).toBe(true);
    expect(reductionBarred('E7')).toBe(true);
  });

  it('an unreadable pay grade returns false, never true: the app does not assert a bar it cannot support', () => {
    expect(reductionBarred('')).toBe(false);
    expect(reductionBarred('LCpl')).toBe(false);
    expect(reductionBarred('O5')).toBe(false);
    expect(reductionBarred('E')).toBe(false);
  });
});

describe('reducedPayGrade resolves either a rank abbreviation or a bare pay grade', () => {
  it('resolves a Marine rank abbreviation to its pay grade', () => {
    expect(reducedPayGrade('LCpl')).toBe('E3');
    expect(reducedPayGrade('Sgt')).toBe('E5');
  });

  it('passes a bare pay grade through, with or without a dash', () => {
    expect(reducedPayGrade('E3')).toBe('E3');
    expect(reducedPayGrade('E-3')).toBe('E3');
  });

  it('returns empty for empty input and for an unrecognised token', () => {
    expect(reducedPayGrade('')).toBe('');
    expect(reducedPayGrade('NotAThing')).toBe('');
  });
});

describe('anti-regression: the two reduction-bar floors must not collapse to one', () => {
  // This guards against the exact bug fixed 2026-08-24: navmc10132-ranks.ts
  // and validator W-08 both tested a single hardcoded E-6 floor for every
  // service, which refused a lawful reduction of a Navy E-6 and let an
  // unlawful reduction of a Navy E-7 through unwarned. If USMC and USN ever
  // read the same number again, that bug is back.
  it('NAVMC_10132_REDUCTION_BAR_FLOOR.USMC and .USN are different floors', () => {
    expect(NAVMC_10132_REDUCTION_BAR_FLOOR.USMC).not.toBe(NAVMC_10132_REDUCTION_BAR_FLOOR.USN);
    expect(NAVMC_10132_REDUCTION_BAR_FLOOR.USMC).toBe(6);
    expect(NAVMC_10132_REDUCTION_BAR_FLOOR.USN).toBe(7);
  });
});

describe('splitRankGrade is the inverse of formatRankGrade, and validates', () => {
  const ENLISTED = NAVMC_10132_ENLISTED_PAY_GRADES;

  it('round-trips anything formatRankGrade composed', () => {
    for (const rank of NAVMC_10132_USMC_ENLISTED_RANKS) {
      const composed = formatRankGrade(rank.abbreviation, rank.payGrade);
      expect(splitRankGrade(composed, ENLISTED)).toEqual({
        rank: rank.abbreviation,
        payGrade: rank.payGrade,
      });
    }
  });

  /**
   * THE RISK THE ORIGINAL READER REFUSED TO TAKE, answered by validation. A
   * tail outside the closed list returns a null grade, so a caller loses a
   * derived field and never writes a wrong one onto a legal record. "E-4"
   * is the exact case the form's page 3 note forbids and its own item 7
   * example prints anyway.
   */
  it('returns no pay grade for a tail outside the closed list', () => {
    expect(splitRankGrade('Cpl, E-4', ENLISTED).payGrade).toBeNull();
    expect(splitRankGrade('Cpl, E10', ENLISTED).payGrade).toBeNull();
    expect(splitRankGrade('Cpl, Corporal', ENLISTED).payGrade).toBeNull();
  });

  it('returns the whole string as the rank when there is no separator', () => {
    expect(splitRankGrade('Corporal', ENLISTED)).toEqual({ rank: 'Corporal', payGrade: null });
  });

  it('tolerates the spacing a hand-typed value carries', () => {
    expect(splitRankGrade('  Cpl ,   E4  ', ENLISTED)).toEqual({ rank: 'Cpl', payGrade: 'E4' });
  });

  // Reading from the right means a rank gaining a comma later loses nothing.
  it('splits on the last separator, not the first', () => {
    expect(splitRankGrade('Chief, Something, E7', ENLISTED)).toEqual({
      rank: 'Chief, Something',
      payGrade: 'E7',
    });
  });

  it('is empty-safe', () => {
    expect(splitRankGrade('', ENLISTED)).toEqual({ rank: '', payGrade: null });
  });
});
