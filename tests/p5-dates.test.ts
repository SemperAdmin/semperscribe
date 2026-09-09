/**
 * P5 date-handling regressions (remediation 2026-09).
 *
 * P5-2  ISO strings parsed through new Date('YYYY-MM-DD') are UTC midnight and
 *       print one day early west of Greenwich. The vitest run is pinned to
 *       America/Los_Angeles (vitest.config.ts test.env) so the bug is
 *       reproducible in CI; the first test asserts the pin took effect.
 * P5-4  addMonths rolled 31 Aug + 6 months into 3 Mar; NAVMC 2795 para 2001.2.a
 *       ("no more than 6 months") needs 28 Feb.
 * P5-9  Rolled dates (31 Feb, 0 Jan) were accepted as real dates.
 * P5-10 Day counts across spring DST lost a day.
 * P5-11 Two-decimal JEPES marks ("4.50") drew no band.
 */

import { describe, it, expect } from 'vitest';
import { parseAndFormatDate, formatBusinessDate } from '@/lib/date-utils';
import { formatCancellationDate } from '@/lib/naval-format-utils';
import { addMonths, computedNextSessionDate, jepesBand, jepesMarkValue, parseNavalDate, toNavalDate } from '@/lib/counseling';
import { parseDateLoose } from '@/lib/navmc10922-utils';
import { runNavmc10922Validators } from '@/lib/navmc10922-validators';
import { baseline, NOW } from './navmc10922-cases';
import type { FormData } from '@/types';

describe('test environment', () => {
  it('runs west of Greenwich so a UTC-midnight parse is observable', () => {
    expect(process.env.TZ).toBe('America/Los_Angeles');
    expect(new Date('2024-01-15').getDate()).toBe(14);
  });
});

describe('P5-2 ISO dates parse as local calendar dates', () => {
  it('parseAndFormatDate keeps the calendar day', () => {
    expect(parseAndFormatDate('2024-01-15')).toBe('15 Jan 24');
    expect(parseAndFormatDate('2026-07-01')).toBe('1 Jul 26');
    expect(parseAndFormatDate('2026-01-01')).toBe('1 Jan 26');
  });

  it('formatCancellationDate keeps the month at a month boundary', () => {
    expect(formatCancellationDate('2026-07-01')).toBe('Jul 2026');
    expect(formatCancellationDate('2026-01-01')).toBe('Jan 2026');
    expect(formatCancellationDate('2025-06-15')).toBe('Jun 2025');
  });
});

describe('P5-4 addMonths clamps to the last day of the target month', () => {
  const form = (overrides: Partial<FormData> = {}): FormData => ({
    documentType: 'counseling',
    date: '31 Aug 26',
    counselingOccasion: 'follow-on',
    counselingMarineGrade: 'E-5',
    counselingMarineComponent: 'active',
    ...overrides,
  } as FormData);

  it('31 Aug + 6 months is the last day of February', () => {
    expect(computedNextSessionDate(form())).toBe('28 Feb 27');
    expect(computedNextSessionDate(form({ date: '31 Aug 27' }))).toBe('29 Feb 28');
    expect(computedNextSessionDate(form({ date: '31 Oct 26' }))).toBe('30 Apr 27');
  });

  it('reserve lance corporal 30 Nov + 3 months is 28 Feb', () => {
    expect(computedNextSessionDate(form({ date: '30 Nov 26', counselingMarineGrade: 'E-3', counselingMarineComponent: 'reserve' }))).toBe('28 Feb 27');
  });

  it('the 30-day rule still counts days, not months', () => {
    expect(computedNextSessionDate(form({ date: '1 Mar 26', counselingMarineGrade: 'E-3', counselingOccasion: 'thirty-day' }))).toBe('31 Mar 26');
  });

  it('addMonths leaves an in-range day alone and clamps an out-of-range one', () => {
    expect(toNavalDate(addMonths(new Date(2026, 7, 15), 6))).toBe('15 Feb 27');
    expect(toNavalDate(addMonths(new Date(2026, 0, 31), 1))).toBe('28 Feb 26');
    expect(toNavalDate(addMonths(new Date(2026, 11, 31), 2))).toBe('28 Feb 27');
  });
});

describe('P5-9 rolled dates are rejected', () => {
  it('parseNavalDate returns null for a day the month does not have', () => {
    expect(parseNavalDate('31 Feb 26')).toBeNull();
    expect(parseNavalDate('0 Jan 26')).toBeNull();
    expect(parseNavalDate('2026-02-31')).toBeNull();
    expect(parseNavalDate('2026-00-10')).toBeNull();
    expect(parseNavalDate('29 Feb 28')).not.toBeNull();
    expect(parseNavalDate('28 Feb 26')).not.toBeNull();
  });

  it('formatBusinessDate returns a rolled date unchanged', () => {
    expect(formatBusinessDate('31 Feb 26')).toBe('31 Feb 26');
    expect(formatBusinessDate('2026-02-31')).toBe('2026-02-31');
    expect(formatBusinessDate('28 Feb 26')).toBe('February 28, 2026');
    expect(formatBusinessDate('2026-02-28')).toBe('February 28, 2026');
  });

  it('parseDateLoose returns null for a rolled ISO date', () => {
    expect(parseDateLoose('2026-02-31')).toBeNull();
    expect(parseDateLoose('2026-13-01')).toBeNull();
    expect(parseDateLoose('2026-02-28')!.getDate()).toBe(28);
  });
});

describe('P5-10 the 10922 30-day clock counts calendar days across DST', () => {
  it('flags 2026-03-07 to 2026-04-07 as 31 days', () => {
    const data = baseline();
    data.lifeEventDate = '2026-03-07';
    data.dateOfApplication = '2026-04-07';
    const hit = runNavmc10922Validators(data, NOW).find((i) => i.id === 'navmc10922-30-day');
    expect(hit).toBeDefined();
    expect(hit!.rule).toContain('31 days');
  });

  it('does not flag exactly 30 days across the DST change', () => {
    const data = baseline();
    data.lifeEventDate = '2026-03-07';
    data.dateOfApplication = '2026-04-06';
    expect(runNavmc10922Validators(data, NOW).find((i) => i.id === 'navmc10922-30-day')).toBeUndefined();
  });
});

describe('P5-11 two-decimal JEPES marks band', () => {
  it('bands 4.50 and 2.50 and keeps 5.01 out of range', () => {
    expect(jepesBand('4.50')?.id).toBe('exceptional');
    expect(jepesBand('2.50')?.id).toBe('meets');
    expect(jepesBand('3.04')?.id).toBe('meets');
    expect(jepesBand('3.06')?.id).toBe('exceeds');
    expect(jepesBand('5.01')).toBeNull();
    expect(jepesBand('5.00')?.id).toBe('exceptional');
    expect(jepesMarkValue('4.50')).toBe(4.5);
    expect(jepesMarkValue('4.501')).toBeNull();
  });
});
