import { describe, it, expect } from 'vitest';
import type { FormData } from '@/types';
import { NAVMC_11106_EMPTY_DEPENDENT, type Navmc11106Dependent } from '@/types/navmc';
import {
  commandSponsoredDate,
  combinedRemarks,
  countedDependents,
  generatedRemarks,
  navmc11106FieldProblems,
  navmc11106Values,
  partAValue,
  suggestedEffectiveDate,
  withDependentsOnlyReset,
} from '@/lib/navmc11106-rules';

const P = 'topmostSubform[0].Page1[0].';
const row = (over: Partial<Navmc11106Dependent>): Navmc11106Dependent => ({ ...NAVMC_11106_EMPTY_DEPENDENT, ...over });
const form = (over: Record<string, unknown> = {}) => ({ documentType: 'navmc11106', ...over }) as unknown as FormData;
const child = (over: Partial<Navmc11106Dependent> = {}) =>
  row({ name: 'MARINE, TEST JR', relationship: 'SON', eventDate: '2021-02-03', sponsorshipBasis: 'installation-approval', sponsoredOn: '2026-04-01', ...over });

describe('Part A is computed from the dependents entered', () => {
  it('is member only with no dependents', () => {
    expect(partAValue(form())).toBe('mem');
  });

  it('ignores blank rows', () => {
    expect(partAValue(form({ navmc11106Dependents: [row({}), row({})] }))).toBe('mem');
  });

  it('is member and dependents once a dependent is added', () => {
    expect(partAValue(form({ navmc11106Dependents: [child()] }))).toBe('both');
  });

  it('counts a spouse alone', () => {
    expect(partAValue(form({ navmc11106Spouse: row({ name: 'MARINE, ALEX' }) }))).toBe('both');
  });

  it('is dependents only when the option is on and dependents exist', () => {
    expect(partAValue(form({ navmc11106Dependents: [child()], dependentsOnly: true }))).toBe('dep');
  });

  it('ignores the option when no dependents exist', () => {
    expect(partAValue(form({ dependentsOnly: true }))).toBe('mem');
  });

  it.each(['not-sponsored', 'active-duty-spouse'] as const)('does not count a %s row', (basis) => {
    const data = form({ navmc11106Dependents: [child({ sponsorshipBasis: basis })] });
    expect(countedDependents(data)).toHaveLength(0);
    expect(partAValue(data)).toBe('mem');
  });

  it('resets the option when the last counted dependent is gone', () => {
    const data = form({ dependentsOnly: true, conusColaDependents: true, conusColaZip: '92055' });
    expect(withDependentsOnlyReset(data)).toMatchObject({ dependentsOnly: false, conusColaDependents: false, conusColaZip: '' });
  });

  it('leaves the option alone while dependents remain', () => {
    const data = form({ dependentsOnly: true, navmc11106Dependents: [child()] });
    expect(withDependentsOnlyReset(data).dependentsOnly).toBe(true);
  });
});

describe('command sponsored date', () => {
  it('prints the latest date among counted rows', () => {
    const data = form({
      navmc11106Spouse: row({ name: 'S', sponsorshipBasis: 'installation-approval', sponsoredOn: '2026-04-01' }),
      navmc11106Dependents: [child({ sponsorshipBasis: 'birth', eventDate: '2026-08-03', sponsoredOn: '' })],
    });
    expect(commandSponsoredDate(data)).toBe('2026-08-03');
  });

  it('ignores rows whose basis carries no date', () => {
    const data = form({ navmc11106Dependents: [child({ sponsorshipBasis: 'not-required', sponsoredOn: '2026-01-01' })] });
    expect(commandSponsoredDate(data)).toBe('');
  });
});

describe('suggested D3 date', () => {
  it('member only uses the arrival date', () => {
    expect(suggestedEffectiveDate(form({ dateOfArrival: '2026-06-01' }))).toBe('2026-06-01');
  });

  it('member only moves a day with MALT Plus on the reporting day', () => {
    expect(suggestedEffectiveDate(form({ dateOfArrival: '2026-06-30', maltPlusOnReportingDay: true }))).toBe('2026-07-01');
  });

  it('with dependents uses the later of arrival and sponsorship', () => {
    const base = { navmc11106Dependents: [child()] };
    expect(suggestedEffectiveDate(form({ ...base, dependentsArrived: '2026-06-10' }))).toBe('2026-06-10');
    expect(suggestedEffectiveDate(form({ ...base, dependentsArrived: '2026-03-01' }))).toBe('2026-04-01');
  });

  it('with no arrival date, trusts sponsorship only for a dependent already there', () => {
    expect(suggestedEffectiveDate(form({ navmc11106Dependents: [child()] }))).toBe('');
    const born = child({ sponsorshipBasis: 'birth', eventDate: '2026-08-03', sponsoredOn: '' });
    expect(suggestedEffectiveDate(form({ navmc11106Dependents: [born] }))).toBe('2026-08-03');
  });

  it('with no sponsorship date, falls back to arrival', () => {
    const data = form({ navmc11106Dependents: [child({ sponsorshipBasis: 'not-required', sponsoredOn: '' })], dependentsArrived: '2026-06-10' });
    expect(suggestedEffectiveDate(data)).toBe('2026-06-10');
  });

  it('dependents only uses the dependents arrival', () => {
    const data = form({ navmc11106Dependents: [child()], dependentsOnly: true, dependentsArrived: '2026-06-10' });
    expect(suggestedEffectiveDate(data)).toBe('2026-06-10');
  });
});

describe('generated Remarks', () => {
  it('lists rows whose date differs from the printed C10', () => {
    const data = form({
      navmc11106Spouse: row({ name: 'S', sponsorshipBasis: 'installation-approval', sponsoredOn: '2026-04-01' }),
      navmc11106Dependents: [child({ name: 'BABY', sponsorshipBasis: 'birth', eventDate: '2026-08-03', sponsoredOn: '' })],
    });
    expect(generatedRemarks(data)).toEqual(['C10: S COMMAND SPONSORED 2026-04-01.']);
  });

  it('states the basis for rows with no date', () => {
    const data = form({
      navmc11106Spouse: row({ name: 'S', sponsorshipBasis: 'not-required' }),
      navmc11106Dependents: [child({ name: 'K', sponsorshipBasis: 'designated-place', sponsoredOn: '' })],
    });
    expect(generatedRemarks(data)).toEqual([
      'S: COMMAND SPONSORSHIP NOT REQUIRED.',
      'K: PAID AT DEPENDENT LOCATION.',
    ]);
  });

  it('adds the CONUS line only on a dependents-only application', () => {
    const on = form({ navmc11106Dependents: [child()], dependentsOnly: true, conusColaDependents: true, conusColaZip: '92055' });
    expect(generatedRemarks(on)).toContain('CONUS COLA. ZIP 92055.');
    const off = form({ navmc11106Dependents: [child()], conusColaDependents: true, conusColaZip: '92055' });
    expect(generatedRemarks(off)).not.toContain('CONUS COLA. ZIP 92055.');
  });

  it('puts the user text first', () => {
    const data = form({ navmc11106Remarks: 'SEE ORDERS.', navmc11106Spouse: row({ name: 'S', sponsorshipBasis: 'not-required' }) });
    expect(combinedRemarks(data)).toBe('SEE ORDERS. S: COMMAND SPONSORSHIP NOT REQUIRED.');
  });
});

describe('field values', () => {
  it('sets Part A and writes the EDIPI to the source field name', () => {
    const values = navmc11106Values(form({ edipi: '1234567890' }));
    expect(values[`${P}RadA1[0]`]).toBe('mem');
    expect(values[`${P}SocSecNoApplc[0]`]).toBe('1234567890');
  });

  it('closes up excluded rows so printed rows have no gaps', () => {
    const values = navmc11106Values(form({
      navmc11106Dependents: [child({ name: 'SKIP', sponsorshipBasis: 'not-sponsored' }), child({ name: 'KEEP' })],
    }));
    expect(values[`${P}NameDep2[0]`]).toBe('KEEP');
    expect(values[`${P}NameDep3[0]`]).toBe('');
  });

  it('defaults the spouse relationship and leaves an excluded spouse off row 1', () => {
    const counted = navmc11106Values(form({ navmc11106Spouse: row({ name: 'S', eventDate: '2019-05-04', sponsorshipBasis: 'installation-approval' }) }));
    expect(counted[`${P}NameSps1[0]`]).toBe('S');
    expect(counted[`${P}RelatnshpSps1[0]`]).toBe('SPOUSE');
    expect(counted[`${P}DateMarr[0]`]).toBe('2019-05-04');
    const excluded = navmc11106Values(form({ navmc11106Spouse: row({ name: 'S', sponsorshipBasis: 'active-duty-spouse' }) }));
    expect(excluded[`${P}NameSps1[0]`]).toBe('');
  });

  it('passes Part D through and never writes a signature', () => {
    const values = navmc11106Values(form({ d1Quarters: 'n', d1Assignment: 'no', d2b: 'y' }));
    expect(values[`${P}RadD1AvailNot[0]`]).toBe('n');
    expect(values[`${P}RadD1AssnNot[0]`]).toBe('no');
    expect(values[`${P}RadD2B1[0]`]).toBe('y');
    expect(`${P}SigMem[0]` in values).toBe(false);
    expect(`${P}SigCO[0]` in values).toBe(false);
  });

  it('caps Remarks at the form limit so the fill cannot fail on length', () => {
    const values = navmc11106Values(form({ navmc11106Remarks: 'X'.repeat(900) }));
    expect(values[`${P}RemrkD3[0]`]).toHaveLength(720);
  });
});

describe('navmc11106FieldProblems', () => {
  const problems = (over: Record<string, unknown> = {}) => navmc11106FieldProblems(form(over));

  it('finds nothing in an ordinary form', () => {
    expect(problems({ nameOfMarine: 'MUÑOZ, JOSE', dutyStation: 'CAMP FOSTER, OKINAWA, JAPAN' })).toEqual([]);
  });

  it('accepts what Windows-1252 prints, including curly quotes and accents', () => {
    expect(problems({ nameOfMarine: 'O’BRIEN, SEÁN', navmc11106Remarks: 'LINE ONE\nLINE TWO “QUOTED” – DASH' })).toEqual([]);
  });

  it.each([
    ['NGUYỄN, AN', 'B1 Name', 'Ễ'],
    ['ŁUKASZ, K', 'B1 Name', 'Ł'],
    ['沖縄市', 'B1 Name', '沖'],
  ])('flags %s as unprintable', (name, block, ch) => {
    const found = problems({ nameOfMarine: name });
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ block, problem: 'unprintable' });
    expect(found[0].detail).toContain(ch);
  });

  it('flags a limit overrun with the block named', () => {
    expect(problems({ grade: 'G'.repeat(21) })[0]).toMatchObject({ block: 'B2 Grade', problem: 'too-long' });
    expect(problems({ nameOfMarine: 'N'.repeat(71) })[0]).toMatchObject({ block: 'B1 Name', problem: 'too-long' });
    expect(problems({ dutyStation: 'D'.repeat(131) })[0]).toMatchObject({ block: 'B5 Duty Station', problem: 'too-long' });
    expect(problems({ dependentLocation: 'L'.repeat(71) })[0]).toMatchObject({ block: "C8 Dependent's Location", problem: 'too-long' });
    expect(problems({ coNameGradeActivity: 'C'.repeat(66) })[0]).toMatchObject({ block: 'CO Name, Grade, Activity', problem: 'too-long' });
  });

  it('checks counted spouse and dependent rows, and ignores uncounted ones', () => {
    const counted = child({ name: 'N'.repeat(26), relationship: 'R'.repeat(21) });
    const found = problems({ navmc11106Dependents: [counted] });
    expect(found.map((f) => f.block)).toEqual(['C2A Name', 'C2B Relationship']);
    const spouse = row({ name: 'ŁUKASZ', eventDate: '2019-05-04', sponsorshipBasis: 'installation-approval', sponsoredOn: '2026-04-01' });
    expect(problems({ navmc11106Spouse: spouse })[0]).toMatchObject({ block: 'C1A Name', problem: 'unprintable' });
    const uncounted = child({ name: 'ŁUKASZ', sponsorshipBasis: 'not-sponsored' });
    expect(problems({ navmc11106Dependents: [uncounted] })).toEqual([]);
  });

  it('checks the printed Remarks for unprintable text only', () => {
    expect(problems({ navmc11106Remarks: 'SEE 沖縄' })[0]).toMatchObject({ block: 'Remarks', problem: 'unprintable' });
    expect(problems({ navmc11106Remarks: 'X'.repeat(800) })).toEqual([]);
  });

  it('agrees with pdf-lib about which characters Windows-1252 can print', async () => {
    const { PDFDocument, StandardFonts } = await import('pdf-lib');
    const font = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
    const disagreements: string[] = [];
    for (let cp = 0x00; cp < 0x3000; cp += 1) {
      if (cp === 0x0a || cp === 0x0d) continue;
      const ch = String.fromCodePoint(cp);
      let encodable = true;
      try { font.encodeText(ch); } catch { encodable = false; }
      const flagged = problems({ nameOfMarine: ch }).length > 0;
      if (flagged === encodable) disagreements.push(`U+${cp.toString(16)}`);
    }
    expect(disagreements).toEqual([]);
  });

  it('really lets pdf-lib fill the names it accepts and throw on those it flags', async () => {
    const { PDFDocument } = await import('pdf-lib');
    const fill = async (text: string) => {
      const pdf = await PDFDocument.create();
      const page = pdf.addPage();
      const tf = pdf.getForm().createTextField('t');
      tf.enableMultiline();
      tf.addToPage(page, { x: 10, y: 10, width: 200, height: 60 });
      tf.setText(text);
      pdf.getForm().updateFieldAppearances();
    };
    for (const ok of ['MUÑOZ, JOSE', 'O’BRIEN, SEÁN', 'LINE ONE\nLINE TWO']) {
      await expect(fill(ok)).resolves.toBeUndefined();
    }
    for (const bad of ['NGUYỄN', 'ŁUKASZ', '沖縄市']) {
      await expect(fill(bad)).rejects.toThrow(/WinAnsi/);
    }
  });
});
