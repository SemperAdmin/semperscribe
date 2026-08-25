import { describe, it, expect } from 'vitest';
import {
  vesselOptionCode,
  lawyerOptionCode,
  mctfsDate,
  mctfsDollars,
  guiltyArticles,
  ttc212PunishmentCodes,
  mctfsNjpStatements,
  TTC_212_MAX_ARTICLES,
  TTC_212_MAX_PUNISHMENTS,
} from '@/lib/navmc10132-mctfs';
import { NAVMC_10132_DEMAND } from '@/types/navmc';
import type { FormData } from '@/types';

// Real article labels pulled from navmc10132-articles.ts (a closed list -
// invented labels resolve to nothing and would silently corrupt fixtures).
const ART_86_UA = 'Art. 86  Absence without leave'; // -> 86
const ART_90_DISOBEY = 'Art. 90  Willfully disobeying sup. comm. officer'; // -> 90
const ART_91_ASSAULT = 'Art. 91  Assault of WO/NCO'; // -> 91
const ART_88_CONTEMPT = 'Art. 88  Contempt toward officials'; // -> 88
// Two DIFFERENT Art. 92 labels that both resolve to MCTFS code '92'.
const ART_92_GENERAL_ORDER = 'Art. 92  Failure to obey general order or regulation'; // -> 92
const ART_92_DERELICTION = 'Art. 92  Willful dereliction of duty'; // -> 92

function baseFormData(overrides: Record<string, unknown> = {}): FormData {
  return {
    punishmentDate: '2026-08-16',
    electionDate: '',
    demand: NAVMC_10132_DEMAND.ACCEPT,
    counselOpportunity: 'have',
    njpAuthorityEdipi: '1234567890',
    offenses: [],
    punishments: [],
    suspensions: [],
    victims: [],
    ...overrides,
  } as unknown as FormData;
}

describe('vesselOptionCode', () => {
  it('maps each NAVMC_10132_DEMAND constant to its VESSEL OPTION CODE letter', () => {
    expect(vesselOptionCode(NAVMC_10132_DEMAND.ACCEPT)).toBe('A');
    expect(vesselOptionCode(NAVMC_10132_DEMAND.REFUSE)).toBe('B');
    expect(vesselOptionCode(NAVMC_10132_DEMAND.VESSEL)).toBe('C');
  });

  it('returns empty string for an empty or unrecognized election', () => {
    expect(vesselOptionCode('')).toBe('');
    expect(vesselOptionCode('some other sentence')).toBe('');
  });
});

describe('lawyerOptionCode', () => {
  it("maps 'have' to A and 'have not' to B", () => {
    expect(lawyerOptionCode('have')).toBe('A');
    expect(lawyerOptionCode('have not')).toBe('B');
  });

  it('returns empty string for empty or garbage input', () => {
    expect(lawyerOptionCode('')).toBe('');
    expect(lawyerOptionCode('garbage')).toBe('');
  });
});

describe('mctfsDate', () => {
  it('converts an ISO date to YYYYMMDD', () => {
    expect(mctfsDate('2026-08-16')).toBe('20260816');
  });

  it('returns empty string for empty, non-ISO, or under-padded input', () => {
    expect(mctfsDate('')).toBe('');
    expect(mctfsDate('16 Aug 26')).toBe('');
    expect(mctfsDate('2026-8-16')).toBe('');
  });
});

describe('mctfsDollars', () => {
  it('zero-pads whole-dollar amounts to 5 digits', () => {
    expect(mctfsDollars(18)).toBe('00018');
    expect(mctfsDollars(500)).toBe('00500');
    expect(mctfsDollars(0)).toBe('00000');
    expect(mctfsDollars(12345)).toBe('12345');
  });

  it('truncates a non-integer amount rather than rounding it', () => {
    expect(mctfsDollars(18.9)).toBe('00018');
  });
});

describe('guiltyArticles', () => {
  it('returns only rows with finding exactly Guilty, excluding Not Guilty and blank findings', () => {
    const fd = baseFormData({
      offenses: [
        { articleLabel: ART_86_UA, summary: 'x', finding: 'Not Guilty' },
        { articleLabel: ART_90_DISOBEY, summary: 'x', finding: '' },
        { articleLabel: ART_91_ASSAULT, summary: 'x', finding: 'Guilty' },
      ],
    });
    const result = guiltyArticles(fd);
    expect(result.articles).toEqual([{ row: 'C', code: '91', label: ART_91_ASSAULT }]);
    expect(result.unresolved).toEqual([]);
    expect(result.deduped).toEqual([]);
  });

  it('assigns row letters A through E by offense index, skipping excluded rows', () => {
    const fd = baseFormData({
      offenses: [
        { articleLabel: ART_86_UA, summary: 'x', finding: 'Guilty' }, // A
        { articleLabel: ART_90_DISOBEY, summary: 'x', finding: 'Not Guilty' }, // B, excluded
        { articleLabel: ART_91_ASSAULT, summary: 'x', finding: 'Guilty' }, // C
        { articleLabel: ART_88_CONTEMPT, summary: 'x', finding: '' }, // D, excluded (blank finding)
        { articleLabel: ART_92_GENERAL_ORDER, summary: 'x', finding: 'Guilty' }, // E
      ],
    });
    const result = guiltyArticles(fd);
    expect(result.articles.map((a) => a.row)).toEqual(['A', 'C', 'E']);
    expect(result.articles.map((a) => a.code)).toEqual(['86', '91', '92']);
  });

  it('deduplicates two different Art. 92 labels that resolve to the same code, folding the later row into the earlier', () => {
    const fd = baseFormData({
      offenses: [
        { articleLabel: ART_92_GENERAL_ORDER, summary: 'x', finding: 'Guilty' }, // A
        { articleLabel: ART_92_DERELICTION, summary: 'x', finding: 'Guilty' }, // B, same code 92
      ],
    });
    const result = guiltyArticles(fd);
    expect(result.articles).toEqual([{ row: 'A', code: '92', label: ART_92_GENERAL_ORDER }]);
    expect(result.deduped).toEqual([
      { row: 'B', label: ART_92_DERELICTION, sameAs: 'A' },
    ]);
    expect(result.unresolved).toEqual([]);
  });

  it('never silently drops a Guilty row whose article label resolves to no MCTFS code', () => {
    const fd = baseFormData({
      offenses: [
        { articleLabel: 'Art. 999  Not A Real Offense', summary: 'x', finding: 'Guilty' },
      ],
    });
    const result = guiltyArticles(fd);
    expect(result.articles).toEqual([]);
    expect(result.unresolved).toEqual([
      { row: 'A', label: 'Art. 999  Not A Real Offense' },
    ]);
  });
});

describe('ttc212PunishmentCodes', () => {
  it('returns a 4-byte code with Y for an unsuspended punishment', () => {
    const fd = baseFormData({
      punishments: [{ code: 'N09', days: '10' }],
      suspensions: [],
    });
    expect(ttc212PunishmentCodes(fd)).toEqual(['N09Y']);
  });

  it('sets byte 4 to N only for indexes present in suspensions[], leaving the rest Y', () => {
    const fd = baseFormData({
      punishments: [
        { code: 'N09', days: '10' },
        { code: 'N08', gradeReducedTo: 'LCPL' },
        { code: 'N07', dollars: '100' },
      ],
      suspensions: [{ punishmentIndex: 1, months: '3' }],
    });
    expect(ttc212PunishmentCodes(fd)).toEqual(['N09Y', 'N08N', 'N07Y']);
  });

  it('is dense: an unresolvable punishment code contributes nothing and leaves no hole', () => {
    const fd = baseFormData({
      punishments: [
        { code: 'N09', days: '10' },
        { code: 'BOGUS' },
        { code: 'N07', dollars: '100' },
      ],
      suspensions: [],
    });
    expect(ttc212PunishmentCodes(fd)).toEqual(['N09Y', 'N07Y']);
  });
});

describe('mctfsNjpStatements', () => {
  it('emits TTC 268 000, then TTC 212 000, then the per-punishment statements, in order', () => {
    const fd = baseFormData({
      punishmentDate: '2026-08-16',
      demand: NAVMC_10132_DEMAND.ACCEPT, // VESSEL OPT A
      counselOpportunity: 'have not', // LAWYER OPT B
      offenses: [{ articleLabel: ART_86_UA, summary: 'x', finding: 'Guilty' }],
      punishments: [{ code: 'N09', days: '10' }],
    });
    const result = mctfsNjpStatements(fd);
    expect(result.blockers).toEqual([]);
    expect(result.statements.map((s) => s.ttc)).toEqual(['TTC 268 000', 'TTC 212 000', 'TTC HIS 000']);

    const njpStatement = result.statements[0];
    expect(njpStatement.text).toContain('VESSEL OPT A');
    expect(njpStatement.text).toContain('LAWYER OPT B');
    const dateOccurrences = njpStatement.text.match(/20260816/g) ?? [];
    expect(dateOccurrences.length).toBe(2);
  });

  it('blocks on 4 distinct guilty articles, naming the overflowing row', () => {
    const fd = baseFormData({
      offenses: [
        { articleLabel: ART_86_UA, summary: 'x', finding: 'Guilty' }, // A -> 86
        { articleLabel: ART_90_DISOBEY, summary: 'x', finding: 'Guilty' }, // B -> 90
        { articleLabel: ART_91_ASSAULT, summary: 'x', finding: 'Guilty' }, // C -> 91
        { articleLabel: ART_88_CONTEMPT, summary: 'x', finding: 'Guilty' }, // D -> 88, overflow
      ],
      punishments: [{ code: 'N09', days: '10' }],
    });
    const result = mctfsNjpStatements(fd);
    expect(result.blockers.length).toBe(1);
    expect(result.blockers[0]).toContain(`${TTC_212_MAX_ARTICLES}`);
    expect(result.blockers[0]).toContain('row D');
    expect(result.blockers[0]).toContain(ART_88_CONTEMPT);
  });

  it('blocks on 5 punishment codes, naming the overflowing codes, with nothing silently truncated', () => {
    const fd = baseFormData({
      offenses: [{ articleLabel: ART_86_UA, summary: 'x', finding: 'Guilty' }],
      punishments: [
        { code: 'N09', days: '10' },
        { code: 'N08', gradeReducedTo: 'LCPL' },
        { code: 'N07', dollars: '100' },
        { code: 'N06', days: '5' },
        { code: 'N16', oralOrWritten: 'orally' },
      ],
    });
    const result = mctfsNjpStatements(fd);
    expect(result.blockers.length).toBe(1);
    expect(result.blockers[0]).toContain(`${TTC_212_MAX_PUNISHMENTS}`);
    expect(result.blockers[0]).toContain('N16Y');

    // Even though TTC 212 cannot hold all 5, every punishment still gets its
    // own action/HIST statement - the overflow blocks only the 212 remark.
    const punishmentStatements = result.statements.filter(
      (s) => s.ttc !== 'TTC 268 000' && s.ttc !== 'TTC 212 000',
    );
    expect(punishmentStatements.length).toBe(5);
  });

  it('blocks when a Guilty article cannot be resolved to an MCTFS code', () => {
    const fd = baseFormData({
      offenses: [{ articleLabel: 'Art. 999  Not A Real Offense', summary: 'x', finding: 'Guilty' }],
      punishments: [{ code: 'N09', days: '10' }],
    });
    const result = mctfsNjpStatements(fd);
    expect(
      result.blockers.some(
        (b) => b.includes('Row A') && b.includes('resolves to no MCTFS article code'),
      ),
    ).toBe(true);
  });

  it('blocks when no offense carries a Guilty finding', () => {
    const fd = baseFormData({
      offenses: [{ articleLabel: ART_86_UA, summary: 'x', finding: 'Not Guilty' }],
      punishments: [{ code: 'N09', days: '10' }],
    });
    const result = mctfsNjpStatements(fd);
    expect(
      result.blockers.some((b) => b.includes('No offense carries a Guilty finding')),
    ).toBe(true);
  });

  it('blocks when item 6 carries no punishment code', () => {
    const fd = baseFormData({
      offenses: [{ articleLabel: ART_86_UA, summary: 'x', finding: 'Guilty' }],
      punishments: [],
    });
    const result = mctfsNjpStatements(fd);
    expect(
      result.blockers.some((b) => b.includes('Item 6 carries no punishment code')),
    ).toBe(true);
  });

  it('lists the item 8B EDIPI as missing when unset', () => {
    const fd = baseFormData({
      njpAuthorityEdipi: '',
      offenses: [{ articleLabel: ART_86_UA, summary: 'x', finding: 'Guilty' }],
      punishments: [{ code: 'N09', days: '10' }],
    });
    const result = mctfsNjpStatements(fd);
    expect(result.missing.some((m) => m.includes('EDIPI') && m.includes('item 8B'))).toBe(true);
  });

  it('lists the item 2 election as missing when unset', () => {
    const fd = baseFormData({
      demand: '',
      offenses: [{ articleLabel: ART_86_UA, summary: 'x', finding: 'Guilty' }],
      punishments: [{ code: 'N09', days: '10' }],
    });
    const result = mctfsNjpStatements(fd);
    expect(result.missing.some((m) => m.includes('item 2 election'))).toBe(true);
  });

  it('lists the item 6 punishment date as missing when unset', () => {
    const fd = baseFormData({
      punishmentDate: '',
      offenses: [{ articleLabel: ART_86_UA, summary: 'x', finding: 'Guilty' }],
      punishments: [{ code: 'N09', days: '10' }],
    });
    const result = mctfsNjpStatements(fd);
    expect(result.missing.some((m) => m.includes('item 6 punishment date'))).toBe(true);
  });

  it('routes an unsuspended N08 reduction to TTC 056 000, with no HIST for it', () => {
    const fd = baseFormData({
      offenses: [{ articleLabel: ART_86_UA, summary: 'x', finding: 'Guilty' }],
      punishments: [{ code: 'N08', gradeReducedTo: 'LCPL' }],
      suspensions: [],
    });
    const result = mctfsNjpStatements(fd);
    expect(result.statements.some((s) => s.ttc === 'TTC 056 000')).toBe(true);
    expect(result.statements.some((s) => s.ttc === 'TTC HIS 000')).toBe(false);
  });

  it('routes a SUSPENDED N08 reduction to TTC HIS 000, never TTC 056, because it changes no pay grade', () => {
    const fd = baseFormData({
      offenses: [{ articleLabel: ART_86_UA, summary: 'x', finding: 'Guilty' }],
      punishments: [{ code: 'N08', gradeReducedTo: 'LCPL' }],
      suspensions: [{ punishmentIndex: 0, months: '6' }],
    });
    const result = mctfsNjpStatements(fd);
    const hist = result.statements.find((s) => s.ttc === 'TTC HIS 000');
    expect(hist).toBeDefined();
    expect(hist!.text).toContain('REDUCED TO');
    expect(hist!.text).toContain('SUSP FOR');
    expect(result.statements.some((s) => s.ttc === 'TTC 056 000')).toBe(false);
  });

  it('routes an unsuspended N07 forfeiture to TTC 283 003 with a zero-padded amount and TOTAL = per-month x months', () => {
    const fd = baseFormData({
      offenses: [{ articleLabel: ART_86_UA, summary: 'x', finding: 'Guilty' }],
      punishments: [{ code: 'N07', dollars: '500' }],
      suspensions: [],
    });
    const result = mctfsNjpStatements(fd);
    const forf = result.statements.find((s) => s.ttc === 'TTC 283 003');
    expect(forf).toBeDefined();
    expect(forf!.text).toContain('$00500.00 FOR 01 MO');
    expect(forf!.text).toContain('TOTAL $00500.00');
  });

  it('routes a SUSPENDED N07 forfeiture to HIST only, never TTC 283 003', () => {
    const fd = baseFormData({
      offenses: [{ articleLabel: ART_86_UA, summary: 'x', finding: 'Guilty' }],
      punishments: [{ code: 'N07', dollars: '500' }],
      suspensions: [{ punishmentIndex: 0, months: '3' }],
    });
    const result = mctfsNjpStatements(fd);
    expect(result.statements.some((s) => s.ttc === 'TTC HIS 000')).toBe(true);
    expect(result.statements.some((s) => s.ttc === 'TTC 283 003')).toBe(false);
  });

  it('routes N09 extra duties to HIST, because it affects no pay or personnel data item', () => {
    const fd = baseFormData({
      offenses: [{ articleLabel: ART_86_UA, summary: 'x', finding: 'Guilty' }],
      punishments: [{ code: 'N09', days: '10' }],
      suspensions: [],
    });
    const result = mctfsNjpStatements(fd);
    const hist = result.statements.find((s) => s.ttc === 'TTC HIS 000');
    expect(hist).toBeDefined();
    expect(hist!.text).toContain('EXTRA DUTIES');
  });

  it('multiplies dollarsPerMonth by months for N04: $250/mo for 2 months totals $00500.00', () => {
    const fd = baseFormData({
      offenses: [{ articleLabel: ART_86_UA, summary: 'x', finding: 'Guilty' }],
      punishments: [{ code: 'N04', dollarsPerMonth: '250', months: '2' }],
      suspensions: [],
    });
    const result = mctfsNjpStatements(fd);
    const forf = result.statements.find((s) => s.ttc === 'TTC 283 003');
    expect(forf).toBeDefined();
    expect(forf!.text).toContain('TOTAL $00500.00');
  });

  it('always includes the Good Conduct Medal and do-not-report-TTC-053 reminders', () => {
    const fd = baseFormData({
      offenses: [{ articleLabel: ART_86_UA, summary: 'x', finding: 'Guilty' }],
      punishments: [{ code: 'N09', days: '10' }],
    });
    const result = mctfsNjpStatements(fd);
    expect(result.reminders.some((r) => r.includes('Good Conduct Medal'))).toBe(true);
    expect(result.reminders.some((r) => r.includes('Do NOT report TTC 053'))).toBe(true);
  });

  it('adds the correctional custody / time lost reminder only when a correctional custody code is present', () => {
    const withCorrCust = baseFormData({
      offenses: [{ articleLabel: ART_86_UA, summary: 'x', finding: 'Guilty' }],
      punishments: [{ code: 'N06', days: '5' }],
    });
    const withoutCorrCust = baseFormData({
      offenses: [{ articleLabel: ART_86_UA, summary: 'x', finding: 'Guilty' }],
      punishments: [{ code: 'N09', days: '10' }],
    });
    const resultWith = mctfsNjpStatements(withCorrCust);
    const resultWithout = mctfsNjpStatements(withoutCorrCust);
    expect(resultWith.reminders.some((r) => r.includes('Correctional custody'))).toBe(true);
    expect(resultWithout.reminders.some((r) => r.includes('Correctional custody'))).toBe(false);
  });

  it('emits a TTC 212 001 for a populated victim row', () => {
    const fd = baseFormData({
      offenses: [{ articleLabel: ART_86_UA, summary: 'x', finding: 'Guilty' }],
      punishments: [{ code: 'N09', days: '10' }],
      victims: [{ status: 'victim', sex: 'F', race: 'W', ethnicity: 'N' }],
    });
    const result = mctfsNjpStatements(fd);
    expect(result.statements.some((s) => s.ttc === 'TTC 212 001')).toBe(true);
  });

  it('emits no TTC 212 001 for a wholly empty victim row', () => {
    const fd = baseFormData({
      offenses: [{ articleLabel: ART_86_UA, summary: 'x', finding: 'Guilty' }],
      punishments: [{ code: 'N09', days: '10' }],
      victims: [{ status: '', sex: '', race: '', ethnicity: '' }],
    });
    const result = mctfsNjpStatements(fd);
    expect(result.statements.some((s) => s.ttc === 'TTC 212 001')).toBe(false);
  });
});

/**
 * N04 reports a MONTHLY figure and a TOTAL. Defaulting an unset month count
 * to 1 would print a TOTAL equal to one month's deduction on a two-month
 * punishment, understating a transaction that moves money by half. N07 is
 * different: it is a single forfeiture of days' pay and one month is the
 * genuine answer, not an assumption.
 */
describe('TTC 283 003 months, never assumed for a per-month forfeiture', () => {
  const base = {
    documentType: 'navmc10132',
    punishmentDate: '2026-08-16',
    demand: NAVMC_10132_DEMAND.ACCEPT,
    counselOpportunity: 'have',
    njpAuthorityEdipi: '1234567890',
    offenses: [{ articleLabel: 'Art. 86  Absence without leave', finding: 'Guilty' }],
  };

  it('N04 with no month count is reported MISSING, not silently treated as one month', () => {
    const report = mctfsNjpStatements({
      ...base,
      punishments: [{ code: 'N04', dollarsPerMonth: '250' }],
    } as unknown as FormData);

    expect(report.missing.some((m) => m.includes('number of months') && m.includes('N04'))).toBe(true);
    const forfeiture = report.statements.find((s) => s.ttc === 'TTC 283 003');
    expect(forfeiture).toBeDefined();
    // The placeholders stand in rather than a computed figure built on a guess.
    expect(forfeiture!.text).toContain('[MO]');
    expect(forfeiture!.text).not.toContain('00250.00 FOR 01 MO');
  });

  it('N07 carries no months parameter, so one month is the real answer and nothing is missing', () => {
    const report = mctfsNjpStatements({
      ...base,
      punishments: [{ code: 'N07', dollars: '500' }],
    } as unknown as FormData);

    expect(report.missing.some((m) => m.includes('number of months'))).toBe(false);
    const forfeiture = report.statements.find((s) => s.ttc === 'TTC 283 003');
    expect(forfeiture!.text).toContain('FORF $00500.00 FOR 01 MO NJP TOTAL $00500.00');
  });

  it('N04 with a month count multiplies into the TOTAL', () => {
    const report = mctfsNjpStatements({
      ...base,
      punishments: [{ code: 'N04', dollarsPerMonth: '250', months: '2' }],
    } as unknown as FormData);

    expect(report.missing.some((m) => m.includes('number of months'))).toBe(false);
    const forfeiture = report.statements.find((s) => s.ttc === 'TTC 283 003');
    expect(forfeiture!.text).toContain('FORF $00250.00 FOR 02 MO NJP TOTAL $00500.00');
  });
});
