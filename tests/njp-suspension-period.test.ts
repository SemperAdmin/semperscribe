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
  suspensionAssumptionsCaveat,
  SUSPENSION_MAX_MONTHS,
  SUSPENSION_ASSUMPTIONS,
} from '@/lib/njp-suspension-period';

import {
  suspensionPeriodIssues,
  suspensionInterruptionAssumptionIssues,
  punishmentIssues,
} from '@/lib/navmc10132-validators-punishment';

import { vacationHandoff } from '@/lib/njp-vacation-handoff';

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
  it('computes endsOnIfUninterrupted and a readable stated string for a months-stated suspension', () => {
    const form = baseForm({
      punishmentDate: '2026-08-20',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '3' }],
    });
    const [period] = suspensionPeriods(form);
    expect(period.endsOnIfUninterrupted).toBe(addMonths('2026-08-20', 3));
    expect(period.stated).toBe('3 months');
  });

  it('computes endsOnIfUninterrupted and a readable stated string for a days-stated suspension', () => {
    const form = baseForm({
      punishmentDate: '2026-08-20',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, days: '45' }],
    });
    const [period] = suspensionPeriods(form);
    expect(period.endsOnIfUninterrupted).toBe(addDays('2026-08-20', 45));
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
    expect(period.endsOnIfUninterrupted).toBe(period.latestLawfulEnd);
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
    expect(period.endsOnIfUninterrupted).toBe(expectedEndsOn);
    expect(period.exceedsSixMonths).toBe(true);
  });

  it('carries suspensionIndex as its own position in item 7, distinct from punishmentIndex, even when two suspensions target the same punishment', () => {
    const form = baseForm({
      punishmentDate: '2026-08-20',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [
        { punishmentIndex: 0, months: '3' },
        { punishmentIndex: 0, months: '5' },
      ],
    });
    const [first, second] = suspensionPeriods(form);
    expect(first.suspensionIndex).toBe(0);
    expect(second.suspensionIndex).toBe(1);
    expect(first.punishmentIndex).toBe(0);
    expect(second.punishmentIndex).toBe(0);
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

  it('an unreadable or empty period yields endsOnIfUninterrupted: null and exceedsSixMonths: false, never a false accusation from missing data', () => {
    const emptyForm = baseForm({
      punishmentDate: '2026-08-20',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0 }],
    });
    const [emptyPeriod] = suspensionPeriods(emptyForm);
    expect(emptyPeriod.endsOnIfUninterrupted).toBeNull();
    expect(emptyPeriod.exceedsSixMonths).toBe(false);

    const unreadableForm = baseForm({
      punishmentDate: '2026-08-20',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: 'abc' }],
    });
    const [unreadablePeriod] = suspensionPeriods(unreadableForm);
    expect(unreadablePeriod.endsOnIfUninterrupted).toBeNull();
    expect(unreadablePeriod.exceedsSixMonths).toBe(false);
  });

  it('an unreadable item 6 punishment date yields endsOnIfUninterrupted: null and latestLawfulEnd: null', () => {
    const form = baseForm({
      punishmentDate: 'garbage',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '3' }],
    });
    const [period] = suspensionPeriods(form);
    expect(period.endsOnIfUninterrupted).toBeNull();
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

  it('gives two over-limit suspensions against the SAME punishmentIndex DIFFERENT ids, because the id is keyed on suspensionIndex not punishmentIndex', () => {
    // Nothing forbids two item-7 suspensions from naming the same
    // punishmentIndex. Before the id was keyed on suspensionIndex, both
    // findings below would have produced the identical id
    // "suspension-over-six-months-0", and downstream the identical
    // ValidationIssue id "navmc10132-v22-suspension-over-six-months-0" —
    // which components render with `key={issue.id}`, silently dropping one
    // from the screen. Assert DISTINCTNESS, not the literal strings, so a
    // future rewording of the id format does not break this test.
    const form = baseForm({
      punishmentDate: '2026-01-15',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [
        { punishmentIndex: 0, months: '7' }, // over the cap
        { punishmentIndex: 0, months: '9' }, // also over the cap, same punishment
      ],
    });
    const findings = suspensionPeriodFindings(form);
    expect(findings).toHaveLength(2);
    expect(findings[0].id).not.toBe(findings[1].id);
  });
});

// ---------------------------------------------------------------------------
// vacationDeadlines
// ---------------------------------------------------------------------------

describe('vacationDeadlines', () => {
  it('produces one entry per suspension with a computable end date, carrying endsOnIfUninterrupted', () => {
    const njpDate = '2026-01-15';
    const form = baseForm({
      punishmentDate: njpDate,
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '3' }],
    });
    const deadlines = vacationDeadlines(form);
    expect(deadlines).toHaveLength(1);
    expect(deadlines[0].endsOnIfUninterrupted).toBe(addMonths(njpDate, 3));
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

  it('gives two over-limit suspensions against the SAME punishmentIndex DIFFERENT ValidationIssue ids, the shape components actually key React lists on', () => {
    // ComplianceDialog.tsx and PackageDialog.tsx both render validation
    // lists with `key={issue.id}`. A duplicate id here is not cosmetic: it
    // is React silently dropping one of the two issues from the rendered
    // list. Assert distinctness, not the literal id strings.
    const form = baseForm({
      punishmentDate: '2026-01-15',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [
        { punishmentIndex: 0, months: '7' },
        { punishmentIndex: 0, months: '9' },
      ],
    });
    const issues = suspensionPeriodIssues(form);
    expect(issues).toHaveLength(2);
    expect(issues[0].id).not.toBe(issues[1].id);
  });
});

// ---------------------------------------------------------------------------
// SUSPENSION_ASSUMPTIONS and the caveat / assumptions the deadline carries
//
// THE CRUX: unauthorized absence and commencement of vacation proceedings
// (JAGMAN 0118.c) INTERRUPT the running of the period, so the real end date
// is LATER than computed. Expiration of the enlistment (MCM 6.a(2)) ends
// the period early, so the real end date is EARLIER than computed. A test
// merely asserting the words exist is worthless here: stating a lengthening
// condition as a shortening one (or vice versa) is exactly the failure this
// file exists to prevent, so every assertion below pins the DIRECTION, not
// just presence.
// ---------------------------------------------------------------------------

describe('SUSPENSION_ASSUMPTIONS', () => {
  it('names exactly the three conditions the governing sources name, no more and no fewer', () => {
    expect(SUSPENSION_ASSUMPTIONS.map((a) => a.id).sort()).toEqual(
      ['enlistment-expiration', 'unauthorized-absence', 'vacation-proceedings-commenced'].sort(),
    );
  });

  it('unauthorized absence is a LATER-pushing (interrupting) condition, cited to JAGMAN 0118.c', () => {
    const a = SUSPENSION_ASSUMPTIONS.find((x) => x.id === 'unauthorized-absence');
    expect(a).toBeDefined();
    expect(a?.direction).toBe('later');
    expect(a?.citation).toContain('0118.c');
  });

  it('commencement of vacation proceedings is a LATER-pushing (interrupting) condition, cited to JAGMAN 0118.c', () => {
    const a = SUSPENSION_ASSUMPTIONS.find((x) => x.id === 'vacation-proceedings-commenced');
    expect(a).toBeDefined();
    expect(a?.direction).toBe('later');
    expect(a?.citation).toContain('0118.c');
  });

  it('enlistment expiration is an EARLIER-pushing (terminating) condition, cited to MCM 6.a(2), the OPPOSITE direction of the other two', () => {
    const a = SUSPENSION_ASSUMPTIONS.find((x) => x.id === 'enlistment-expiration');
    expect(a).toBeDefined();
    expect(a?.direction).toBe('earlier');
    expect(a?.citation).toContain('6.a(2)');
  });

  it('no assumption is worded as "no earlier than" or "at least", which would be wrong for the earlier-pushing condition', () => {
    for (const a of SUSPENSION_ASSUMPTIONS) {
      expect(a.effect.toLowerCase()).not.toContain('no earlier than');
      expect(a.effect.toLowerCase()).not.toContain('at least');
    }
  });
});

describe('suspensionAssumptionsCaveat', () => {
  it('states each condition with its correct direction word, not merely its name', () => {
    const caveat = suspensionAssumptionsCaveat('2026-07-20');
    // The two interrupting conditions must read as pushing the date LATER.
    expect(caveat).toMatch(/interrupt[a-z]*.*LATER/i);
    // The terminating condition must read as pushing the date EARLIER.
    expect(caveat).toMatch(/terminat[a-z]*.*EARLIER/i);
  });

  it('does not call the computed date a floor or a ceiling, and does not say "no earlier than"', () => {
    const caveat = suspensionAssumptionsCaveat('2026-07-20').toLowerCase();
    expect(caveat).not.toContain('floor');
    expect(caveat).not.toContain('no earlier than');
    expect(caveat).not.toContain('at least');
  });
});

describe('vacationDeadlines: assumptions', () => {
  it('carries all three assumptions, with directions intact, on every deadline', () => {
    const form = baseForm({
      punishmentDate: '2026-01-15',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '3' }],
    });
    const [deadline] = vacationDeadlines(form);
    expect(deadline.assumptions).toHaveLength(3);

    const byId = Object.fromEntries(deadline.assumptions.map((a) => [a.id, a.direction]));
    expect(byId['unauthorized-absence']).toBe('later');
    expect(byId['vacation-proceedings-commenced']).toBe('later');
    expect(byId['enlistment-expiration']).toBe('earlier');
  });

  it('the rendered caveat and the structured assumptions agree, because the caveat is built from the same list', () => {
    const form = baseForm({
      punishmentDate: '2026-01-15',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '3' }],
    });
    const [deadline] = vacationDeadlines(form);
    for (const a of deadline.assumptions) {
      expect(deadline.caveat).toContain(a.citation);
    }
  });
});

// ---------------------------------------------------------------------------
// W-17: the computed end date is conditional, not a floor
// ---------------------------------------------------------------------------

describe('suspensionInterruptionAssumptionIssues (W-17)', () => {
  it('fires with warn severity when a suspension with a computed end date exists', () => {
    const form = baseForm({
      punishmentDate: '2026-01-15',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '3' }],
    });
    const issues = suspensionInterruptionAssumptionIssues(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('warn');
    expect(issues[0].id.startsWith('navmc10132-w17-')).toBe(true);
  });

  it('names all three conditions, with the two interrupting ones read as later and the enlistment one read as earlier', () => {
    const form = baseForm({
      punishmentDate: '2026-01-15',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '3' }],
    });
    const [issue] = suspensionInterruptionAssumptionIssues(form);
    expect(issue.citation).toContain('0118.c');
    expect(issue.citation).toContain('6.a(2)');
    expect(issue.detail).toMatch(/interrupt[a-z]*.*LATER/i);
    expect(issue.detail).toMatch(/terminat[a-z]*.*EARLIER/i);
    expect(issue.detail.toLowerCase()).toContain('unauthorized absence');
    expect(issue.detail.toLowerCase()).toContain('vacate');
    expect(issue.detail.toLowerCase()).toContain('enlistment');
  });

  it('is silent when item 7 carries no suspension at all', () => {
    const form = baseForm({
      punishmentDate: '2026-01-15',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [],
    });
    expect(suspensionInterruptionAssumptionIssues(form)).toEqual([]);
  });

  it('surfaces through punishmentIssues, not just the leaf function', () => {
    const form = baseForm({
      punishmentDate: '2026-01-15',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '3' }],
    });
    findIssue(punishmentIssues(form), 'navmc10132-w17-');
  });

  it('is NOT in getExportBlockers output: warn is advisory and must not gate the export', () => {
    // months: 3 is well within the six-month cap, so this fixture trips
    // W-17 (a computed date exists) without also tripping V-22 (the cap),
    // isolating W-17's non-blocking behaviour from V-22's blocking one.
    const form = baseForm({
      punishmentDate: '2026-01-15',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '3' }],
    });

    // Confirm through the leaf function that W-17 actually fired for this
    // fixture, so the absence check below is meaningful and not vacuous.
    expect(suspensionInterruptionAssumptionIssues(form)).toHaveLength(1);

    // The only proof that matters: getExportBlockers, the real gate.
    const blockers = getExportBlockers(form, [], [], []);
    expect(blockers.some((i) => i.id.startsWith('navmc10132-w17-'))).toBe(false);
  });

  it('gives two suspensions against the SAME punishmentIndex DIFFERENT ids, the shape components actually key React lists on', () => {
    // Same failure class as V-22's equivalent test above: ComplianceDialog
    // and PackageDialog render validation lists with `key={issue.id}`, so a
    // duplicate id here would drop one of the two warnings off the screen.
    // Both suspensions here are well within the six-month cap, so this
    // isolates W-17's own id uniqueness from V-22.
    const form = baseForm({
      punishmentDate: '2026-01-15',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [
        { punishmentIndex: 0, months: '3' },
        { punishmentIndex: 0, months: '4' },
      ],
    });
    const issues = suspensionInterruptionAssumptionIssues(form);
    expect(issues).toHaveLength(2);
    expect(issues[0].id).not.toBe(issues[1].id);
  });
});

// ---------------------------------------------------------------------------
// The handoff message and vacationDeadlines agree by construction
// ---------------------------------------------------------------------------

describe('vacationHandoff deadline agrees with vacationDeadlines', () => {
  it('the handoff deadline text is built from the same VacationDeadline the module produces, not a re-authored sentence', () => {
    const form = baseForm({
      unit: '1st Marine Division',
      accusedName: 'RIVERA, DIEGO M',
      accusedRankGrade: 'LCpl, E3',
      accusedEdipi: '1234567890',
      punishmentDate: '2026-01-15',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '3' }],
    });

    const [deadline] = vacationDeadlines(form);
    const handoff = vacationHandoff(form, 0, { now: '2026-01-15', documentId: 'doc-1' });

    // Not two independent assertions of the same literal: the handoff
    // message must actually CONTAIN the deadline module's own caveat text,
    // proving it was built from it rather than duplicated by hand.
    expect(handoff.deadline).toContain(deadline.caveat);
    expect(handoff.deadline).toContain(deadline.endsOnIfUninterrupted);
  });

  it('falls back to an explicit "not readable" message when the suspension has no computable end date, rather than silently omitting the deadline', () => {
    const form = baseForm({
      unit: '1st Marine Division',
      accusedName: 'RIVERA, DIEGO M',
      accusedRankGrade: 'LCpl, E3',
      punishmentDate: '2026-01-15',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0 }], // no months or days stated
    });

    expect(vacationDeadlines(form)).toEqual([]);
    const handoff = vacationHandoff(form, 0, { now: '2026-01-15', documentId: 'doc-1' });
    expect(handoff.deadline).toContain('not readable');
  });

  it('picks the deadline for the specific suspension index requested, not merely the first suspension against the same punishmentIndex, when two item-7 suspensions name the same punishmentIndex with different periods', () => {
    // Nothing in the app forbids two suspensions from naming the same
    // punishmentIndex (suspensionIndexBoundsIssues checks bounds only, not
    // uniqueness), so this is valid input, not a malformed fixture. Before
    // vacationHandoff matched on suspensionIndex, it matched on
    // punishmentIndex and Array.prototype.find always returned the FIRST
    // vacationDeadlines entry for that punishment — so asking for the
    // SECOND suspension's deadline silently returned the FIRST suspension's
    // deadline instead. This test fails on that older matching logic.
    const njpDate = '2026-01-15';
    const form = baseForm({
      unit: '1st Marine Division',
      accusedName: 'RIVERA, DIEGO M',
      accusedRankGrade: 'LCpl, E3',
      punishmentDate: njpDate,
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [
        { punishmentIndex: 0, months: '3' }, // suspensionIndex 0
        { punishmentIndex: 0, months: '5' }, // suspensionIndex 1, SAME punishmentIndex
      ],
    });

    const deadlines = vacationDeadlines(form);
    expect(deadlines).toHaveLength(2);
    const [first, second] = deadlines;
    expect(first.punishmentIndex).toBe(0);
    expect(second.punishmentIndex).toBe(0);
    expect(first.suspensionIndex).toBe(0);
    expect(second.suspensionIndex).toBe(1);
    // Sanity: the two deadlines actually differ, or this test proves nothing.
    expect(first.endsOnIfUninterrupted).not.toBe(second.endsOnIfUninterrupted);

    const handoffForFirst = vacationHandoff(form, 0, { now: njpDate, documentId: 'doc-1' });
    expect(handoffForFirst.deadline).toContain(first.endsOnIfUninterrupted);
    expect(handoffForFirst.deadline).not.toContain(second.endsOnIfUninterrupted);

    const handoffForSecond = vacationHandoff(form, 1, { now: njpDate, documentId: 'doc-2' });
    expect(handoffForSecond.deadline).toContain(second.endsOnIfUninterrupted);
    expect(handoffForSecond.deadline).not.toContain(first.endsOnIfUninterrupted);
  });
});
