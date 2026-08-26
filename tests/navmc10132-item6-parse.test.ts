import { describe, it, expect } from 'vitest';
import { NAVMC_10132_PUNISHMENTS, releaseOnePunishmentsFor } from '@/lib/navmc10132-punishments';
import { renderPunishment } from '@/lib/navmc10132-punishment-render';
import {
  compileTemplate,
  narrowCandidates,
  parseItem6,
  splitItem6,
} from '@/lib/navmc10132-item6-parse';

/**
 * Reading item 6 back off a signed form.
 *
 * THE ORACLE IS THE RENDERER. Every case below renders a punishment through
 * the same function that writes item 6 onto the form and then reads the
 * result back, so these assert a ROUND TRIP rather than a hand-written
 * sentence. A hand-written fixture would go stale the moment a template
 * changed, and would test this module against my transcription rather than
 * against what the app actually prints.
 *
 * TWO OF THIS MODULE'S OWN RULES WERE WRONG ON FIRST WRITING and the round
 * trip is what found them, which is the reason it is built this way. Both
 * have a test below named for the wrong answer they produced.
 */

/** A captain: company grade. Item 8A on Stephen's own file. */
const COMPANY = 'O3';
/** A lieutenant colonel: field grade. */
const FIELD = 'O5';

describe('the templates compile', () => {
  it('compiles every punishment in the table without an unknown placeholder', () => {
    expect(NAVMC_10132_PUNISHMENTS.length).toBeGreaterThan(10);
    for (const punishment of NAVMC_10132_PUNISHMENTS) {
      expect(() => compileTemplate(punishment), punishment.code).not.toThrow();
    }
  });

  // The patterns are built FROM the table, so a template naming a
  // placeholder with no pattern must fail loudly. Matching nothing would
  // read as "no punishment on the form".
  it('refuses a template naming a placeholder it has no pattern for', () => {
    expect(() =>
      compileTemplate({
        ...NAVMC_10132_PUNISHMENTS[0],
        template: 'Something for {aPlaceholderNobodyDefined}.',
      }),
    ).toThrow(/no pattern/);
  });
});

describe('a punishment survives the round trip where the sentence names it', () => {
  const unique: Array<[string, Record<string, unknown>]> = [
    ['N07', { dollars: '100' }],
    ['N08', { gradeReducedTo: 'LCpl' }],
    ['N04', { dollarsPerMonth: '853', months: '2' }],
    ['N03', { days: '20' }],
    ['N16', { oralOrWritten: 'in writing' }],
    ['N17', { oralOrWritten: 'orally' }],
  ];

  it.each(unique)('reads %s back from its own rendered text', (code, params) => {
    const entry = { code, ...params } as never;
    const text = renderPunishment([entry]).text;
    const parse = parseItem6(text, { authorityPayGrade: COMPANY });
    expect(parse.complete, text).toBe(true);
    expect(parse.entries[0].code).toBe(code);
    // And every parameter came back.
    for (const [key, value] of Object.entries(params)) {
      expect((parse.entries[0] as unknown as Record<string, unknown>)[key], `${code}.${key}`).toBe(value);
    }
  });

  // STEPHEN'S OWN FILE, 2026-08-26. This is the sentence that read as
  // "Nothing to render yet".
  it('reads "Forf of $100 pay." as N07 with the amount', () => {
    const parse = parseItem6('Forf of $100 pay.', { authorityPayGrade: COMPANY });
    expect(parse.complete).toBe(true);
    expect(parse.entries).toEqual([{ code: 'N07', dollars: '100' }]);
  });

  it('strips the thousands separator off a rendered amount', () => {
    const text = renderPunishment([{ code: 'N07', dollars: '1500' } as never]).text;
    const parse = parseItem6(text, { authorityPayGrade: COMPANY });
    expect(parse.entries[0]).toEqual({ code: 'N07', dollars: '1500' });
  });
});

describe('more than one punishment', () => {
  it('splits, un-lowercases and reads back every clause', () => {
    const entries = [
      { code: 'N07', dollars: '100' },
      { code: 'N09', days: '10' },
    ] as never[];
    const text = renderPunishment(entries).text;
    const parse = parseItem6(text, { authorityPayGrade: COMPANY });
    expect(parse.complete, text).toBe(true);
    expect(parse.entries.map((e) => e.code)).toEqual(['N07', 'N09']);
  });

  it('recovers the concurrent flag from the sentence\'s own suffix', () => {
    const entries = [
      { code: 'N07', dollars: '100' },
      { code: 'N09', days: '10' },
    ] as never[];
    expect(parseItem6(renderPunishment(entries, { concurrent: true }).text, {
      authorityPayGrade: COMPANY,
    }).concurrent).toBe(true);
    expect(parseItem6(renderPunishment(entries, { concurrent: false }).text, {
      authorityPayGrade: COMPANY,
    }).concurrent).toBe(false);
  });

  // ONE SENTENCE, ONE PUNISHMENT SET. Loading two of three clauses would put
  // a UPB in the app stating less than the signed form states.
  it('returns NO entries when any one clause fails, not the ones that worked', () => {
    const parse = parseItem6('Forf of $100 pay, and extra du for 10 days.', {
      authorityPayGrade: FIELD, // extra du is ambiguous at field grade
    });
    expect(parse.complete).toBe(false);
    expect(parse.entries).toEqual([]);
    // The clause that did resolve still says so, for the report.
    expect(parse.clauses[0].code).toBe('N07');
    expect(parse.clauses[1].code).toBe('');
  });

  it('splitItem6 restores each clause\'s capital and period', () => {
    expect(splitItem6('Forf of $100 pay, and extra du for 10 days.').clauses).toEqual([
      'Forf of $100 pay.',
      'Extra du for 10 days.',
    ]);
  });
});

describe('what it refuses to guess', () => {
  // Four groups of codes share a template byte for byte. "Extra du for 10
  // days." is N09 or N13 and the sentence cannot say which.
  it('refuses an ambiguous clause when item 8A does not narrow it', () => {
    const parse = parseItem6('Extra du for 10 days.', { authorityPayGrade: FIELD });
    expect(parse.complete).toBe(false);
    expect(parse.clauses[0].matched).toEqual(['N09', 'N13']);
    expect(parse.clauses[0].candidates).toEqual(['N09', 'N13']);
    expect(parse.clauses[0].reason).toContain('statistical record');
  });

  it('resolves the same clause once item 8A rules the field-grade code out', () => {
    const parse = parseItem6('Extra du for 10 days.', { authorityPayGrade: COMPANY });
    expect(parse.complete).toBe(true);
    expect(parse.entries[0].code).toBe('N09');
  });

  it('refuses everything when item 8A is unset, rather than taking the first match', () => {
    const parse = parseItem6('Extra du for 10 days.');
    expect(parse.complete).toBe(false);
    expect(parse.clauses[0].candidates.length).toBeGreaterThan(1);
  });

  it('refuses a clause no template matches at all', () => {
    const parse = parseItem6('Reduced to E-3 and told to sort himself out.');
    expect(parse.complete).toBe(false);
    expect(parse.clauses[0].matched).toEqual([]);
    expect(parse.clauses[0].reason).toContain('typed by hand');
  });
});

describe('the two narrowing rules, each named for the wrong answer it gave', () => {
  /**
   * FOUND BY THE ROUND TRIP, NOT BY READING THE CALL.
   * releaseOnePunishmentsFor returns EVERY code with an `available` flag,
   * because the picker offers the ones a commander may not impose and
   * disables them rather than hiding them. The first version read the list
   * without the flag, which accepted every code: a 25-day restriction
   * imposed by a captain resolved to N14, a FIELD-GRADE code that captain
   * could not impose.
   */
  it('narrows on availability, so a company grade authority never yields a field-grade code', () => {
    // Only where there is a choice to make. Each pair below is a real
    // ambiguity in the table: same template, one company grade and one
    // field grade.
    expect(narrowCandidates(['N09', 'N13'], 10, COMPANY)).toEqual(['N09']);
    expect(narrowCandidates(['N06', 'N12'], 5, COMPANY)).toEqual(['N06']);
  });

  it('keeps a field-grade code for a field-grade authority', () => {
    expect(narrowCandidates(['N09', 'N13'], 30, FIELD)).toEqual(['N13']);
  });

  /**
   * A UNIQUE TEMPLATE IS THE ANSWER, whatever item 8A says. An earlier
   * version rejected here, which lost an N04 off a form because item 8A read
   * company grade: that is a problem with item 8A, and the validators say
   * so. This module's job is to read the form, not to judge it.
   */
  it('reads a code the sentence names uniquely, even against item 8A', () => {
    expect(narrowCandidates(['N04'], null, COMPANY)).toEqual(['N04']);
    const parse = parseItem6('Forf of $250 pay per month for 2 months. Total forf $500.', {
      authorityPayGrade: COMPANY,
    });
    expect(parse.complete).toBe(true);
    expect(parse.entries[0].code).toBe('N04');
  });

  it('reads a unique code whose stated period is over its own ceiling', () => {
    // N03 allows 30 days. Forty is unlawful, and it is still an N03: the
    // sentence names no other code. V-XX flags the overage.
    const parse = parseItem6('Arrest in quarters for 40 days.', { authorityPayGrade: FIELD });
    expect(parse.complete).toBe(true);
    expect(parse.entries[0]).toEqual({ code: 'N03', days: '40' });
  });

  /**
   * ALSO FOUND BY THE ROUND TRIP. The first version kept the previous
   * candidates when the ceiling ruled all of them out, reasoning that a
   * punishment over its own limit is the form's problem. That turned a
   * 25-day restriction narrowed to N10 alone, whose ceiling is 14 days, into
   * a resolved N10: a code the sentence contradicts.
   */
  it('returns nothing when the period exceeds every candidate\'s ceiling', () => {
    // N10 allows 14 days and N11 allows 14. Twenty-five is neither, and
    // there were two to choose between, so this does not fall back.
    expect(narrowCandidates(['N10', 'N11'], 25, '')).toEqual([]);
  });

  it('says so on the clause rather than resolving it', () => {
    const parse = parseItem6('Restr to the limits of the barracks for 25 days, w/susp fr du.', {
      authorityPayGrade: COMPANY,
    });
    expect(parse.complete).toBe(false);
    expect(parse.clauses[0].candidates).toEqual([]);
    expect(parse.clauses[0].reason).toContain('longer than any of them allows');
  });

  it('keeps a code whose period is inside its ceiling', () => {
    expect(narrowCandidates(['N10', 'N14'], 14, '')).toEqual(['N10', 'N14']);
    expect(narrowCandidates(['N07'], null, '')).toEqual(['N07']);
  });
});

describe('the round trip over the whole table', () => {
  /**
   * EVERY code rendered and read back at a field-grade authority, which is
   * the widest set. This does not assert every code RESOLVES, because four
   * groups genuinely cannot; it asserts that no code ever resolves to a
   * DIFFERENT code, which is the failure that would reach MCTFS.
   */
  it('never resolves a clause to a code other than the one that wrote it', () => {
    // SCOPED TO THE CODES THE APP CAN ACTUALLY IMPOSE. N01 and N02 are
    // officer punishments this release does not offer, and they share a
    // template with N10/N11/N14/N15. A form the app wrote can never carry an
    // N01 clause, so asserting that one reads back as N01 would be asserting
    // about a document this app cannot produce.
    const sample: Record<string, Record<string, unknown>> = {
      limits: { limits: 'the barracks' },
      days: { days: '5' },
      months: { months: '2' },
      dollars: { dollars: '100' },
      dollarsPerMonth: { dollarsPerMonth: '250' },
      gradeReducedTo: { gradeReducedTo: 'LCpl' },
      oralOrWritten: { oralOrWritten: 'in writing' },
      suspendedFromDuty: { suspendedFromDuty: true },
    };
    let resolved = 0;
    for (const punishment of NAVMC_10132_PUNISHMENTS) {
      const entry: Record<string, unknown> = { code: punishment.code };
      for (const parameter of punishment.parameters) Object.assign(entry, sample[parameter] ?? {});
      const text = renderPunishment([entry as never]).text;
      for (const authority of [COMPANY, FIELD, '']) {
        const offerable = releaseOnePunishmentsFor(authority || FIELD).some(
          (option) => option.punishment.code === punishment.code && option.available,
        );
        if (!offerable) continue;
        const parse = parseItem6(text, { authorityPayGrade: authority });
        const got = parse.clauses[0]?.code ?? '';
        if (got === '') continue;
        resolved += 1;
        expect(got, `${punishment.code} at ${authority || 'no authority'}: "${text}"`).toBe(
          punishment.code,
        );
      }
    }
    // Guards the guard: a parser that resolved nothing would pass the loop.
    expect(resolved).toBeGreaterThan(10);
  });
});
