import { describe, it, expect } from 'vitest';
import type { FormData } from '@/types';
import { NAVMC_11106_EMPTY_DEPENDENT, type Navmc11106Dependent } from '@/types/navmc';
import { runNavmc11106Validators } from '@/lib/navmc11106-validators';

const NOW = new Date(2026, 10, 5);
const row = (o: Partial<Navmc11106Dependent>): Navmc11106Dependent => ({ ...NAVMC_11106_EMPTY_DEPENDENT, ...o });
const CORE = { nameOfMarine: 'MARINE, TEST', grade: 'SGT', edipi: '1234567890', dutyStation: 'OKINAWA JP' };
const form = (o: Record<string, unknown> = {}) => ({ documentType: 'navmc11106', ...CORE, ...o }) as unknown as FormData;
const child = (o: Partial<Navmc11106Dependent> = {}) =>
  row({ name: 'K', relationship: 'SON', eventDate: '2021-02-03', sponsorshipBasis: 'installation-approval', sponsoredOn: '2026-04-01', ...o });
const ids = (data: FormData) => runNavmc11106Validators(data, NOW).map((i) => i.id);
const sev = (data: FormData, id: string) => runNavmc11106Validators(data, NOW).find((i) => i.id === id)?.severity;

describe('navmc11106 validators', () => {
  it('is a no-op for other document types', () => {
    expect(runNavmc11106Validators({ documentType: 'basic' } as unknown as FormData, NOW)).toEqual([]);
  });

  it('is clean on a complete member-only application', () => {
    expect(ids(form())).toEqual([]);
  });

  it.each([
    ['nameOfMarine', ''], ['grade', ''], ['dutyStation', ''], ['edipi', '123'], ['edipi', '123-45-6789'],
  ])('blocks when %s is %s', (key, value) => {
    expect(sev(form({ [key]: value }), 'navmc11106-core-fields')).toBe('block');
  });

  it('is the only blocker', () => {
    const messy = form({ navmc11106Dependents: [row({ name: 'K' })], dependentsOnly: true, navmc11106Remarks: 'X'.repeat(900) });
    expect(runNavmc11106Validators(messy, NOW).filter((i) => i.severity === 'block')).toEqual([]);
  });

  it('fails an incomplete row', () => {
    expect(sev(form({ navmc11106Dependents: [child({ relationship: '' })] }), 'navmc11106-row-incomplete')).toBe('fail');
  });

  it('does not require a relationship on the spouse row', () => {
    const data = form({ navmc11106Spouse: child({ relationship: '' }), dependentsArrived: '2026-06-10' });
    expect(ids(data)).not.toContain('navmc11106-row-incomplete');
  });

  it('fails a row with no basis', () => {
    expect(sev(form({ navmc11106Dependents: [child({ sponsorshipBasis: '' })] }), 'navmc11106-basis-missing')).toBe('fail');
  });

  it('fails a dated basis with no date, but not birth, which uses the date of birth', () => {
    expect(ids(form({ navmc11106Dependents: [child({ sponsoredOn: '' })] }))).toContain('navmc11106-sponsored-date-missing');
    expect(ids(form({ navmc11106Dependents: [child({ sponsorshipBasis: 'birth', sponsoredOn: '' })] })))
      .not.toContain('navmc11106-sponsored-date-missing');
  });

  it('warns on excluded rows', () => {
    expect(sev(form({ navmc11106Dependents: [child({ sponsorshipBasis: 'not-sponsored' })] }), 'navmc11106-not-sponsored-excluded')).toBe('warn');
    expect(sev(form({ navmc11106Spouse: child({ sponsorshipBasis: 'active-duty-spouse' }) }), 'navmc11106-active-duty-spouse-excluded')).toBe('warn');
  });

  it('warns on the reduced rate when non-sponsored dependents and quarters are present', () => {
    const data = form({ navmc11106Dependents: [child({ sponsorshipBasis: 'not-sponsored' })], d1Quarters: 'y' });
    expect(sev(data, 'navmc11106-reduced-rate')).toBe('warn');
  });

  it('warns that member only with quarters and mess is barracks COLA', () => {
    expect(sev(form({ d1Quarters: 'y', d2Mess: 'y' }), 'navmc11106-barracks-no-form')).toBe('warn');
    expect(ids(form({ d1Quarters: 'n', d2Mess: 'y' }))).not.toContain('navmc11106-barracks-no-form');
  });

  it('fails dependents only without a location, or CONUS without a ZIP', () => {
    const base = { navmc11106Dependents: [child()], dependentsOnly: true };
    expect(sev(form(base), 'navmc11106-dep-only-no-location')).toBe('fail');
    expect(ids(form({ ...base, dependentLocation: 'BERLIN GERMANY' }))).not.toContain('navmc11106-dep-only-no-location');
    expect(ids(form({ ...base, conusColaDependents: true }))).toContain('navmc11106-dep-only-no-location');
    expect(ids(form({ ...base, conusColaDependents: true, conusColaZip: '92055' }))).not.toContain('navmc11106-dep-only-no-location');
  });

  it('warns when box 2 carries a dependent location', () => {
    expect(sev(form({ navmc11106Dependents: [child()], dependentLocation: 'BERLIN' }), 'navmc11106-member-dep-with-location')).toBe('warn');
  });

  it('warns when installation approval is after arrival', () => {
    const data = form({ navmc11106Dependents: [child({ sponsoredOn: '2026-07-01' })], dependentsArrived: '2026-06-10' });
    expect(sev(data, 'navmc11106-c10-before-travel')).toBe('warn');
  });

  it('warns when D3 differs from the suggestion or is in the future', () => {
    expect(sev(form({ dateOfArrival: '2026-06-01', effectiveDate: '2026-06-02' }), 'navmc11106-effective-date-differs')).toBe('warn');
    expect(ids(form({ dateOfArrival: '2026-06-01', effectiveDate: '2026-06-01' }))).not.toContain('navmc11106-effective-date-differs');
    expect(sev(form({ effectiveDate: '2026-11-06' }), 'navmc11106-effective-date-future')).toBe('warn');
    expect(ids(form({ effectiveDate: '2026-11-05' }))).not.toContain('navmc11106-effective-date-future');
  });

  it('warns that mess availability does not affect with-dependent COLA', () => {
    expect(sev(form({ navmc11106Dependents: [child()], d2b: 'y' }), 'navmc11106-mess-ignored-with-deps')).toBe('warn');
  });

  it('warns when Impractical has no Remarks', () => {
    expect(sev(form({ d2b: 'n' }), 'navmc11106-impractical-needs-statement')).toBe('warn');
    expect(ids(form({ d2b: 'n', navmc11106Remarks: 'OPERATIONAL NEED.' }))).not.toContain('navmc11106-impractical-needs-statement');
  });

  it('fails over-long Remarks and row fields', () => {
    expect(sev(form({ navmc11106Remarks: 'X'.repeat(721) }), 'navmc11106-remarks-too-long')).toBe('fail');
    expect(sev(form({ navmc11106Dependents: [child({ name: 'N'.repeat(26) })] }), 'navmc11106-field-too-long')).toBe('fail');
    expect(sev(form({ navmc11106Dependents: [child({ relationship: 'R'.repeat(21) })] }), 'navmc11106-field-too-long')).toBe('fail');
  });
});

describe('navmc11106 final-review additions', () => {
  const find = (data: FormData, id: string) => runNavmc11106Validators(data, NOW).find((i) => i.id === id);

  it('fails a character the form font cannot print, citing the form font', () => {
    const issue = find(form({ nameOfMarine: 'NGUYỄN, AN' }), 'navmc11106-field-unprintable');
    expect(issue?.severity).toBe('fail');
    expect(issue?.citation).toBe('NAVMC 11106 form font');
    expect(ids(form({ nameOfMarine: 'MUÑOZ, JOSE' }))).not.toContain('navmc11106-field-unprintable');
    expect(ids(form({ navmc11106Remarks: 'SEE 沖縄' }))).toContain('navmc11106-field-unprintable');
  });

  it('fails an over-long Part B, C8, or CO field with the same rule', () => {
    for (const over of [{ nameOfMarine: 'N'.repeat(71) }, { grade: 'G'.repeat(21) }, { dutyStation: 'D'.repeat(131) },
      { dependentLocation: 'L'.repeat(71) }, { coNameGradeActivity: 'C'.repeat(66) }]) {
      expect(sev(form(over), 'navmc11106-field-too-long')).toBe('fail');
    }
    expect(ids(form({ nameOfMarine: 'N'.repeat(70), grade: 'G'.repeat(20) }))).not.toContain('navmc11106-field-too-long');
  });

  it('warns when box 2 carries a designated-place dependent', () => {
    const designated = form({ navmc11106Dependents: [child({ sponsorshipBasis: 'designated-place', sponsoredOn: '' })] });
    const issue = find(designated, 'navmc11106-designated-place-box-2');
    expect(issue?.severity).toBe('warn');
    expect(issue?.rule).toBe('Dependents paid at their own location usually mean a dependents-only application');
    expect(issue?.citation).toBe('PRIUM 80102 par 3.a(1)(c); FMR Vol 7A Ch 68 par 2.2.2');
  });

  it('does not warn on designated-place for other Part A values or bases', () => {
    const dep = form({ dependentsOnly: true, dependentLocation: 'X', navmc11106Dependents: [child({ sponsorshipBasis: 'designated-place', sponsoredOn: '' })] });
    expect(ids(dep)).not.toContain('navmc11106-designated-place-box-2');
    expect(ids(form())).not.toContain('navmc11106-designated-place-box-2');
    expect(ids(form({ navmc11106Dependents: [child()] }))).not.toContain('navmc11106-designated-place-box-2');
  });

  it('cites the corrected paragraphs', () => {
    expect(find(form({ navmc11106Dependents: [child({ sponsoredOn: '' })] }), 'navmc11106-sponsored-date-missing')?.citation)
      .toBe('MCO 1300.8 Ch 6 par 4-6');
    expect(find(form({ dateOfArrival: '2026-06-01', effectiveDate: '2026-06-02' }), 'navmc11106-effective-date-differs')?.citation)
      .toBe('FMR Vol 7A Ch 68 par 2.1.5, 2.3.4, 3.2.1, 3.3');
  });
});
