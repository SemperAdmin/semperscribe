// Vitest suite for src/lib/njp-suspension-period.ts (addMonths, addDays,
// suspensionPeriods, suspensionPeriodFindings, vacationDeadlines) and the
// V-22 validator in src/lib/navmc10132-validators-punishment.ts
// (suspensionPeriodIssues) that consumes it.
//
// Controlling authority, MCM Part V para 6.a, verbatim:
//   (1) An executed punishment of reduction or forfeiture of pay may be
//       suspended only within a period of 4 months after the date of
//       execution.
//   (2) Suspension of a punishment may not be for a period longer than 6
//       months from the date of the suspension, and the expiration of the
//       current enlistment or term of service of the Servicemember involved
//       automatically terminates the period of suspension.
//   (3) Unless the suspension is sooner vacated, suspended portions of the
//       punishment are remitted, without further action, upon the
//       termination of the period of suspension.
//   (4) Unless otherwise stated, an action suspending a punishment includes
//       a condition that the Servicemember not violate any punitive article
//       of the code.

import { describe, it, expect } from 'vitest';
import type { FormData } from '@/types';
import type { ValidationIssue } from '@/lib/letter-validators';
import { createEmptyNavmc10132Data } from '@/types/navmc';

import {
  addMonths,
  addDays,
  suspensionPeriods,
  suspensionPeriodFindings,
  vacationDeadlines,
  SUSPENSION_MAX_MONTHS,
} from '@/lib/njp-suspension-period';

import { suspensionPeriodIssues, punishmentIssues } from '@/lib/navmc10132-validators-punishment';

import { getExportBlockers } from '@/lib/letter-validators';

// ---------------------------------------------------------------------------
// Fixture helpers, matching the style in tests/navmc10132-basic-pay.test.ts
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

// ---------------------------------------------------------------------------
// addMonths
// ---------------------------------------------------------------------------

describe('addMonths', () => {
  it('adds calendar months, not 30-day blocks', () => {
    expect(addMonths('2026-08-20', 6)).toBe('2027-02-20');
  });

  it('a suspension imposed on the 31st cannot end on a 31st that does not exist, and must not roll forward into March', () => {
    expect(addMonths('2026-08-31', 6)).toBe('2027-02-28');
  });

  it('clamps to 28 Feb in a non-leap year', () => {
    expect(addMonths('2024-08-29', 6)).toBe('2025-02-28');
  });

  it('clamps to 29 Feb in a leap year', () => {
    expect(addMonths('2023-08-29', 6)).toBe('2024-02-29');
  });

  it('rolls the year over and still clamps to the shorter month', () => {
    expect(addMonths('2025-12-31', 2)).toBe('2026-02-28');
  });

  it('plus zero months returns the same date', () => {
    expect(addMonths('2026-08-20', 0)).toBe('2026-08-20');
  });

  it('returns null for unreadable input', () => {
    expect(addMonths('', 6)).toBeNull();
    expect(addMonths('2026-13-01', 6)).toBeNull();
    expect(addMonths('2026-02-30', 6)).toBeNull();
    expect(addMonths('garbage', 6)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// addDays
// ---------------------------------------------------------------------------

describe('addDays', () => {
  it('adds a whole number of days', () => {
    expect(addDays('2026-08-20', 45)).toBe('2026-10-04');
  });

  it('crosses a month boundary within the same year', () => {
    expect(addDays('2026-01-15', 20)).toBe('2026-02-04');
  });

  it('crosses a year boundary', () => {
    expect(addDays('2026-12-20', 15)).toBe('2027-01-04');
  });

  it('returns null for unreadable input', () => {
    expect(addDays('', 45)).toBeNull();
    expect(addDays('2026-13-01', 45)).toBeNull();
    expect(addDays('2026-02-30', 45)).toBeNull();
    expect(addDays('garbage', 45)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// suspensionPeriods
// ---------------------------------------------------------------------------

describe('suspensionPeriods', () => {
  it('computes endsOn and a readable stated string for a months-stated suspension', () => {
    const form = baseForm({
      punishmentDate: '2026-08-20',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '3' }],
    });
    const [period] = suspensionPeriods(form);
    expect(period.endsOn).toBe(addMonths('2026-08-20', 3));
    expect(period.stated).toBe('3 months');
  });

  it('computes endsOn and a readable stated string for a days-stated suspension', () => {
    const form = baseForm({
      punishmentDate: '2026-08-20',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, days: '45' }],
    });
    const [period] = suspensionPeriods(form);
    expect(period.endsOn).toBe(addDays('2026-08-20', 45));
    expect(period.stated).toBe('45 days');
  });

  it('uses the singular for exactly 1 month or 1 day', () => {
    const monthsForm = baseForm({
      punishmentDate: '2026-08-20',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '1' }],
    });
    expect(suspensionPeriods(monthsForm)[0].stated).toBe('1 month');

    const daysForm = baseForm({
      punishmentDate: '2026-08-20',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, days: '1' }],
    });
    expect(suspensionPeriods(daysForm)[0].stated).toBe('1 day');
  });

  it('latestLawfulEnd is always the item 6 date plus 6 months, regardless of the stated period', () => {
    const form = baseForm({
      punishmentDate: '2026-01-15',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '2' }],
    });
    const [period] = suspensionPeriods(form);
    expect(period.latestLawfulEnd).toBe(addMonths('2026-01-15', SUSPENSION_MAX_MONTHS));
  });

  it('exceedsSixMonths is false at exactly 6 months: 6.a(2) forbids longer than 6 months, not 6 months itself', () => {
    const form = baseForm({
      punishmentDate: '2026-08-20',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '6' }],
    });
    const [period] = suspensionPeriods(form);
    expect(period.endsOn).toBe(period.latestLawfulEnd);
    expect(period.exceedsSixMonths).toBe(false);
  });

  it('exceedsSixMonths is true at 7 months', () => {
    const form = baseForm({
      punishmentDate: '2026-01-15',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '7' }],
    });
    const [period] = suspensionPeriods(form);
    expect(period.exceedsSixMonths).toBe(true);
  });

  it('exceedsSixMonths is true for a day count that lands past the six-month date', () => {
    const njpDate = '2026-01-15';
    const days = 200;
    const expectedEndsOn = addDays(njpDate, days);
    const expectedLatest = addMonths(njpDate, SUSPENSION_MAX_MONTHS);
    // Sanity: the day count must actually land past the cap for this test to
    // mean anything.
    expect(expectedEndsOn).not.toBeNull();
    expect(expectedLatest).not.toBeNull();
    expect((expectedEndsOn as string) > (expectedLatest as string)).toBe(true);

    const form = baseForm({
      punishmentDate: njpDate,
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, days: String(days) }],
    });
    const [period] = suspensionPeriods(form);
    expect(period.endsOn).toBe(expectedEndsOn);
    expect(period.exceedsSixMonths).toBe(true);
  });

  it('resolves code from the punishment the suspension points at', () => {
    const form = baseForm({
      punishmentDate: '2026-08-20',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '3' }],
    });
    const [period] = suspensionPeriods(form);
    expect(period.code).toBe('N09');
  });

  it('does not throw on a dangling punishmentIndex, and yields an empty code', () => {
    const form = baseForm({
      punishmentDate: '2026-08-20',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 5, months: '3' }],
    });
    expect(() => suspensionPeriods(form)).not.toThrow();
    const [period] = suspensionPeriods(form);
    expect(period.code).toBe('');
  });

  it('an unreadable or empty period yields endsOn: null and exceedsSixMonths: false, never a false accusation from missing data', () => {
    const emptyForm = baseForm({
      punishmentDate: '2026-08-20',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0 }],
    });
    const [emptyPeriod] = suspensionPeriods(emptyForm);
    expect(emptyPeriod.endsOn).toBeNull();
    expect(emptyPeriod.exceedsSixMonths).toBe(false);

    const unreadableForm = baseForm({
      punishmentDate: '2026-08-20',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: 'abc' }],
    });
    const [unreadablePeriod] = suspensionPeriods(unreadableForm);
    expect(unreadablePeriod.endsOn).toBeNull();
    expect(unreadablePeriod.exceedsSixMonths).toBe(false);
  });

  it('an unreadable item 6 punishment date yields endsOn: null and latestLawfulEnd: null', () => {
    const form = baseForm({
      punishmentDate: 'garbage',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '3' }],
    });
    const [period] = suspensionPeriods(form);
    expect(period.endsOn).toBeNull();
    expect(period.latestLawfulEnd).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// suspensionPeriodFindings
// ---------------------------------------------------------------------------

describe('suspensionPeriodFindings', () => {
  it('returns only the over-limit suspensions, naming the end date, stated period, and latest lawful end', () => {
    const njpDate = '2026-01-15';
    const form = baseForm({
      punishmentDate: njpDate,
      punishments: [
        { code: 'N09', days: '14' },
        { code: 'N07', dollars: '50' },
      ],
      suspensions: [
        { punishmentIndex: 0, months: '6' }, // within the cap
        { punishmentIndex: 1, months: '7' }, // over the cap
      ],
    });
    const findings = suspensionPeriodFindings(form);
    expect(findings).toHaveLength(1);

    const expectedEndsOn = addMonths(njpDate, 7);
    const expectedLatest = addMonths(njpDate, SUSPENSION_MAX_MONTHS);
    const [finding] = findings;
    expect(finding.rule).toContain(expectedEndsOn as string);
    expect(finding.detail).toContain('7 months');
    expect(finding.detail).toContain(expectedEndsOn as string);
    expect(finding.detail).toContain(expectedLatest as string);
  });

  it('is empty when every suspension is within the cap', () => {
    const form = baseForm({
      punishmentDate: '2026-01-15',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '6' }],
    });
    expect(suspensionPeriodFindings(form)).toEqual([]);
  });

  it('is empty when there are no suspensions', () => {
    const form = baseForm({
      punishmentDate: '2026-01-15',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [],
    });
    expect(suspensionPeriodFindings(form)).toEqual([]);
  });

  it('is empty when the punishment date is unreadable', () => {
    const form = baseForm({
      punishmentDate: '',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '7' }],
    });
    expect(suspensionPeriodFindings(form)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// vacationDeadlines
// ---------------------------------------------------------------------------

describe('vacationDeadlines', () => {
  it('produces one entry per suspension with a computable end date, carrying endsOn', () => {
    const njpDate = '2026-01-15';
    const form = baseForm({
      punishmentDate: njpDate,
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '3' }],
    });
    const deadlines = vacationDeadlines(form);
    expect(deadlines).toHaveLength(1);
    expect(deadlines[0].endsOn).toBe(addMonths(njpDate, 3));
  });

  it('every caveat names both the automatic remission of 6.a(3) and the EAS limitation the app cannot check, because the computed date is conditional on an enlistment the form does not record', () => {
    const form = baseForm({
      punishmentDate: '2026-01-15',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '3' }],
    });
    const [deadline] = vacationDeadlines(form);
    expect(deadline.caveat).toContain('6.a(3)');
    expect(deadline.caveat.toLowerCase()).toContain('eas');
  });

  it('excludes suspensions with no computable end date', () => {
    const form = baseForm({
      punishmentDate: '2026-01-15',
      punishments: [
        { code: 'N09', days: '14' },
        { code: 'N07', dollars: '50' },
      ],
      suspensions: [
        { punishmentIndex: 0, months: '3' }, // computable
        { punishmentIndex: 1 }, // no period stated at all
      ],
    });
    const deadlines = vacationDeadlines(form);
    expect(deadlines).toHaveLength(1);
    expect(deadlines[0].punishmentIndex).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// suspensionPeriodIssues (V-22)
// ---------------------------------------------------------------------------

describe('suspensionPeriodIssues (V-22)', () => {
  it('reports a block-severity issue with an id starting navmc10132-v22-', () => {
    const form = baseForm({
      punishmentDate: '2026-01-15',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '7' }],
    });
    const issues = suspensionPeriodIssues(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('block');
    expect(issues[0].id.startsWith('navmc10132-v22-')).toBe(true);
  });

  it('surfaces through punishmentIssues, not just the leaf function', () => {
    const form = baseForm({
      punishmentDate: '2026-01-15',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '7' }],
    });
    const issues = punishmentIssues(form);
    findIssue(issues, 'navmc10132-v22-');
  });

  it('is silent when all suspensions are within the cap', () => {
    const form = baseForm({
      punishmentDate: '2026-01-15',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '6' }],
    });
    expect(suspensionPeriodIssues(form)).toEqual([]);
  });

  it("V-22 stops the export, not merely the compliance list: a 'fail' severity renders as Non-compliant and lets the export through", () => {
    // A 7-month suspension runs longer than MCM Part V para 6.a(2) allows.
    // getExportBlockers runs the FULL validator suite, so this fixture
    // trips other unrelated blockers too — assert on the presence of the
    // V-22 prefix, never on the array's length or emptiness.
    const blocking = baseForm({
      punishmentDate: '2026-01-15',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '7' }],
    });
    const blockingIssues = getExportBlockers(blocking, [], [], []);
    expect(blockingIssues.some((i) => i.id.startsWith('navmc10132-v22-'))).toBe(true);

    // Same fixture, but the suspension is exactly at the 6-month cap: no
    // V-22 issue.
    const compliant = baseForm({
      punishmentDate: '2026-01-15',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '6' }],
    });
    const compliantIssues = getExportBlockers(compliant, [], [], []);
    expect(compliantIssues.some((i) => i.id.startsWith('navmc10132-v22-'))).toBe(false);
  });
});
