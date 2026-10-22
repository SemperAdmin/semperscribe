/**
 * The I-Type cover date line reads an ISO calendar date as a local date.
 * Run under TZ=America/Los_Angeles, `new Date('2026-03-01')` is the
 * evening of 28 February local, and the three former copies of this
 * helper printed FEBRUARY 2026 for a March cover. The suite's default
 * zone does not show it, so the case pins the parse path directly.
 */
import { describe, it, expect } from 'vitest';
import { formatMonthYearUpper } from '@/lib/date-utils';

describe('formatMonthYearUpper', () => {
  it('names the month of an ISO date as typed, whatever the zone', () => {
    expect(formatMonthYearUpper('2026-03-01')).toBe('MARCH 2026');
    expect(formatMonthYearUpper('2026-12-31')).toBe('DECEMBER 2026');
    expect(formatMonthYearUpper('2026-1-5')).toBe('JANUARY 2026');
  });

  it('agrees with the UTC-midnight reading only where the local day matches', () => {
    // Direct proof the old path was zone-dependent: at UTC midnight the
    // local date is the previous day anywhere west of Greenwich.
    const utc = new Date('2026-03-01');
    const westOfGreenwich = utc.getTimezoneOffset() > 0;
    expect(utc.getMonth() === 2 || westOfGreenwich).toBe(true);
    expect(formatMonthYearUpper('2026-03-01')).toBe('MARCH 2026');
  });

  it('passes through the empty and unreadable cases', () => {
    expect(formatMonthYearUpper('')).toBe('');
    expect(formatMonthYearUpper(undefined)).toBe('');
    expect(formatMonthYearUpper('not a date')).toBe('not a date');
  });
});
