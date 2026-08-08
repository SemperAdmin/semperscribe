/**
 * Best-effort citation parsing for NLDP 1.1 references. The contract:
 * an unparseable reference yields { parsed: false, cited: null } and
 * never a guess — a wrong citation becomes a false authority edge
 * downstream, which is worse than none.
 */
import { describe, it, expect } from 'vitest';
import { parseCitedIssuance } from '@/lib/nldp-citations';

describe('parseCitedIssuance: confident matches', () => {
  it('parses an MCO with revision suffix, periods intact', () => {
    expect(parseCitedIssuance('MCO 5215.1K')).toEqual({
      parsed: true,
      cited: { docType: 'MCO', number: '5215.1K' },
    });
  });

  it('parses a publication-marked MCO (P prefix)', () => {
    expect(parseCitedIssuance('MCO P5060.20')).toEqual({
      parsed: true,
      cited: { docType: 'MCO', number: 'P5060.20' },
    });
  });

  it('parses a change package as edition', () => {
    expect(parseCitedIssuance('MCO 1200.17E w/CH-2')).toEqual({
      parsed: true,
      cited: { docType: 'MCO', number: '1200.17E', edition: 'CH-2' },
    });
  });

  it('parses a MARADMIN with a 2-digit year expanded', () => {
    expect(parseCitedIssuance('MARADMIN 341/26')).toEqual({
      parsed: true,
      cited: { docType: 'MARADMIN', number: '341', year: '2026' },
    });
  });

  it('parses SECNAVINST and DoD issuances case-insensitively, reporting canonical spelling', () => {
    expect(parseCitedIssuance('SECNAVINST 5216.5E')).toEqual({
      parsed: true,
      cited: { docType: 'SECNAVINST', number: '5216.5E' },
    });
    expect(parseCitedIssuance('DoDI 1000.13')).toEqual({
      parsed: true,
      cited: { docType: 'DODI', number: '1000.13' },
    });
  });

  it('strips a leading reference label', () => {
    expect(parseCitedIssuance('(a) MCO 5215.1K')).toEqual({
      parsed: true,
      cited: { docType: 'MCO', number: '5215.1K' },
    });
  });

  it('accepts a trailing title after the number', () => {
    expect(parseCitedIssuance('MCO 1553.1B, Marine Corps Training and Education')).toEqual({
      parsed: true,
      cited: { docType: 'MCO', number: '1553.1B' },
    });
  });
});

describe('parseCitedIssuance: never guesses', () => {
  const unparseable = [
    '',
    '   ',
    'Verbal guidance from CO, 12 Aug conference',
    'SAMPLE-REF-1, Fictional Training and Readiness Manual (sample data only)',
    'The Commandant’s Planning Guidance',
    'MCO',                      // series token with no number
    'MCO five-two-one-five',    // no printed number
    'Marine Corps Manual',      // prose containing no anchored token
    'Ref maintenance SOP dated 3 Jan',
  ];

  for (const text of unparseable) {
    it(`yields parsed:false, cited:null for ${JSON.stringify(text)}`, () => {
      expect(parseCitedIssuance(text)).toEqual({ parsed: false, cited: null });
    });
  }

  it('does not parse a series token buried mid-sentence', () => {
    // Anchored matching: the token must lead the reference text.
    expect(parseCitedIssuance('Superseded in part by MCO 5215.1K')).toEqual({
      parsed: false,
      cited: null,
    });
  });
});
