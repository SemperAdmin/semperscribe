// Vitest suite for src/lib/navmc10132-basic-pay.ts (monthlyBasicPay,
// payTableStatus, forfeitureCeiling) and the V-19/V-20 punishment validators
// in src/lib/navmc10132-validators-punishment.ts that consume them.
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

import {
  monthlyBasicPay,
  payTableStatus,
  forfeitureCeiling,
  SENIOR_ENLISTED_SPECIAL_POSITION_PAY,
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
    expect(monthlyBasicPay('E3', 1)).toBe(2836.8);
    expect(monthlyBasicPay('E3', 2)).toBe(3015.0);
    expect(monthlyBasicPay('E3', 3)).toBe(3198.0);
    expect(monthlyBasicPay('E3', 40)).toBe(3198.0);
  });

  it('returns null on a blank table cell, meaning the app states no rate, never zero', () => {
    const e8 = monthlyBasicPay('E8', 2);
    const e9 = monthlyBasicPay('E9', 5);
    expect(e8).toBeNull();
    expect(e9).toBeNull();
    expect(e8).not.toBe(0);
    expect(e9).not.toBe(0);
  });

  it('returns null for an unreadable pay grade', () => {
    expect(monthlyBasicPay('', 5)).toBeNull();
    expect(monthlyBasicPay('LCpl', 5)).toBeNull();
    expect(monthlyBasicPay('O5', 5)).toBeNull();
    expect(monthlyBasicPay('E10', 5)).toBeNull();
  });

  it('returns null for an unreadable length of service', () => {
    expect(monthlyBasicPay('E5', '')).toBeNull();
    expect(monthlyBasicPay('E5', 'abc')).toBeNull();
    expect(monthlyBasicPay('E5', -1)).toBeNull();
  });

  it('tolerates a dash and lowercase grade: "e-5" resolves the same as "E5"', () => {
    expect(monthlyBasicPay('e-5', 2)).toBe(monthlyBasicPay('E5', 2));
    expect(monthlyBasicPay('e-5', 2)).not.toBeNull();
  });

  describe('structural invariants over the whole table', () => {
    it('every grade row is non-decreasing left to right across non-null cells', () => {
      for (const grade of GRADES) {
        const values = YOS_YEARS.map((y) => monthlyBasicPay(grade, y)).filter(
          (v): v is number => v !== null
        );
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
        const values = GRADES.map((g) => monthlyBasicPay(g, years)).filter(
          (v): v is number => v !== null
        );
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
          const value = monthlyBasicPay(grade, years);
          if (value === null) continue;
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
  it('is current for a 2026 punishment date (the file holds the 2026-01-01 table)', () => {
    const status = payTableStatus('2026-03-15');
    expect(status.current).toBe(true);
    expect(status.expectedEffective).toBe('2026-01-01');
  });

  it('is not current for a 2025 punishment date and names 2025-01-01 as expected', () => {
    const status = payTableStatus('2025-06-01');
    expect(status.current).toBe(false);
    expect(status.expectedEffective).toBe('2025-01-01');
  });

  it('is not current for a 2027 punishment date and names 2027-01-01 as expected', () => {
    const status = payTableStatus('2027-01-05');
    expect(status.current).toBe(false);
    expect(status.expectedEffective).toBe('2027-01-01');
  });

  it('never treats an undated item 6 as current', () => {
    const empty = payTableStatus('');
    expect(empty.current).toBe(false);
    expect(empty.expectedEffective).toBe('');

    const malformed = payTableStatus('not a date');
    expect(malformed.current).toBe(false);
    expect(malformed.expectedEffective).toBe('');
  });

  it('always populates detail', () => {
    expect(payTableStatus('2026-01-01').detail.length).toBeGreaterThan(0);
    expect(payTableStatus('2025-01-01').detail.length).toBeGreaterThan(0);
    expect(payTableStatus('').detail.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// forfeitureCeiling
// ---------------------------------------------------------------------------

describe('forfeitureCeiling', () => {
  it('computes E2 at 3 years from the pay table: floor(monthly/30*7) and floor(monthly/2)', () => {
    const monthly = monthlyBasicPay('E2', 3);
    expect(monthly).not.toBeNull();
    const basic = monthly as number;

    const ceiling = forfeitureCeiling({ payGrade: 'E2', yearsOfService: 3 });
    expect(ceiling).not.toBeNull();
    expect(ceiling!.monthlyBasicPay).toBe(basic);
    expect(ceiling!.sevenDaysPay).toBe(Math.floor((basic / 30) * 7));
    expect(ceiling!.halfMonthPay).toBe(Math.floor(basic / 2));
    // Pin the actual numbers so a silent table edit is caught too.
    expect(basic).toBe(2697.9);
    expect(ceiling!.sevenDaysPay).toBe(629);
    expect(ceiling!.halfMonthPay).toBe(1348);
  });

  it('rounds ceilings DOWN, never up, when the division is not whole', () => {
    const monthly = monthlyBasicPay('E1', 5);
    expect(monthly).not.toBeNull();
    const basic = monthly as number;
    // Confirm this fixture actually exercises a non-whole division before
    // trusting the floor assertion below.
    expect(Number.isInteger((basic / 30) * 7)).toBe(false);
    expect(Number.isInteger(basic / 2)).toBe(false);

    const ceiling = forfeitureCeiling({ payGrade: 'E1', yearsOfService: 5 });
    expect(ceiling).not.toBeNull();
    expect(ceiling!.sevenDaysPay).toBe(Math.floor((basic / 30) * 7));
    expect(ceiling!.halfMonthPay).toBe(Math.floor(basic / 2));
    expect(Number.isInteger(ceiling!.sevenDaysPay)).toBe(true);
    expect(Number.isInteger(ceiling!.halfMonthPay)).toBe(true);
  });

  it('adds sea or hardship duty pay to the base, raising both ceilings', () => {
    const withoutExtra = forfeitureCeiling({ payGrade: 'E5', yearsOfService: 5 });
    const withExtra = forfeitureCeiling({
      payGrade: 'E5',
      yearsOfService: 5,
      seaHardshipDutyPay: 150,
    });
    expect(withoutExtra).not.toBeNull();
    expect(withExtra).not.toBeNull();

    expect(withExtra!.monthlySubjectToForfeiture).toBe(withoutExtra!.monthlyBasicPay + 150);
    expect(withExtra!.sevenDaysPay).toBeGreaterThan(withoutExtra!.sevenDaysPay);
    expect(withExtra!.halfMonthPay).toBeGreaterThan(withoutExtra!.halfMonthPay);
  });

  it('notes JAGMAN 0111.i when sea/hardship pay is 0 or blank, but not when positive', () => {
    const zero = forfeitureCeiling({ payGrade: 'E5', yearsOfService: 5, seaHardshipDutyPay: 0 });
    const blank = forfeitureCeiling({ payGrade: 'E5', yearsOfService: 5, seaHardshipDutyPay: '' });
    const positive = forfeitureCeiling({
      payGrade: 'E5',
      yearsOfService: 5,
      seaHardshipDutyPay: 150,
    });

    expect(zero!.notes.some((n) => n.includes('JAGMAN 0111.i'))).toBe(true);
    expect(blank!.notes.some((n) => n.includes('JAGMAN 0111.i'))).toBe(true);
    expect(positive!.notes.some((n) => n.includes('JAGMAN 0111.i'))).toBe(false);
  });

  it('an E-9 always carries a note about the special-position rate; an E-5 does not', () => {
    const e9 = forfeitureCeiling({ payGrade: 'E9', yearsOfService: 10, seaHardshipDutyPay: 100 });
    const e5 = forfeitureCeiling({ payGrade: 'E5', yearsOfService: 10, seaHardshipDutyPay: 100 });
    expect(e9).not.toBeNull();
    expect(e5).not.toBeNull();

    const specialRateText = `$${SENIOR_ENLISTED_SPECIAL_POSITION_PAY.toFixed(2)}`;
    expect(e9!.notes.some((n) => n.includes(specialRateText))).toBe(true);
    expect(e5!.notes.some((n) => n.includes(specialRateText))).toBe(false);
  });

  it('returns null when basic pay is null (a blank table cell)', () => {
    expect(monthlyBasicPay('E8', 2)).toBeNull(); // fixture sanity check
    expect(forfeitureCeiling({ payGrade: 'E8', yearsOfService: 2 })).toBeNull();
  });

  it('returns null when sea/hardship duty pay is negative or unparseable', () => {
    expect(
      forfeitureCeiling({ payGrade: 'E5', yearsOfService: 5, seaHardshipDutyPay: -50 })
    ).toBeNull();
    expect(
      forfeitureCeiling({ payGrade: 'E5', yearsOfService: 5, seaHardshipDutyPay: 'abc' })
    ).toBeNull();
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
    expect(found.severity).toBe('fail');
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
    expect(found.severity).toBe('fail');
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
    expect(found.severity).toBe('fail');
    expect(found.rule.toLowerCase()).toContain('suspended');
  });

  it('does not fire on an E-5 with no correctional custody imposed', () => {
    const form = baseForm({
      accusedPayGrade: 'E5',
      punishments: [{ code: 'N09', days: '5' }],
    });
    expect(correctionalCustodyGradeIssues(form)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// forfeitureCeilingIssues (V-20)
// ---------------------------------------------------------------------------

describe('forfeitureCeilingIssues (V-20)', () => {
  it('the app will not block on a table it cannot stand behind: silent when the table is not current, even for an absurd amount', () => {
    const form = baseForm({
      punishmentDate: '2025-06-01', // not the held 2026-01-01 table
      accusedPayGrade: 'E2',
      accusedYearsOfService: '3',
      punishments: [{ code: 'N07', dollars: '99999' }],
    });
    expect(forfeitureCeilingIssues(form)).toEqual([]);
  });

  it('is silent when years of service is unset, since no ceiling can be computed', () => {
    const form = baseForm({
      punishmentDate: '2026-01-01',
      accusedPayGrade: 'E2',
      accusedYearsOfService: '',
      punishments: [{ code: 'N07', dollars: '99999' }],
    });
    expect(forfeitureCeilingIssues(form)).toEqual([]);
  });

  it('fires when a 2026-dated N07 forfeiture exceeds the seven-days ceiling, silent when equal', () => {
    const ceiling = forfeitureCeiling({ payGrade: 'E2', yearsOfService: 3 });
    expect(ceiling).not.toBeNull();
    const sevenDaysPay = ceiling!.sevenDaysPay;

    const over = baseForm({
      punishmentDate: '2026-01-01',
      accusedPayGrade: 'E2',
      accusedYearsOfService: '3',
      punishments: [{ code: 'N07', dollars: String(sevenDaysPay + 1) }],
    });
    const overIssues = forfeitureCeilingIssues(over);
    expect(overIssues).toHaveLength(1);
    expect(findIssue(overIssues, 'navmc10132-v20-forfeiture-over-ceiling').severity).toBe('fail');

    const equal = baseForm({
      punishmentDate: '2026-01-01',
      accusedPayGrade: 'E2',
      accusedYearsOfService: '3',
      punishments: [{ code: 'N07', dollars: String(sevenDaysPay) }],
    });
    expect(forfeitureCeilingIssues(equal)).toEqual([]);
  });

  it('fires when a 2026-dated N04 forfeiture exceeds the half-month ceiling, silent when equal', () => {
    const ceiling = forfeitureCeiling({ payGrade: 'E2', yearsOfService: 3 });
    expect(ceiling).not.toBeNull();
    const halfMonthPay = ceiling!.halfMonthPay;

    const over = baseForm({
      punishmentDate: '2026-01-01',
      accusedPayGrade: 'E2',
      accusedYearsOfService: '3',
      punishments: [{ code: 'N04', dollarsPerMonth: String(halfMonthPay + 1), months: '2' }],
    });
    const overIssues = forfeitureCeilingIssues(over);
    expect(overIssues).toHaveLength(1);
    expect(findIssue(overIssues, 'navmc10132-v20-forfeiture-over-ceiling').severity).toBe('fail');

    const equal = baseForm({
      punishmentDate: '2026-01-01',
      accusedPayGrade: 'E2',
      accusedYearsOfService: '3',
      punishments: [{ code: 'N04', dollarsPerMonth: String(halfMonthPay), months: '2' }],
    });
    expect(forfeitureCeilingIssues(equal)).toEqual([]);
  });

  it('uses forfeitureBasisGrade over accusedPayGrade when both are set (MCM 5.c(8))', () => {
    const e2Ceiling = forfeitureCeiling({ payGrade: 'E2', yearsOfService: 3 });
    const e5Ceiling = forfeitureCeiling({ payGrade: 'E5', yearsOfService: 3 });
    expect(e2Ceiling).not.toBeNull();
    expect(e5Ceiling).not.toBeNull();
    // Fixture sanity check: the two grades must actually have different
    // ceilings, or this test would not distinguish which one was used.
    expect(e2Ceiling!.sevenDaysPay).not.toBe(e5Ceiling!.sevenDaysPay);

    const form = baseForm({
      punishmentDate: '2026-01-01',
      accusedPayGrade: 'E5',
      forfeitureBasisGrade: 'E2',
      accusedYearsOfService: '3',
      punishments: [{ code: 'N07', dollars: String(e2Ceiling!.sevenDaysPay + 1) }],
    });
    const issues = forfeitureCeilingIssues(form);
    expect(issues).toHaveLength(1);
    const found = findIssue(issues, 'navmc10132-v20-forfeiture-over-ceiling');
    expect(found.rule).toContain(`ceiling at E2 is $${e2Ceiling!.sevenDaysPay}`);
    expect(found.rule).not.toContain('ceiling at E5');
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
