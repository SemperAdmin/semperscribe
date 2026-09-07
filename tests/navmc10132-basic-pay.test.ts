// Vitest suite for src/lib/navmc10132-basic-pay.ts (monthlyBasicPay,
// payTableStatus, forfeitureCeiling) and the V-19/V-20 punishment validators
// in src/lib/navmc10132-validators-punishment.ts that consume them.
//
// Rewritten 2026-08-25 against the reworked API: monthlyBasicPay and
// forfeitureCeiling now return discriminated unions (BasicPayLookup /
// ForfeitureCeilingResult) instead of `number | null`, forfeitureCeiling
// requires a PayTableStatus, BASIC_PAY_EFFECTIVE_DATE is gone in favor of
// PAY_TABLE_WINDOW, and payTableStatus validates a real calendar date. See
// the module header for the seven defects this closed.
//
// Controlling authorities, quoted in the source and re-quoted here only where
// an assertion depends on the exact words:
//   JAGMAN 0111.b - correctional custody requires an unsuspended reduction
//                    below E-4 for an E-4-or-above accused.
//   JAGMAN 0111.i - pay subject to forfeiture is basic pay plus sea/hardship
//                    duty pay, based on the reduced grade when one is imposed.
//   DoD FMR Vol 7A Ch 1 - the daily rate is 1/30 of the monthly rate.
//   MCO 5800.16 Vol 14 para 010901 - forfeiture must be whole dollars only,
//                    so a ceiling rounds DOWN.

import { describe, it, expect } from 'vitest';
import type { FormData } from '@/types';
import type { ValidationIssue } from '@/lib/letter-validators';
import { createEmptyNavmc10132Data } from '@/types/navmc';
import { getExportBlockers } from '@/lib/letter-validators';

import {
  monthlyBasicPay,
  payTableStatus,
  forfeitureCeiling,
  computePayTableCellDigest,
  PAY_TABLE_CELL_DIGEST,
  PAY_TABLE_WINDOW,
  SENIOR_ENLISTED_SPECIAL_POSITION_PAY,
  E1_UNDER_FOUR_MONTHS,
  CEILING_REASONS_WORTH_SURFACING,
} from '@/lib/navmc10132-basic-pay';

import {
  correctionalCustodyGradeIssues,
  forfeitureCeilingIssues,
  punishmentIssues,
} from '@/lib/navmc10132-validators-punishment';

// ---------------------------------------------------------------------------
// Fixture helpers, matching the style in tests/navmc10132-validators.test.ts
// ---------------------------------------------------------------------------

function baseForm(overrides: Record<string, unknown> = {}): FormData {
  return {
    documentType: 'navmc10132',
    ...createEmptyNavmc10132Data(),
    ...overrides,
  };
}

/** Finds the one issue whose id matches, or fails the test with a clear message. */
function findIssue(issues: ValidationIssue[], idPrefix: string): ValidationIssue {
  const found = issues.find((i) => i.id.startsWith(idPrefix));
  if (!found) {
    throw new Error(
      `Expected an issue with id starting "${idPrefix}", got: ${issues.map((i) => i.id).join(', ') || '(none)'}`
    );
  }
  return found;
}

/**
 * Unwraps a BasicPayLookup to its rate, failing loudly (not with a silent
 * `undefined`) when the fixture does not actually resolve to a rate. Used so
 * ceiling figures are computed from the table rather than hardcoded, per the
 * rule that every ceiling figure in this suite traces back to monthlyBasicPay.
 */
function rate(payGrade: string, yearsOfService: string | number): number {
  const lookup = monthlyBasicPay(payGrade, yearsOfService);
  if (lookup.kind !== 'rate') {
    throw new Error(
      `Expected a rate for ${payGrade} at ${yearsOfService} years, got kind "${lookup.kind}"` +
        (lookup.kind === 'unavailable' ? ` (${lookup.reason}: ${lookup.detail})` : ''),
    );
  }
  return lookup.monthly;
}

/** A PayTableStatus that is current against the window this file holds. */
const currentStatus = payTableStatus('2026-06-15');

/** The enlisted grades the published table carries a row for, junior to senior. */
const GRADES = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9'];

/**
 * The lower bound in years of each printed column on the DFAS table, in
 * order. These are the table's own column headings ("Over 2" etc.), not a
 * simplification of them, and are duplicated here (rather than imported)
 * because the module deliberately keeps its bracket list private.
 */
const YOS_YEARS = [
  0, 2, 3, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40,
];

// ---------------------------------------------------------------------------
// monthlyBasicPay
// ---------------------------------------------------------------------------

describe('monthlyBasicPay', () => {
  it('reads the E3 bracket boundaries, "Over 2" meaning >= 2', () => {
    expect(rate('E3', 1)).toBe(2836.8);
    expect(rate('E3', 2)).toBe(3015.0);
    expect(rate('E3', 3)).toBe(3198.0);
    expect(rate('E3', 40)).toBe(3198.0);
  });

  describe('the two meanings of unavailable (defect 6)', () => {
    it('a blank table cell reads {kind:"unavailable", reason:"no-rate-published"}, never a rate of 0', () => {
      const e8 = monthlyBasicPay('E8', 2);
      const e9 = monthlyBasicPay('E9', 5);
      expect(e8.kind).toBe('unavailable');
      expect(e9.kind).toBe('unavailable');
      if (e8.kind === 'unavailable') expect(e8.reason).toBe('no-rate-published');
      if (e9.kind === 'unavailable') expect(e9.reason).toBe('no-rate-published');
    });

    it('a non-enlisted or out-of-range grade reads "unreadable-grade"', () => {
      for (const bad of ['XYZ', 'LCpl', 'O5', 'E10']) {
        const lookup = monthlyBasicPay(bad, 5);
        expect(lookup.kind, bad).toBe('unavailable');
        if (lookup.kind === 'unavailable') expect(lookup.reason, bad).toBe('unreadable-grade');
      }
    });

    it('an empty grade reads "grade-not-set", distinct from "unreadable-grade"', () => {
      const lookup = monthlyBasicPay('', 5);
      expect(lookup.kind).toBe('unavailable');
      if (lookup.kind === 'unavailable') expect(lookup.reason).toBe('grade-not-set');
    });

    it('empty years reads "years-not-set"; unparseable or negative years reads "unreadable-years"', () => {
      const unset = monthlyBasicPay('E5', '');
      expect(unset.kind).toBe('unavailable');
      if (unset.kind === 'unavailable') expect(unset.reason).toBe('years-not-set');

      const unreadable = monthlyBasicPay('E5', 'abc');
      expect(unreadable.kind).toBe('unavailable');
      if (unreadable.kind === 'unavailable') expect(unreadable.reason).toBe('unreadable-years');

      const negative = monthlyBasicPay('E5', -1);
      expect(negative.kind).toBe('unavailable');
      if (negative.kind === 'unavailable') expect(negative.reason).toBe('unreadable-years');
    });

    it('"E-05", "E 5", and "e5" resolve to the same rate as "E5" — these used to miss every row and be indistinguishable from a blank cell', () => {
      const canonical = rate('E5', 2);
      expect(rate('E-05', 2)).toBe(canonical);
      expect(rate('E 5', 2)).toBe(canonical);
      expect(rate('e5', 2)).toBe(canonical);
    });
  });

  describe('CEILING_REASONS_WORTH_SURFACING', () => {
    it('contains exactly the three unreadable-input reasons, and none of the ordinary or blocked ones', () => {
      expect([...CEILING_REASONS_WORTH_SURFACING].sort()).toEqual(
        ['unreadable-extra-pay', 'unreadable-grade', 'unreadable-years'].sort(),
      );
      expect(CEILING_REASONS_WORTH_SURFACING).not.toContain('no-rate-published');
      expect(CEILING_REASONS_WORTH_SURFACING).not.toContain('grade-not-set');
      expect(CEILING_REASONS_WORTH_SURFACING).not.toContain('years-not-set');
    });
  });

  describe('table integrity', () => {
    it('computePayTableCellDigest() equals PAY_TABLE_CELL_DIGEST: monotonicity cannot catch a transposed digit because it preserves ordering — 5 of 6 injected transcription errors passed the row/column invariants below undetected', () => {
      expect(computePayTableCellDigest()).toBe(PAY_TABLE_CELL_DIGEST);
    });

    // Cheap, and catches a different error class than the digest (an out-of-
    // order cell that isn't necessarily a transcription error). Kept, not
    // deleted, per the module header's own instruction.
    it('every grade row is non-decreasing left to right across non-null cells', () => {
      for (const grade of GRADES) {
        const values: number[] = [];
        for (const years of YOS_YEARS) {
          const lookup = monthlyBasicPay(grade, years);
          if (lookup.kind === 'rate') values.push(lookup.monthly);
        }
        for (let i = 1; i < values.length; i++) {
          expect(
            values[i],
            `${grade}: bracket ${i} (${values[i]}) should be >= bracket ${i - 1} (${values[i - 1]})`
          ).toBeGreaterThanOrEqual(values[i - 1]);
        }
      }
    });

    it('at every years-of-service bracket, pay is non-decreasing as grade rises E1 -> E9', () => {
      for (const years of YOS_YEARS) {
        const values: number[] = [];
        for (const grade of GRADES) {
          const lookup = monthlyBasicPay(grade, years);
          if (lookup.kind === 'rate') values.push(lookup.monthly);
        }
        for (let i = 1; i < values.length; i++) {
          expect(
            values[i],
            `at ${years} years: value ${values[i]} should be >= previous grade's ${values[i - 1]}`
          ).toBeGreaterThanOrEqual(values[i - 1]);
        }
      }
    });

    it('every non-null cell is a positive number with at most 2 decimal places', () => {
      for (const grade of GRADES) {
        for (const years of YOS_YEARS) {
          const lookup = monthlyBasicPay(grade, years);
          if (lookup.kind !== 'rate') continue;
          const value = lookup.monthly;
          expect(value, `${grade} at ${years} years`).toBeGreaterThan(0);
          const cents = value * 100;
          expect(
            Math.abs(cents - Math.round(cents)),
            `${grade} at ${years} years: ${value} has more than 2 decimal places`
          ).toBeLessThan(1e-6);
        }
      }
    });
  });
});

// ---------------------------------------------------------------------------
// payTableStatus
// ---------------------------------------------------------------------------

describe('payTableStatus', () => {
  it('is current for a 2026 date inside the held window', () => {
    const status = payTableStatus('2026-03-15');
    expect(status.current).toBe(true);
    expect(status.effectiveFrom).toBe(PAY_TABLE_WINDOW.effectiveFrom);
  });

  it('is not current for a date before effectiveFrom, and the detail says it predates the table', () => {
    const status = payTableStatus('2025-12-31');
    expect(status.current).toBe(false);
    expect(status.effectiveFrom).toBe(PAY_TABLE_WINDOW.effectiveFrom);
    expect(status.detail).toContain('predates');
  });

  it('rejects a date that is not on the real calendar (defect 7): "2026-99-99" and "2026-02-30" are not current, "2026-02-28" is', () => {
    expect(payTableStatus('2026-99-99').current).toBe(false);
    expect(payTableStatus('2026-02-30').current).toBe(false);
    expect(payTableStatus('2026-02-28').current).toBe(true);
  });

  it('never treats an undated or malformed item 6 date as current', () => {
    expect(payTableStatus('').current).toBe(false);
    expect(payTableStatus('not a date').current).toBe(false);
  });

  it('always populates detail', () => {
    expect(payTableStatus('2026-01-01').detail.length).toBeGreaterThan(0);
    expect(payTableStatus('2025-01-01').detail.length).toBeGreaterThan(0);
    expect(payTableStatus('').detail.length).toBeGreaterThan(0);
  });

  it('one calendar year carried two enlisted tables after the FY25 NDAA junior-enlisted raise, which is why a 2025-05-15 punishment is not current against this file\'s explicit window even though it falls in the same year as an old January table', () => {
    const status = payTableStatus('2025-05-15');
    expect(status.current).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// forfeitureCeiling
// ---------------------------------------------------------------------------

describe('forfeitureCeiling', () => {
  it('computes E2 at 3 years from the pay table: floor(monthly/30*7) and floor(monthly/2)', () => {
    const basic = rate('E2', 3);
    const result = forfeitureCeiling({ status: currentStatus, payGrade: 'E2', yearsOfService: 3 });
    expect(result.kind).toBe('ceiling');
    if (result.kind !== 'ceiling') return;
    expect(result.ceiling.monthlyBasicPay).toBe(basic);
    expect(result.ceiling.sevenDaysPay).toBe(Math.floor((basic / 30) * 7));
    expect(result.ceiling.halfMonthPay).toBe(Math.floor(basic / 2));
    // Pin the actual numbers so a silent table edit is caught too.
    expect(basic).toBe(2697.9);
    expect(result.ceiling.sevenDaysPay).toBe(629);
    expect(result.ceiling.halfMonthPay).toBe(1348);
  });

  it('rounds ceilings DOWN, never up, when the division is not whole', () => {
    const basic = rate('E1', 5);
    // Confirm this fixture actually exercises a non-whole division before
    // trusting the floor assertion below.
    expect(Number.isInteger((basic / 30) * 7)).toBe(false);
    expect(Number.isInteger(basic / 2)).toBe(false);

    const result = forfeitureCeiling({ status: currentStatus, payGrade: 'E1', yearsOfService: 5 });
    expect(result.kind).toBe('ceiling');
    if (result.kind !== 'ceiling') return;
    expect(result.ceiling.sevenDaysPay).toBe(Math.floor((basic / 30) * 7));
    expect(result.ceiling.halfMonthPay).toBe(Math.floor(basic / 2));
    expect(Number.isInteger(result.ceiling.sevenDaysPay)).toBe(true);
    expect(Number.isInteger(result.ceiling.halfMonthPay)).toBe(true);
  });

  it('adds sea or hardship duty pay to the base, raising both ceilings', () => {
    const withoutExtra = forfeitureCeiling({ status: currentStatus, payGrade: 'E5', yearsOfService: 5 });
    const withExtra = forfeitureCeiling({
      status: currentStatus,
      payGrade: 'E5',
      yearsOfService: 5,
      seaHardshipDutyPay: 150,
    });
    expect(withoutExtra.kind).toBe('ceiling');
    expect(withExtra.kind).toBe('ceiling');
    if (withoutExtra.kind !== 'ceiling' || withExtra.kind !== 'ceiling') return;

    expect(withExtra.ceiling.monthlySubjectToForfeiture).toBe(withoutExtra.ceiling.monthlyBasicPay + 150);
    expect(withExtra.ceiling.sevenDaysPay).toBeGreaterThan(withoutExtra.ceiling.sevenDaysPay);
    expect(withExtra.ceiling.halfMonthPay).toBeGreaterThan(withoutExtra.ceiling.halfMonthPay);
  });

  it('notes JAGMAN 0111.i when sea/hardship pay is 0 or blank, but not when positive', () => {
    const zero = forfeitureCeiling({ status: currentStatus, payGrade: 'E5', yearsOfService: 5, seaHardshipDutyPay: 0 });
    const blank = forfeitureCeiling({ status: currentStatus, payGrade: 'E5', yearsOfService: 5, seaHardshipDutyPay: '' });
    const positive = forfeitureCeiling({
      status: currentStatus,
      payGrade: 'E5',
      yearsOfService: 5,
      seaHardshipDutyPay: 150,
    });
    expect(zero.kind).toBe('ceiling');
    expect(blank.kind).toBe('ceiling');
    expect(positive.kind).toBe('ceiling');
    if (zero.kind !== 'ceiling' || blank.kind !== 'ceiling' || positive.kind !== 'ceiling') return;

    expect(zero.ceiling.notes.some((n) => n.includes('JAGMAN 0111.i'))).toBe(true);
    expect(blank.ceiling.notes.some((n) => n.includes('JAGMAN 0111.i'))).toBe(true);
    expect(positive.ceiling.notes.some((n) => n.includes('JAGMAN 0111.i'))).toBe(false);
  });

  it('an E-9 always carries a note about the special-position rate; an E-5 does not', () => {
    const e9 = forfeitureCeiling({ status: currentStatus, payGrade: 'E9', yearsOfService: 10, seaHardshipDutyPay: 100 });
    const e5 = forfeitureCeiling({ status: currentStatus, payGrade: 'E5', yearsOfService: 10, seaHardshipDutyPay: 100 });
    expect(e9.kind).toBe('ceiling');
    expect(e5.kind).toBe('ceiling');
    if (e9.kind !== 'ceiling' || e5.kind !== 'ceiling') return;

    const specialRateText = `$${SENIOR_ENLISTED_SPECIAL_POSITION_PAY.toFixed(2)}`;
    expect(e9.ceiling.notes.some((n) => n.includes(specialRateText))).toBe(true);
    expect(e5.ceiling.notes.some((n) => n.includes(specialRateText))).toBe(false);
  });

  // THIS ASSERTION WAS REVERSED ON 2026-08-26, and the reversal is the point.
  // It used to require NO ceiling for a blank table cell, which read as
  // caution and was the opposite: forfeitureCeiling feeds the over-ceiling
  // gate, so an E-8 whose length of service lands in a blank cell got no
  // ceiling and therefore no gate, on the grade with the largest lawful
  // maximum of any enlisted Marine. The Marine Corps CY26 maximum forfeiture
  // table prints a figure in every one of those cells, and it is the grade's
  // lowest published rate. See tests/navmc10132-forfeiture-oracle.test.ts,
  // which checks all 39 of them.
  //
  // The LOOKUP still reports the blank cell truthfully. Only the CEILING
  // floors, and it says in a note that it did.
  it('reports a blank table cell truthfully at the lookup, and floors at the ceiling', () => {
    expect(monthlyBasicPay('E8', 2).kind).toBe('unavailable'); // fixture sanity check
    const lookup = monthlyBasicPay('E8', 2);
    if (lookup.kind === 'unavailable') expect(lookup.reason).toBe('no-rate-published');

    const result = forfeitureCeiling({ status: currentStatus, payGrade: 'E8', yearsOfService: 2 });
    expect(result.kind).toBe('ceiling');
    if (result.kind !== 'ceiling') return;
    // The lowest rate the table publishes for E-8, which is the over-eight one.
    expect(result.ceiling.monthlyBasicPay).toBe(5656.50);
    expect(result.ceiling.notes.some((n) => n.includes('prints no rate'))).toBe(true);
  });

  it('is unavailable/unreadable-extra-pay when sea/hardship duty pay is negative or unparseable', () => {
    const negative = forfeitureCeiling({
      status: currentStatus,
      payGrade: 'E5',
      yearsOfService: 5,
      seaHardshipDutyPay: -50,
    });
    expect(negative.kind).toBe('unavailable');
    if (negative.kind === 'unavailable') expect(negative.reason).toBe('unreadable-extra-pay');

    const unreadable = forfeitureCeiling({
      status: currentStatus,
      payGrade: 'E5',
      yearsOfService: 5,
      seaHardshipDutyPay: 'abc',
    });
    expect(unreadable.kind).toBe('unavailable');
    if (unreadable.kind === 'unavailable') expect(unreadable.reason).toBe('unreadable-extra-pay');
  });

  describe('the E-1 four-months note (defect 1, was dead code)', () => {
    it('an E-1 ceiling carries a note naming four months, $2225.70, and the two lowered ceilings', () => {
      const result = forfeitureCeiling({ status: currentStatus, payGrade: 'E1', yearsOfService: 5 });
      expect(result.kind).toBe('ceiling');
      if (result.kind !== 'ceiling') return;

      const note = result.ceiling.notes.find((n) => n.includes('four months'));
      expect(note).toBeDefined();
      expect(note as string).toContain('2225.70');

      const loweredSeven = Math.floor((E1_UNDER_FOUR_MONTHS / 30) * 7);
      const loweredHalf = Math.floor(E1_UNDER_FOUR_MONTHS / 2);
      expect(loweredSeven).toBe(519);
      expect(loweredHalf).toBe(1112);
      expect(note as string).toContain(String(loweredSeven));
      expect(note as string).toContain(String(loweredHalf));
    });

    it('the printed E-1 ceiling itself (no sea pay) is 561 and 1203, computed from the ordinary E-1 rate, distinct from the lowered 519/1112 named in the note', () => {
      const basic = rate('E1', 5);
      const result = forfeitureCeiling({ status: currentStatus, payGrade: 'E1', yearsOfService: 5 });
      expect(result.kind).toBe('ceiling');
      if (result.kind !== 'ceiling') return;

      expect(result.ceiling.sevenDaysPay).toBe(Math.floor((basic / 30) * 7));
      expect(result.ceiling.halfMonthPay).toBe(Math.floor(basic / 2));
      expect(result.ceiling.sevenDaysPay).toBe(561);
      expect(result.ceiling.halfMonthPay).toBe(1203);
    });

    it('an E-3 ceiling carries no four-months note', () => {
      const result = forfeitureCeiling({ status: currentStatus, payGrade: 'E3', yearsOfService: 5 });
      expect(result.kind).toBe('ceiling');
      if (result.kind !== 'ceiling') return;
      expect(result.ceiling.notes.some((n) => n.includes('four months'))).toBe(false);
    });

    it('E1_UNDER_FOUR_MONTHS is actually read by the module now, not just declared: the E-1 note carries its exact value', () => {
      const result = forfeitureCeiling({ status: currentStatus, payGrade: 'E1', yearsOfService: 5 });
      expect(result.kind).toBe('ceiling');
      if (result.kind !== 'ceiling') return;
      expect(
        result.ceiling.notes.some((n) => n.includes(`$${E1_UNDER_FOUR_MONTHS.toFixed(2)}`)),
      ).toBe(true);
    });
  });

  /**
   * THE RULE REVERSED ON 2026-08-27, and this block is the record of both
   * halves of it.
   *
   * Until then a status that did not govern the punishment date made this
   * function return nothing at all, on the reasoning that a figure the app
   * cannot stand behind is worse than none. Stephen: "calculating the
   * possibly max forf from the table based on the YOS and the grade should
   * not require anything but the two elements."
   *
   * He is right about the arithmetic, and the old rule confused two
   * questions. Reading a cell needs a grade and a length of service. Whether
   * that cell is the LAWFUL one for a given punishment date is a property of
   * the answer, not a precondition of computing it. So the figures come back
   * and carry the flag, and the callers that must not ACT on an ungoverned
   * figure check it. V-20 does, which is asserted in its own suite.
   *
   * WHAT THIS COST HIM. Every A-1-f hearing script is generated before the
   * hearing, so item 6 carries no punishment date, so no script this app has
   * ever produced showed a ceiling.
   */
  describe('a table that does not govern the date still yields figures', () => {
    it('computes from the grade and the years alone, and marks the table as not governing', () => {
      const staleStatus = payTableStatus('2025-06-01');
      expect(staleStatus.current).toBe(false); // fixture sanity check
      expect(monthlyBasicPay('E2', 3).kind).toBe('rate'); // grade/years are fine on their own

      const result = forfeitureCeiling({ status: staleStatus, payGrade: 'E2', yearsOfService: 3 });
      expect(result.kind).toBe('ceiling');
      if (result.kind !== 'ceiling') return;
      expect(result.ceiling.tableGovernsDate).toBe(false);
      expect(result.ceiling.payTableDetail).toBe(staleStatus.detail);
      expect(result.ceiling.sevenDaysPay).toBeGreaterThan(0);
    });

    // THE FIGURES ARE THE SAME FIGURES. The date does not change which cell
    // is read, only whether the app vouches for it, so a test that merely
    // checked "a number came back" would pass on a fallback that priced the
    // wrong grade.
    it('reads the identical cell whether or not the table governs', () => {
      const stale = forfeitureCeiling({
        status: payTableStatus('2025-06-01'),
        payGrade: 'E2',
        yearsOfService: 3,
      });
      const current = forfeitureCeiling({
        status: currentStatus,
        payGrade: 'E2',
        yearsOfService: 3,
      });
      expect(stale.kind).toBe('ceiling');
      expect(current.kind).toBe('ceiling');
      if (stale.kind !== 'ceiling' || current.kind !== 'ceiling') return;
      expect(stale.ceiling.sevenDaysPay).toBe(current.ceiling.sevenDaysPay);
      expect(stale.ceiling.halfMonthPay).toBe(current.ceiling.halfMonthPay);
    });

    // NEVER SILENT ABOUT IT. A planning maximum presented as a lawful ceiling
    // is the failure the old gate was trying to prevent, and the caveat is
    // what replaces the gate. It is unshifted to the FRONT of the notes
    // because it qualifies every figure under it.
    it('leads the notes with the caveat rather than burying it', () => {
      const result = forfeitureCeiling({
        status: payTableStatus(''),
        payGrade: 'E4',
        yearsOfService: 4,
      });
      expect(result.kind).toBe('ceiling');
      if (result.kind !== 'ceiling') return;
      expect(result.ceiling.notes[0]).toContain('not confirmed as the one governing');
      expect(result.ceiling.notes[0]).toContain('planning maximum');
    });

    it('says nothing of the kind when the table does govern', () => {
      const result = forfeitureCeiling({
        status: currentStatus,
        payGrade: 'E4',
        yearsOfService: 4,
      });
      expect(result.kind).toBe('ceiling');
      if (result.kind !== 'ceiling') return;
      expect(result.ceiling.tableGovernsDate).toBe(true);
      expect(result.ceiling.notes.join(' ')).not.toContain('planning maximum');
    });

    // A DATE IS STILL NOT A SUBSTITUTE FOR THE TWO ELEMENTS. Dropping the
    // date gate must not have dropped the real preconditions with it.
    it('still declines when the grade or the length of service is missing', () => {
      expect(
        forfeitureCeiling({ status: currentStatus, payGrade: '', yearsOfService: 4 }).kind,
      ).toBe('unavailable');
      expect(
        forfeitureCeiling({ status: currentStatus, payGrade: 'E4', yearsOfService: '' }).kind,
      ).toBe('unavailable');
    });
  });
});

// ---------------------------------------------------------------------------
// correctionalCustodyGradeIssues (V-19)
// ---------------------------------------------------------------------------

describe('correctionalCustodyGradeIssues (V-19)', () => {
  it('does not fire on an E-3 with correctional custody (below E-4)', () => {
    const form = baseForm({
      accusedPayGrade: 'E3',
      punishments: [{ code: 'N06', days: '7' }],
    });
    expect(correctionalCustodyGradeIssues(form)).toEqual([]);
  });

  it('fires on an E-4 with correctional custody and no reduction', () => {
    const form = baseForm({
      accusedPayGrade: 'E4',
      punishments: [{ code: 'N06', days: '7' }],
    });
    const issues = correctionalCustodyGradeIssues(form);
    expect(issues).toHaveLength(1);
    const found = findIssue(issues, 'navmc10132-v19-correctional-custody-grade');
    expect(found.severity).toBe('block');
  });

  it('does not fire on an E-5 with custody plus an unsuspended reduction below E-4', () => {
    const form = baseForm({
      accusedPayGrade: 'E5',
      punishments: [
        { code: 'N06', days: '7' },
        { code: 'N08', gradeReducedTo: 'E3' },
      ],
      suspensions: [],
    });
    expect(correctionalCustodyGradeIssues(form)).toEqual([]);
  });

  it('fires on an E-5 with custody plus a reduction only to E-4 (not below E-4)', () => {
    const form = baseForm({
      accusedPayGrade: 'E5',
      punishments: [
        { code: 'N06', days: '7' },
        { code: 'N08', gradeReducedTo: 'E4' },
      ],
      suspensions: [],
    });
    const issues = correctionalCustodyGradeIssues(form);
    expect(issues).toHaveLength(1);
    const found = findIssue(issues, 'navmc10132-v19-correctional-custody-grade');
    expect(found.severity).toBe('block');
  });

  it('a suspended reduction never leaves the accused at E-4: fires and says so', () => {
    const form = baseForm({
      accusedPayGrade: 'E5',
      punishments: [
        { code: 'N06', days: '7' },
        { code: 'N08', gradeReducedTo: 'E3' }, // below E-4, but suspended below
      ],
      suspensions: [{ punishmentIndex: 1 }],
    });
    const issues = correctionalCustodyGradeIssues(form);
    expect(issues).toHaveLength(1);
    const found = findIssue(issues, 'navmc10132-v19-correctional-custody-grade');
    expect(found.severity).toBe('block');
    expect(found.rule.toLowerCase()).toContain('suspended');
  });

  it('does not fire on an E-5 with no correctional custody imposed', () => {
    const form = baseForm({
      accusedPayGrade: 'E5',
      punishments: [{ code: 'N09', days: '5' }],
    });
    expect(correctionalCustodyGradeIssues(form)).toEqual([]);
  });

  it("V-19 stops the export, not merely the compliance list: a 'fail' severity renders as Non-compliant and lets the export through", () => {
    // E-4 with correctional custody and no reduction: unlawful under
    // JAGMAN 0111.b. getExportBlockers runs the FULL validator suite, so
    // this fixture trips other unrelated blockers too (missing offense
    // data, unit, identity, etc.) — assert on the presence of the V-19
    // prefix, never on the array's length or emptiness.
    const blocking = baseForm({
      accusedPayGrade: 'E4',
      punishments: [{ code: 'N06', days: '7' }],
    });
    const blockingIssues = getExportBlockers(blocking, [], [], []);
    expect(blockingIssues.some((i) => i.id.startsWith('navmc10132-v19-'))).toBe(true);

    // Same fixture, but with the unsuspended reduction below E-4 that
    // JAGMAN 0111.b requires: the V-19 prefix must not appear.
    const compliant = baseForm({
      accusedPayGrade: 'E4',
      punishments: [
        { code: 'N06', days: '7' },
        { code: 'N08', gradeReducedTo: 'E3' },
      ],
      suspensions: [],
    });
    const compliantIssues = getExportBlockers(compliant, [], [], []);
    expect(compliantIssues.some((i) => i.id.startsWith('navmc10132-v19-'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// forfeitureCeilingIssues (V-20)
// ---------------------------------------------------------------------------

describe('forfeitureCeilingIssues (V-20)', () => {
  it('the app will not block on a table it cannot stand behind: silent when the table is not current, even for an absurd amount', () => {
    const form = baseForm({
      punishmentDate: '2025-06-01', // not the held 2026-01-01 window
      accusedPayGrade: 'E2',
      accusedYearsOfService: '3',
      punishments: [{ code: 'N07', dollars: '99999' }],
    });
    expect(forfeitureCeilingIssues(form)).toEqual([]);
  });

  /**
   * THE SILENCE IS NOW A DECISION, NOT AN ABSENCE, and that is exactly why it
   * needs its own case.
   *
   * Before 2026-08-27 forfeitureCeiling returned nothing on a table that did
   * not govern the punishment date, so V-20 was silent because it had no
   * figure. It now gets a figure, and stays silent because it reads
   * `tableGovernsDate` and stops. The two are indistinguishable from the
   * outside, which is how a refactor deletes a safety property without
   * reddening a test. This asserts BOTH halves on one form: a ceiling exists,
   * the amount blows through it, and V-20 says nothing.
   *
   * Blocking here would be worse than running no check, because an export
   * refused on a stale figure refuses a forfeiture that may be perfectly
   * lawful under the table that does govern.
   */
  it('is silent on an UNDATED item 6 even though a ceiling is now computed for it', () => {
    const form = baseForm({
      punishmentDate: '',
      accusedPayGrade: 'E2',
      accusedYearsOfService: '3',
      punishments: [{ code: 'N07', dollars: '99999' }],
    });

    // The figure exists. This is the half the old rule made impossible.
    const result = forfeitureCeiling({
      status: payTableStatus(''),
      payGrade: 'E2',
      yearsOfService: '3',
    });
    expect(result.kind).toBe('ceiling');
    if (result.kind !== 'ceiling') return;
    expect(result.ceiling.tableGovernsDate).toBe(false);
    expect(99999).toBeGreaterThan(result.ceiling.sevenDaysPay);

    // And V-20 declines to act on it anyway.
    expect(forfeitureCeilingIssues(form)).toEqual([]);
  });

  it('is silent on a STALE table even though a ceiling is now computed for it', () => {
    const form = baseForm({
      punishmentDate: '2025-06-01',
      accusedPayGrade: 'E2',
      accusedYearsOfService: '3',
      punishments: [{ code: 'N07', dollars: '99999' }],
    });
    const result = forfeitureCeiling({
      status: payTableStatus('2025-06-01'),
      payGrade: 'E2',
      yearsOfService: '3',
    });
    expect(result.kind).toBe('ceiling');
    expect(forfeitureCeilingIssues(form)).toEqual([]);
  });

  it('is silent when years of service is unset, since no ceiling can be computed (an ordinary half-filled form, not a data error)', () => {
    const form = baseForm({
      punishmentDate: '2026-01-01',
      accusedPayGrade: 'E2',
      accusedYearsOfService: '',
      punishments: [{ code: 'N07', dollars: '99999' }],
    });
    expect(forfeitureCeilingIssues(form)).toEqual([]);
  });

  it('an unreadable forfeitureBasisGrade surfaces as exactly one blocking issue whose id names it unreadable, rather than staying silent (defect 6 reaching V-20)', () => {
    const form = baseForm({
      punishmentDate: '2026-01-01',
      accusedPayGrade: 'E2',
      forfeitureBasisGrade: 'E-XX',
      accusedYearsOfService: '3',
      punishments: [{ code: 'N07', dollars: '100' }],
    });
    const issues = forfeitureCeilingIssues(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('block');
    expect(issues[0].id).toContain('v20-ceiling-unreadable');
  });

  it('fires when a 2026-dated N07 forfeiture exceeds the seven-days ceiling, silent when equal', () => {
    const status = payTableStatus('2026-01-01');
    const ceiling = forfeitureCeiling({ status, payGrade: 'E2', yearsOfService: 3 });
    expect(ceiling.kind).toBe('ceiling');
    if (ceiling.kind !== 'ceiling') return;
    const sevenDaysPay = ceiling.ceiling.sevenDaysPay;

    const over = baseForm({
      punishmentDate: '2026-01-01',
      accusedPayGrade: 'E2',
      accusedYearsOfService: '3',
      punishments: [{ code: 'N07', dollars: String(sevenDaysPay + 1) }],
    });
    const overIssues = forfeitureCeilingIssues(over);
    expect(overIssues).toHaveLength(1);
    expect(findIssue(overIssues, 'navmc10132-v20-forfeiture-over-ceiling').severity).toBe('block');

    const equal = baseForm({
      punishmentDate: '2026-01-01',
      accusedPayGrade: 'E2',
      accusedYearsOfService: '3',
      punishments: [{ code: 'N07', dollars: String(sevenDaysPay) }],
    });
    expect(forfeitureCeilingIssues(equal)).toEqual([]);
  });

  it('fires when a 2026-dated N04 forfeiture exceeds the half-month ceiling, silent when equal', () => {
    const status = payTableStatus('2026-01-01');
    const ceiling = forfeitureCeiling({ status, payGrade: 'E2', yearsOfService: 3 });
    expect(ceiling.kind).toBe('ceiling');
    if (ceiling.kind !== 'ceiling') return;
    const halfMonthPay = ceiling.ceiling.halfMonthPay;

    const over = baseForm({
      punishmentDate: '2026-01-01',
      accusedPayGrade: 'E2',
      accusedYearsOfService: '3',
      punishments: [{ code: 'N04', dollarsPerMonth: String(halfMonthPay + 1), months: '2' }],
    });
    const overIssues = forfeitureCeilingIssues(over);
    expect(overIssues).toHaveLength(1);
    expect(findIssue(overIssues, 'navmc10132-v20-forfeiture-over-ceiling').severity).toBe('block');

    const equal = baseForm({
      punishmentDate: '2026-01-01',
      accusedPayGrade: 'E2',
      accusedYearsOfService: '3',
      punishments: [{ code: 'N04', dollarsPerMonth: String(halfMonthPay), months: '2' }],
    });
    expect(forfeitureCeilingIssues(equal)).toEqual([]);
  });

  it('uses forfeitureBasisGrade over accusedPayGrade when both are set (MCM 5.c(8))', () => {
    const status = payTableStatus('2026-01-01');
    const e2Ceiling = forfeitureCeiling({ status, payGrade: 'E2', yearsOfService: 3 });
    const e5Ceiling = forfeitureCeiling({ status, payGrade: 'E5', yearsOfService: 3 });
    expect(e2Ceiling.kind).toBe('ceiling');
    expect(e5Ceiling.kind).toBe('ceiling');
    if (e2Ceiling.kind !== 'ceiling' || e5Ceiling.kind !== 'ceiling') return;
    // Fixture sanity check: the two grades must actually have different
    // ceilings, or this test would not distinguish which one was used.
    expect(e2Ceiling.ceiling.sevenDaysPay).not.toBe(e5Ceiling.ceiling.sevenDaysPay);

    const form = baseForm({
      punishmentDate: '2026-01-01',
      accusedPayGrade: 'E5',
      forfeitureBasisGrade: 'E2',
      accusedYearsOfService: '3',
      punishments: [{ code: 'N07', dollars: String(e2Ceiling.ceiling.sevenDaysPay + 1) }],
    });
    const issues = forfeitureCeilingIssues(form);
    expect(issues).toHaveLength(1);
    const found = findIssue(issues, 'navmc10132-v20-forfeiture-over-ceiling');
    expect(found.rule).toContain(`ceiling at E2 is $${e2Ceiling.ceiling.sevenDaysPay}`);
    expect(found.rule).not.toContain('ceiling at E5');
  });

  it("V-20 stops the export, not merely the compliance list: a 'fail' severity renders as Non-compliant and lets the export through", () => {
    const status = payTableStatus('2026-01-01');
    const ceiling = forfeitureCeiling({ status, payGrade: 'E2', yearsOfService: 3 });
    expect(ceiling.kind).toBe('ceiling');
    if (ceiling.kind !== 'ceiling') return;

    // Over the ceiling: unlawful under 10 U.S.C. 815(b)(2)(C).
    // getExportBlockers runs the FULL validator suite, so this fixture
    // trips other unrelated blockers too — assert on the presence of the
    // V-20 prefix, never on the array's length or emptiness.
    const blocking = baseForm({
      punishmentDate: '2026-01-01',
      accusedPayGrade: 'E2',
      accusedYearsOfService: '3',
      punishments: [{ code: 'N07', dollars: String(ceiling.ceiling.sevenDaysPay + 1) }],
    });
    const blockingIssues = getExportBlockers(blocking, [], [], []);
    expect(blockingIssues.some((i) => i.id.startsWith('navmc10132-v20-'))).toBe(true);

    // Same fixture, but forfeiture set exactly at the ceiling: no V-20 issue.
    const compliant = baseForm({
      punishmentDate: '2026-01-01',
      accusedPayGrade: 'E2',
      accusedYearsOfService: '3',
      punishments: [{ code: 'N07', dollars: String(ceiling.ceiling.sevenDaysPay) }],
    });
    const compliantIssues = getExportBlockers(compliant, [], [], []);
    expect(compliantIssues.some((i) => i.id.startsWith('navmc10132-v20-'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

describe('V-19 and V-20 wiring into punishmentIssues', () => {
  it('runs correctionalCustodyGradeIssues and forfeitureCeilingIssues as part of punishmentIssues', () => {
    const form = baseForm({
      accusedPayGrade: 'E4',
      punishmentDate: '2026-01-01',
      accusedYearsOfService: '3',
      punishments: [
        { code: 'N06', days: '7' }, // trips V-19: E4 with custody, no reduction
        { code: 'N07', dollars: '99999' }, // trips V-20: absurdly over ceiling
      ],
    });
    const issues = punishmentIssues(form);
    findIssue(issues, 'navmc10132-v19-correctional-custody-grade');
    findIssue(issues, 'navmc10132-v20-forfeiture-over-ceiling');
  });
});
