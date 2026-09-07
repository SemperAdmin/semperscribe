import { describe, it, expect } from 'vitest';
import { parseAndFormatDate, getTodaysDate } from '@/lib/date-utils';

describe('parseAndFormatDate', () => {
  describe('Naval format passthrough', () => {
    it('returns already-formatted naval dates unchanged', () => {
      expect(parseAndFormatDate('15 Jan 24')).toBe('15 Jan 24');
      expect(parseAndFormatDate('1 Dec 99')).toBe('1 Dec 99');
      expect(parseAndFormatDate('25 Mar 00')).toBe('25 Mar 00');
    });
  });

  describe('ISO date format (YYYY-MM-DD)', () => {
    it('converts ISO dates to naval format on the exact calendar day', () => {
      // Exact day: the old /\d{1,2} Jan 2[34]/ tolerated the one-day-early
      // UTC-midnight parse (P5-2). The test run is pinned to Los Angeles.
      expect(parseAndFormatDate('2024-01-15')).toBe('15 Jan 24');
      expect(parseAndFormatDate('2024-01-01')).toBe('1 Jan 24');
    });

    it('handles single-digit months and days', () => {
      expect(parseAndFormatDate('2024-03-05')).toBe('5 Mar 24');
      expect(parseAndFormatDate('2024-3-5')).toBe('5 Mar 24');
    });

    it('returns a rolled ISO date unchanged', () => {
      expect(parseAndFormatDate('2024-02-31')).toBe('2024-02-31');
    });
  });

  describe('YYYYMMDD format', () => {
    it('converts 8-digit date strings', () => {
      const result = parseAndFormatDate('20240115');
      expect(result).toBe('15 Jan 24');
    });

    it('handles December dates', () => {
      const result = parseAndFormatDate('20231225');
      expect(result).toBe('25 Dec 23');
    });
  });

  describe('MM/DD/YYYY format', () => {
    it('converts slash-separated dates', () => {
      const result = parseAndFormatDate('01/15/2024');
      expect(result).toBe('15 Jan 24');
    });

    it('handles single-digit month and day', () => {
      const result = parseAndFormatDate('3/5/2024');
      expect(result).toBe('5 Mar 24');
    });
  });

  describe('Edge cases', () => {
    it('returns original string for unparseable input', () => {
      expect(parseAndFormatDate('not a date')).toBe('not a date');
    });

    it('returns original string for empty string', () => {
      // Empty string behavior depends on Date.parse fallback
      const result = parseAndFormatDate('');
      expect(typeof result).toBe('string');
    });
  });
});

describe('getTodaysDate', () => {
  it('returns a date in naval format', () => {
    const result = getTodaysDate();
    expect(result).toMatch(/^\d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{2}$/);
  });

  it('returns today\'s date', () => {
    const today = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const expected = `${today.getDate()} ${months[today.getMonth()]} ${today.getFullYear().toString().slice(-2)}`;
    expect(getTodaysDate()).toBe(expected);
  });
});
