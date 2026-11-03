import { describe, it, expect, beforeAll } from 'vitest';
import { UNITS } from '@/lib/units';
import { loadUnits } from '@/lib/reference-data';
import { resolveUnit, findUnit } from '@/hooks/useUserProfile';

const SEVENTH_COMM = [
  '7TH COMMUNICATION BATTALION',
  'III MARINE INFORMATION GROUP',
  'III MARINE EXPEDITIONARY FORCE FMF',
];

describe('unit letterhead overrides', () => {
  beforeAll(async () => { await loadUnits(); });

  it('7th Comm Bn carries the spelled-out letterhead and keeps its abbreviation for search', () => {
    const unit = UNITS.find(u => u.ruc === '21635');
    expect(unit?.unitName).toBe('7TH COMM BN MIG III MEF');
    expect(unit?.letterhead).toEqual(SEVENTH_COMM);
    expect(unit?.streetAddress).toBe('OPC 567 BOX 53');
    expect(`${unit?.cityState} ${unit?.zip}`).toBe('FPO AP 96384-9001');
  });

  it('resolveUnit (profile default unit, EDMS prefill) returns the letterhead lines', () => {
    const r = resolveUnit('21635');
    expect(r.headingLines).toEqual(SEVENTH_COMM);
    expect(r.line1).toBe('7TH COMMUNICATION BATTALION');
    expect(r.line2).toBe('OPC 567 BOX 53');
    expect(r.line3).toBe('FPO AP 96384-9001');
  });

  it('MATSG-23 (MCC G91) prints the spelled-out name and corrected address', () => {
    const unit = UNITS.find(u => u.mcc === 'G91');
    expect(unit?.unitName).toBe('MATSG-23 TRNG COM NAS PENSACOLA FL');
    expect(unit?.letterhead).toEqual(['MARINE AVIATION TRAINING SUPPORT GROUP 23']);
    const r = resolveUnit('06015', 'G91');
    expect(r.headingLines).toEqual(['MARINE AVIATION TRAINING SUPPORT GROUP 23']);
    expect(r.line2).toBe('211 FARRAR ROAD');
    expect(r.line3).toBe('PENSACOLA FLORIDA 32508-5009');
  });

  it('a shared RUC resolves to the MCC the user picked, and falls back to RUC only without one', () => {
    expect(findUnit('06015', 'G91')?.unitName).toBe('MATSG-23 TRNG COM NAS PENSACOLA FL');
    expect(findUnit('06015', 'G77')?.unitName).toBe('CNATT NAS PENSACOLA FL');
    // Profiles saved before unitMcc existed: first entry for the RUC, as before.
    expect(findUnit('06015')?.mcc).toBe('G77');
    // Unknown MCC: RUC-only fallback rather than nothing.
    expect(findUnit('06015', 'ZZZ')?.ruc).toBe('06015');
  });

  it('resolveUnit leaves headingLines undefined for units without an override', () => {
    expect(resolveUnit('11110').headingLines).toBeUndefined();
    expect(resolveUnit('11110').line1).toBe('1/1 1ST MARDIV');
  });

  it('every letterhead override is non-empty and upper case', () => {
    for (const u of UNITS.filter(x => x.letterhead)) {
      expect(u.letterhead!.length).toBeGreaterThan(0);
      for (const l of u.letterhead!) expect(l).toBe(l.toUpperCase());
    }
  });
});
