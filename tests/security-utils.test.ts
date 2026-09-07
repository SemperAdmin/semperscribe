/**
 * scanForSensitiveData (P2-8): the pre-send and export scans share it.
 */
import { describe, it, expect } from 'vitest';
import { scanForSensitiveData, SECURITY_PATTERNS } from '@/lib/security-utils';

const pii = (text: string) => scanForSensitiveData({ text }).piiMatches;

describe('SSN detection', () => {
  it('reports a separated SSN with the established label', () => {
    expect(pii('SSN 123-45-6789 on file')).toEqual(['Possible SSN detected']);
    expect(pii('SSN 123 45 6789 on file')).toEqual(['Possible SSN detected']);
  });

  it('P2-8: reports an unseparated nine-digit number with a distinct lower-confidence label', () => {
    const matches = pii('SSN 123456789 on file');
    expect(matches).toContain('Possible SSN (nine digits, unseparated)');
    expect(matches).not.toContain('Possible SSN detected');
    expect(scanForSensitiveData({ text: '123456789' }).hasPII).toBe(true);
  });

  it('P2-8: does not report nine digits inside a longer digit run', () => {
    expect(pii('order 12345678901234')).toEqual([]);
    expect(pii('ref 1234567890123')).toEqual([]);
  });

  it('P2-8: a ten-digit EDIPI reports as EDIPI only, never as a nine-digit SSN', () => {
    expect(pii('EDIPI 1234567890')).toEqual(['Possible EDIPI detected']);
  });

  it('P2-8: eight digits never report', () => {
    expect(pii('12345678')).toEqual([]);
  });

  it('P2-8: both labels report when both forms are present', () => {
    const matches = pii('123-45-6789 and 987654321');
    expect(matches).toContain('Possible SSN detected');
    expect(matches).toContain('Possible SSN (nine digits, unseparated)');
  });

  it('exposes the unseparated pattern alongside the separated one', () => {
    expect(SECURITY_PATTERNS.SSN_UNSEPARATED).toBeInstanceOf(RegExp);
    expect(SECURITY_PATTERNS.SSN_UNSEPARATED.test('123456789')).toBe(true);
    expect(SECURITY_PATTERNS.SSN_UNSEPARATED.test('1234567890')).toBe(false);
    expect(SECURITY_PATTERNS.SSN_UNSEPARATED.test('x123456789')).toBe(true);
  });
});

describe('PHI keywords', () => {
  it('reports each keyword once, case-insensitively', () => {
    const result = scanForSensitiveData({ a: 'Medical', b: 'medical treatment' });
    expect(result.hasPHI).toBe(true);
    expect(result.phiMatches).toEqual(['medical', 'treatment']);
  });
});
