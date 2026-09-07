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
  COMPOSED_FORMAT_CAUTION,
  reducedGradeField,
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

  // THIS ASSERTION WAS STRENGTHENED ON 2026-08-26, and the old one is the
  // reason the defect survived. It asked only that the statement contain
  // "EXTRA DUTIES", which the BUGGY output satisfied: the statement printed
  // `code.description`, "EXTRA DUTIES, INCLUDING FATIGUE OR OTHER DUTIES,
  // FOR NOT MORE THAN 14 CONSECUTIVE DAYS", which is the ceiling out of 10
  // U.S.C. 815(b)(2)(E) rather than the ten days the commander awarded. A
  // clerk typing that recorded a punishment nobody imposed, permanently, in
  // the only place this punishment is reported.
  //
  // The wording is item 6's own template output, so the statement and the
  // form say the same words and a clerk can check one against the other.
  it('routes N09 extra duties to HIST and states what was AWARDED, not the statutory ceiling', () => {
    const fd = baseFormData({
      offenses: [{ articleLabel: ART_86_UA, summary: 'x', finding: 'Guilty' }],
      punishments: [{ code: 'N09', days: '10' }],
      suspensions: [],
    });
    const result = mctfsNjpStatements(fd);
    const hist = result.statements.find((s) => s.ttc === 'TTC HIS 000');
    expect(hist).toBeDefined();
    expect(hist!.text).toContain('10 DAYS');
    // The ceiling must not appear. This is the half the old assertion missed.
    expect(hist!.text).not.toContain('NOT MORE THAN');
    expect(hist!.text).not.toContain('14 CONSECUTIVE DAYS');
  });

  // A restriction and extra duties both carry a days parameter, so the same
  // defect printed both ceilings. Asserted on a second code so a fix
  // special-cased to N09 does not pass. N11's template also takes the
  // LIMITS, which is free text a commander sets, so this proves the
  // statement carries the whole imposed punishment and not just its number.
  it('states the awarded restriction, its limits and its days, not its ceiling', () => {
    const fd = baseFormData({
      offenses: [{ articleLabel: ART_86_UA, summary: 'x', finding: 'Guilty' }],
      punishments: [{ code: 'N11', limits: 'the barracks', days: '14' }],
      suspensions: [],
    });
    const hist = mctfsNjpStatements(fd).statements.find((s) => s.ttc === 'TTC HIS 000');
    expect(hist).toBeDefined();
    expect(hist!.text).toContain('14 DAYS');
    expect(hist!.text).toContain('THE BARRACKS');
    expect(hist!.text).not.toContain('NOT MORE THAN');
  });

  // Ordinary mid-entry state, not a bug: item 6 has the code and not yet the
  // number. The statement must NOT invent one, and must say so.
  it('names the punishment without an amount when item 6 has not collected one', () => {
    const fd = baseFormData({
      offenses: [{ articleLabel: ART_86_UA, summary: 'x', finding: 'Guilty' }],
      punishments: [{ code: 'N09' }],
      suspensions: [],
    });
    const result = mctfsNjpStatements(fd);
    const hist = result.statements.find((s) => s.ttc === 'TTC HIS 000');
    expect(hist).toBeDefined();
    expect(hist!.text).toContain('[AMOUNT]');
    expect(result.missing.some((m) => m.includes('N09'))).toBe(true);
    expect(hist!.notes.some((n) => n.includes('Do not enter it as it stands'))).toBe(true);
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

// ---------------------------------------------------------------------------
// THE LINE A CLERK ACTUALLY KEYS.
//
// STEPHEN, 2026-08-26, looking at the worksheet: why did the app show
// "20260825 NJP AWD VESSEL OPT A LAWYER OPT A ED 20260825 |" rather than the
// actual transaction? Because the transaction number lived in `ttc` beside
// the string instead of at the head of it, so the string was not a line
// anybody could key.
//
// He then supplied MCTFSPRIUM 70507, which settles the shape. Its paragraph 4
// writes the punitive reduction as ONE line beginning with the TTC and its
// sequence:
//
//   TTC 056 000 [A] REDUCED [B] DOR [C] ED [D] | HIST: [E] |
//
// That is the only statement in this module built against a template this
// codebase holds the words of. The rest are composed, and now say so.
// ---------------------------------------------------------------------------
describe('every statement is a whole line, transaction number included', () => {
  function everyStatement() {
    const cases = [
      baseFormData({
        offenses: [{ articleLabel: ART_86_UA, summary: 'x', finding: 'Guilty' }],
        punishments: [{ code: 'N08', gradeReducedTo: 'LCPL' }],
        suspensions: [],
        victims: [{ status: 'Military', sex: 'M', race: 'W', ethnicity: 'N' }],
      }),
      baseFormData({
        offenses: [{ articleLabel: ART_86_UA, summary: 'x', finding: 'Guilty' }],
        punishments: [{ code: 'N08', gradeReducedTo: 'LCPL' }],
        suspensions: [{ punishmentIndex: 0, months: '6' }],
      }),
      baseFormData({
        offenses: [{ articleLabel: ART_86_UA, summary: 'x', finding: 'Guilty' }],
        punishments: [{ code: 'N04', dollarsPerMonth: '250', months: '2' }],
        suspensions: [],
      }),
      baseFormData({
        offenses: [{ articleLabel: ART_86_UA, summary: 'x', finding: 'Guilty' }],
        punishments: [{ code: 'N04', dollarsPerMonth: '250', months: '2' }],
        suspensions: [{ punishmentIndex: 0, months: '6' }],
      }),
      baseFormData({
        offenses: [{ articleLabel: ART_86_UA, summary: 'x', finding: 'Guilty' }],
        punishments: [{ code: 'N09', days: '10' }],
        suspensions: [],
      }),
    ];
    return cases.flatMap((fd) => mctfsNjpStatements(fd).statements);
  }

  it('starts every statement text with its own transaction and sequence', () => {
    const statements = everyStatement();
    // Guards the guard: an empty list would pass the loop below silently.
    expect(statements.length).toBeGreaterThanOrEqual(12);
    for (const statement of statements) {
      expect(statement.text.startsWith(statement.ttc), `${statement.ttc}: ${statement.text}`).toBe(
        true,
      );
    }
  });

  it('covers all six transactions this module can emit', () => {
    const seen = new Set(everyStatement().map((s) => s.ttc));
    expect([...seen].sort()).toEqual([
      'TTC 056 000',
      'TTC 212 000',
      'TTC 212 001',
      'TTC 268 000',
      'TTC 283 003',
      'TTC HIS 000',
    ]);
  });
});

describe('TTC 056 000, against the template Stephen supplied', () => {
  const fd = baseFormData({
    punishmentDate: '2026-08-16',
    offenses: [{ articleLabel: ART_86_UA, summary: 'x', finding: 'Guilty' }],
    punishments: [{ code: 'N08', gradeReducedTo: 'LCpl' }],
    suspensions: [],
  });

  // The whole line, field for field, not a substring check. This is the one
  // statement where an exact assertion is honest, because the words come
  // from the PRIUM rather than from this app.
  it('matches TTC 056 000 [A] REDUCED [B] DOR [C] ED [D] | HIST: [E] | exactly', () => {
    const statement = mctfsNjpStatements(fd).statements.find((s) => s.ttc === 'TTC 056 000');
    expect(statement).toBeDefined();
    expect(statement!.text).toBe(
      'TTC 056 000 20260816 REDUCED LCPL DOR 20260816 ED 20260816 | HIST: [CO’S LETTER INFO] |',
    );
  });

  it('declares itself template-quoted, and carries no composed-format caution', () => {
    const statement = mctfsNjpStatements(fd).statements.find((s) => s.ttc === 'TTC 056 000');
    expect(statement!.templateQuoted).toBe(true);
    expect(statement!.notes).not.toContain(COMPOSED_FORMAT_CAUTION);
  });

  // Field [B] is "6-byte abbreviation for pay grade to which reduced". Item 6
  // records the rank abbreviation, which is that; uppercased for a
  // transaction line.
  it('uppercases the pay grade abbreviation for field [B]', () => {
    const statement = mctfsNjpStatements(fd).statements.find((s) => s.ttc === 'TTC 056 000');
    expect(statement!.text).toContain(' REDUCED LCPL DOR ');
    expect(reducedGradeField('LCpl')).toEqual({ value: 'LCPL', overLength: false });
  });

  // NEVER TRUNCATED. Cutting a pay grade to six characters on a transaction
  // that moves a Marine's pay is worse than one the clerk is told to check.
  it('reports an over-length grade rather than cutting it to six bytes', () => {
    const long = baseFormData({
      offenses: [{ articleLabel: ART_86_UA, summary: 'x', finding: 'Guilty' }],
      punishments: [{ code: 'N08', gradeReducedTo: 'SERGEANT' }],
      suspensions: [],
    });
    const result = mctfsNjpStatements(long);
    const statement = result.statements.find((s) => s.ttc === 'TTC 056 000');
    expect(statement!.text).toContain('REDUCED SERGEANT DOR');
    expect(result.missing.some((m) => m.includes('6 bytes') || m.includes('six bytes'))).toBe(true);
    expect(statement!.notes.some((n) => n.includes('Nothing has been truncated'))).toBe(true);
  });

  // Every Marine Corps rank abbreviation the picker offers fits the field.
  it('fits the longest abbreviations the app can produce', () => {
    for (const abbreviation of ['Pvt', 'PFC', 'LCpl', 'Cpl', 'Sgt', 'SSgt', 'GySgt', 'MSgt', 'MGySgt', 'SgtMaj']) {
      expect(reducedGradeField(abbreviation).overLength, abbreviation).toBe(false);
    }
  });

  // The old note cited PRIUM 70504. 70507.1 is where the JEPES requirement
  // is: "JEPES marks must be reported on the reductions of Corporals and
  // below per Section 4 of this chapter."
  it('cites 70507.1 for the JEPES requirement, not 70504', () => {
    const statement = mctfsNjpStatements(fd).statements.find((s) => s.ttc === 'TTC 056 000');
    const jepes = statement!.notes.find((n) => n.includes('JEPES'));
    expect(jepes).toBeDefined();
    expect(jepes).toContain('70507.1');
    expect(jepes).not.toContain('70504');
  });
});

describe('a composed statement says it is composed', () => {
  const fd = baseFormData({
    offenses: [{ articleLabel: ART_86_UA, summary: 'x', finding: 'Guilty' }],
    punishments: [{ code: 'N09', days: '10' }],
    suspensions: [],
    victims: [{ status: 'Military', sex: 'M', race: 'W', ethnicity: 'N' }],
  });

  // A clerk entering a legal record is owed the difference between a line
  // this app can point at a paragraph for and one it wrote by analogy.
  it('carries the caution on every statement that is not template-quoted', () => {
    const statements = mctfsNjpStatements(fd).statements;
    const composed = statements.filter((s) => !s.templateQuoted);
    expect(composed.length).toBeGreaterThan(0);
    for (const statement of composed) {
      expect(statement.notes, statement.ttc).toContain(COMPOSED_FORMAT_CAUTION);
    }
  });

  // TWO STATEMENTS ARE QUOTED, and naming them beats counting them: a count
  // passes when a composed statement is wrongly promoted and a quoted one is
  // wrongly demoted at the same time.
  it('does not put the caution on a template-quoted statement', () => {
    const reduction = baseFormData({
      offenses: [{ articleLabel: ART_86_UA, summary: 'x', finding: 'Guilty' }],
      punishments: [{ code: 'N08', gradeReducedTo: 'LCPL' }],
      suspensions: [],
    });
    const quoted = mctfsNjpStatements(reduction).statements.filter((s) => s.templateQuoted);
    expect(quoted.map((s) => s.ttc).sort()).toEqual(['TTC 056 000', 'TTC 268 000']);
    for (const statement of quoted) {
      expect(statement.notes, statement.ttc).not.toContain(COMPOSED_FORMAT_CAUTION);
    }
  });

  // The three that are still composed. 70508 (TTC 212) and 70502 (TTC 283)
  // have not been supplied, and the history statement wording is this app's.
  it('leaves the transactions with no supplied template composed', () => {
    const fd = baseFormData({
      offenses: [{ articleLabel: ART_86_UA, summary: 'x', finding: 'Guilty' }],
      punishments: [{ code: 'N04', dollarsPerMonth: '250', months: '2' }],
      suspensions: [],
      victims: [{ status: 'Military', sex: 'M', race: 'W', ethnicity: 'N' }],
    });
    const composed = mctfsNjpStatements(fd)
      .statements.filter((s) => !s.templateQuoted)
      .map((s) => s.ttc)
      .sort();
    expect(composed).toEqual(['TTC 212 000', 'TTC 212 001', 'TTC 283 003']);
  });

  // The caution has to name what IS sourced, or it reads as "none of this is
  // trustworthy" and a clerk stops reading the notes.
  it('says the values are sourced even where the layout is not', () => {
    expect(COMPOSED_FORMAT_CAUTION).toContain('values come from cited PRIUM rules');
  });
});

describe('TTC 268 000, against the template Stephen supplied', () => {
  // MCTFSPRIUM 70503, supplied 2026-08-26:
  //
  //   TTC 268 000 [A] NJP AWD VESSEL OPT [B] LAWYER OPT [C] ED [D] | HIST:
  //   History statement should include statistical information (That is,
  //   Violation Article 92) and all punishment awarded.
  //
  //   [A] 8-byte Date of Action (YYYYMMDD)
  //   [B] VESSEL OPT
  //   [C] LAWYER OPT
  //   [D] 8-byte Effective Date (YYYYMMDD) of Non-Judicial Punishment
  const fd = baseFormData({
    punishmentDate: '2026-08-16',
    demand: NAVMC_10132_DEMAND.ACCEPT, // VESSEL OPT A
    counselOpportunity: 'have', // LAWYER OPT A
    offenses: [{ articleLabel: ART_86_UA, summary: 'x', finding: 'Guilty' }],
    punishments: [{ code: 'N09', days: '10' }],
    suspensions: [],
  });

  function statement() {
    return mctfsNjpStatements(fd).statements.find((s) => s.ttc === 'TTC 268 000')!;
  }

  it('matches the template field for field, HIST segment included', () => {
    expect(statement().text).toBe(
      'TTC 268 000 20260816 NJP AWD VESSEL OPT A LAWYER OPT A ED 20260816 | ' +
        'HIST: VIOLATION ARTICLE 86. EXTRA DU FOR 10 DAYS',
    );
  });

  // THE HALF THAT WAS MISSING. The line used to stop at the pipe, with the
  // HIST requirement carried only as a note telling the clerk to go and find
  // the text somewhere else. A clerk keying what the sheet showed entered a
  // TTC 268 with no history statement, into a remark MCTFS retains
  // permanently.
  it('carries a HIST segment at all', () => {
    expect(statement().text).toContain('| HIST: ');
  });

  // 70507.4 writes "| HIST: [E] |" with a bracketed field and a closing
  // delimiter. 70503 writes "| HIST:" and then runs the requirement in as
  // prose, with neither. Adding a closing pipe here would be inventing a
  // delimiter the paragraph does not show.
  it('does not close the HIST segment with a pipe the paragraph does not show', () => {
    expect(statement().text.endsWith('|')).toBe(false);
  });

  it('declares itself template-quoted', () => {
    expect(statement().templateQuoted).toBe(true);
    expect(statement().notes).not.toContain(COMPOSED_FORMAT_CAUTION);
  });

  // "statistical information (That is, Violation Article 92)". The
  // parenthetical is what settles this: the statistical information is the
  // article violated.
  it('names every guilty article, deduplicated the way the 212 slots are', () => {
    const many = baseFormData({
      punishmentDate: '2026-08-16',
      demand: NAVMC_10132_DEMAND.ACCEPT,
      counselOpportunity: 'have',
      offenses: [
        { articleLabel: ART_86_UA, summary: 'x', finding: 'Guilty' },
        { articleLabel: ART_92_GENERAL_ORDER, summary: 'y', finding: 'Guilty' },
        { articleLabel: ART_86_UA, summary: 'z', finding: 'Guilty' },
      ],
      punishments: [{ code: 'N09', days: '10' }],
      suspensions: [],
    });
    const text = mctfsNjpStatements(many).statements.find((s) => s.ttc === 'TTC 268 000')!.text;
    expect(text).toContain('VIOLATION ARTICLE 86, VIOLATION ARTICLE 92');
    // Row C repeats article 86 and shares row A's mention, exactly as it
    // shares row A's ART slot.
    expect(text.match(/VIOLATION ARTICLE 86/g)?.length).toBe(1);
  });

  // A NOT GUILTY finding is not statistical information about a punishment
  // nobody received. Reporting one in a permanent remark records a conviction
  // that did not happen.
  it('names no article that was found not guilty', () => {
    const acquitted = baseFormData({
      punishmentDate: '2026-08-16',
      offenses: [
        { articleLabel: ART_86_UA, summary: 'x', finding: 'Guilty' },
        { articleLabel: ART_92_GENERAL_ORDER, summary: 'y', finding: 'Not Guilty' },
      ],
      punishments: [{ code: 'N09', days: '10' }],
      suspensions: [],
    });
    const text = mctfsNjpStatements(acquitted).statements.find((s) => s.ttc === 'TTC 268 000')!.text;
    expect(text).toContain('VIOLATION ARTICLE 86');
    expect(text).not.toContain('ARTICLE 92');
  });

  // "and all punishment awarded". ALL of it, including the ones that get
  // their own transaction, because this remark is the whole picture.
  // ITEM 6 RENDERS A REDUCTION AS "To be red to LCpl", which uppercases to
  // "TO BE RED TO LCPL". That abbreviation exists because item 6 is a
  // 123-character field; in a remark MCTFS retains permanently, "RED" reads
  // as a colour. 70507.4 gives this app the words for a reduction and the
  // TTC 056 on the same sheet already prints them.
  it('says a reduction the way 70507.4 says it, not the way item 6 abbreviates it', () => {
    const reduction = baseFormData({
      punishmentDate: '2026-08-16',
      offenses: [{ articleLabel: ART_86_UA, summary: 'x', finding: 'Guilty' }],
      punishments: [{ code: 'N08', gradeReducedTo: 'LCpl' }],
      suspensions: [],
    });
    const result = mctfsNjpStatements(reduction);
    const hist = result.statements.find((s) => s.ttc === 'TTC 268 000')!.text;
    expect(hist).toContain('REDUCED LCPL');
    expect(hist).not.toContain('RED TO');
    // And it agrees with the transaction beside it, which is quoted.
    expect(result.statements.find((s) => s.ttc === 'TTC 056 000')!.text).toContain(
      'REDUCED LCPL',
    );
  });

  // Only the reduction. Everything else keeps item 6's wording, because for
  // those the PRIUM gives this app no vocabulary of its own.
  it('keeps item 6 wording for every punishment the PRIUM does not word', () => {
    const other = baseFormData({
      punishmentDate: '2026-08-16',
      offenses: [{ articleLabel: ART_86_UA, summary: 'x', finding: 'Guilty' }],
      punishments: [{ code: 'N09', days: '10' }],
      suspensions: [],
    });
    const hist = mctfsNjpStatements(other).statements.find((s) => s.ttc === 'TTC 268 000')!.text;
    expect(hist).toContain('EXTRA DU FOR 10 DAYS');
  });

  it('names every punishment awarded, not only the ones without a transaction', () => {
    const mixed = baseFormData({
      punishmentDate: '2026-08-16',
      offenses: [{ articleLabel: ART_86_UA, summary: 'x', finding: 'Guilty' }],
      punishments: [
        { code: 'N08', gradeReducedTo: 'LCpl' },
        { code: 'N04', dollarsPerMonth: '250', months: '2' },
        { code: 'N09', days: '10' },
      ],
      suspensions: [],
    });
    const text = mctfsNjpStatements(mixed).statements.find((s) => s.ttc === 'TTC 268 000')!.text;
    expect(text).toContain('REDUCED LCPL');
    expect(text).toContain('EXTRA DU FOR 10 DAYS');
    expect(text.toUpperCase()).toContain('250');
  });

  // Named without its amount rather than dropped. Dropping it would
  // understate the record in a remark MCTFS keeps permanently.
  it('names a punishment item 6 has not finished, without inventing an amount', () => {
    const partial = baseFormData({
      punishmentDate: '2026-08-16',
      offenses: [{ articleLabel: ART_86_UA, summary: 'x', finding: 'Guilty' }],
      punishments: [{ code: 'N09' }],
      suspensions: [],
    });
    const text = mctfsNjpStatements(partial).statements.find((s) => s.ttc === 'TTC 268 000')!.text;
    expect(text).toContain('[AMOUNT]');
    expect(text).toContain('EXTRA DUTIES');
  });

  it('falls back to a named placeholder when there is nothing to report yet', () => {
    const empty = baseFormData({
      punishmentDate: '2026-08-16',
      offenses: [{ articleLabel: '', summary: '', finding: '' }],
      punishments: [],
      suspensions: [],
    });
    const text = mctfsNjpStatements(empty).statements.find((s) => s.ttc === 'TTC 268 000')!.text;
    expect(text).toContain('[VIOLATION ARTICLE AND ALL PUNISHMENT AWARDED]');
  });

  // The option letters are a table read, not an interpretation: item 2's own
  // three strings are byte-identical to the paragraph's vessel option codes.
  it('reads the vessel and lawyer option letters straight off item 2', () => {
    expect(vesselOptionCode(NAVMC_10132_DEMAND.ACCEPT)).toBe('A');
    expect(vesselOptionCode(NAVMC_10132_DEMAND.REFUSE)).toBe('B');
    expect(vesselOptionCode(NAVMC_10132_DEMAND.VESSEL)).toBe('C');
    expect(lawyerOptionCode('have')).toBe('A');
    expect(lawyerOptionCode('have not')).toBe('B');
  });
});
