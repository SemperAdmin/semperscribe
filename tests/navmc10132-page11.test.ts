import { describe, it, expect } from 'vitest';
import type { FormData } from '@/types';
import { createEmptyNavmc10132Data, type Navmc10132Offense } from '@/types/navmc';
import { resolveArticle } from '@/lib/navmc10132-utils';
import {
  counseledDeficiencies,
  gradeAfterNjp,
  guiltyArticleNumbers,
  longestSuspensionMonths,
  nextGradeTitle,
  njpPage11,
  promotionRestrictionEntry,
  separationCounselingEntry,
  NO_SEPARATION_SENTENCE,
  PARAGRAPH_BREAK,
  REBUTTAL_ADVISORY,
  REBUTTAL_CHOICE,
  type CounselingInput,
} from '@/lib/navmc10132-page11';

/**
 * The two NAVMC 118(11) entries an NJP produces.
 *
 * THE ORACLE FOR THE PROMOTION RESTRICTION IS STEPHEN'S OWN WORKED EXAMPLES,
 * supplied 2026-08-26 with IRAM 4006.3e and its three amendments. They are
 * the paragraph applied to an NJP rather than the generic template, and the
 * two of them differ in exactly one variable, the suspension, which is what
 * makes them a test rather than an illustration.
 */

const ART_92 =
  resolveArticle('Art. 92  Failure to obey general order or regulation')?.formLabel ??
  'Art. 92  Failure to obey general order or regulation';
const ART_86 = resolveArticle('Art. 86  Absence without leave')?.formLabel ?? 'Art. 86  Absence without leave';

function offenses(...rows: Partial<Navmc10132Offense>[]): Navmc10132Offense[] {
  const built: Navmc10132Offense[] = Array.from({ length: 5 }, () => ({
    articleLabel: '',
    summary: '',
    finding: '',
  }));
  rows.forEach((row, i) => {
    built[i] = { articleLabel: '', summary: '', finding: '', ...row };
  });
  return built;
}

/** Corporal I. M. Guilty, NJP for Article 92 on 20130501. Stephen's example. */
function guiltyCorporal(overrides: Record<string, unknown> = {}): FormData {
  return {
    documentType: 'navmc10132',
    ...createEmptyNavmc10132Data(),
    accusedName: 'GUILTY, I M',
    accusedEdipi: '1234567890',
    accusedPayGrade: 'E4',
    punishmentDate: '2013-05-01',
    offenses: offenses({ articleLabel: ART_92, summary: 'Failed to obey an order', finding: 'Guilty' }),
    punishments: [{ code: 'N09', days: '14' }],
    suspensions: [],
    ...overrides,
  } as unknown as FormData;
}

const COUNSELING: CounselingInput = {
  correctiveAction: 'comply with all lawful orders',
  assistanceAvailable: 'unit SACO and chaplain',
  intent: 'not-processing',
  processingDetail: '',
};

describe('the promotion restriction, against Stephen\'s worked examples', () => {
  // EXAMPLE (2): no part of the punishment suspended. Three months, 1204.4j.
  it('reproduces the unsuspended example, three months under 1204.4J', () => {
    const result = promotionRestrictionEntry(guiltyCorporal());
    expect(result.kind).toBe('entry');
    if (result.kind !== 'entry') return;
    expect(result.entry.text).toBe(
      '20130501. I UNDERSTAND THAT I AM ELIGIBLE BUT NOT RECOMMENDED FOR PROMOTION TO ' +
        'SERGEANT DUE TO MY RECENT NJP FOR VIOLATION OF ART 92 FOR A PERIOD OF 3 MONTHS IAW ' +
        'MCO P1400.32, PAR 1204.4J, UNLESS WAIVED BY APPROPRIATE AUTHORITY. I WAS ADVISED ' +
        'THAT WITHIN 5 WORKING DAYS AFTER ACKNOWLEDGMENT OF THIS ENTRY, A WRITTEN REBUTTAL ' +
        'CAN BE SUBMITTED AND THIS REBUTTAL WILL BE FILED IN MY OMPF. I CHOOSE (TO) (NOT TO) ' +
        'MAKE A REBUTTAL.',
    );
  });

  // EXAMPLE (1): a portion suspended for six months. Six months, 1204.4k.
  it('reproduces the suspended example, six months under 1204.4K', () => {
    const result = promotionRestrictionEntry(
      guiltyCorporal({ suspensions: [{ punishmentIndex: 0, months: '6' }] }),
    );
    expect(result.kind).toBe('entry');
    if (result.kind !== 'entry') return;
    expect(result.entry.text).toContain('FOR A PERIOD OF 6 MONTHS IAW MCO P1400.32, PAR 1204.4K');
    expect(result.entry.months).toBe(6);
    expect(result.entry.fromSuspension).toBe(true);
  });

  // THE SIX IN HIS EXAMPLE CAME FROM THE SUSPENSION, not from a fixed six.
  // His ruling the same day. A twelve-month suspension is the case that
  // tells the two readings apart, and neither example covers it.
  it('takes the period from the suspension rather than fixing it at six', () => {
    const result = promotionRestrictionEntry(
      guiltyCorporal({ suspensions: [{ punishmentIndex: 0, months: '12' }] }),
    );
    if (result.kind !== 'entry') throw new Error('expected an entry');
    expect(result.entry.months).toBe(12);
    expect(result.entry.text).toContain('FOR A PERIOD OF 12 MONTHS');
    expect(result.entry.paragraph).toBe('1204.4K');
  });

  // THE LONGEST, not the first. A restriction that expired while a
  // suspension was still running would leave the Marine promotable during
  // the period the suspension was meant to hold over them.
  it('runs for the longest suspension when there is more than one', () => {
    const result = promotionRestrictionEntry(
      guiltyCorporal({
        punishments: [{ code: 'N09', days: '14' }, { code: 'N11', limits: 'the barracks', days: '14' }],
        suspensions: [
          { punishmentIndex: 0, months: '3' },
          { punishmentIndex: 1, months: '9' },
        ],
      }),
    );
    if (result.kind !== 'entry') throw new Error('expected an entry');
    expect(result.entry.months).toBe(9);
  });

  it('names every guilty article, deduplicated, and joins more than one', () => {
    const result = promotionRestrictionEntry(
      guiltyCorporal({
        offenses: offenses(
          { articleLabel: ART_86, summary: 'UA', finding: 'Guilty' },
          { articleLabel: ART_92, summary: 'Order', finding: 'Guilty' },
          { articleLabel: ART_86, summary: 'UA again', finding: 'Guilty' },
        ),
      }),
    );
    if (result.kind !== 'entry') throw new Error('expected an entry');
    expect(result.entry.text).toContain('VIOLATION OF ART 86 AND ART 92');
    expect(result.entry.text.match(/ART 86/g)?.length).toBe(1);
  });

  it('names no article that was found not guilty', () => {
    const result = promotionRestrictionEntry(
      guiltyCorporal({
        offenses: offenses(
          { articleLabel: ART_92, summary: 'Order', finding: 'Guilty' },
          { articleLabel: ART_86, summary: 'UA', finding: 'Not Guilty' },
        ),
      }),
    );
    if (result.kind !== 'entry') throw new Error('expected an entry');
    expect(result.entry.text).toContain('ART 92');
    expect(result.entry.text).not.toContain('ART 86');
  });
});

describe('who the promotion restriction is for', () => {
  // IRAM 4006.3e is written for privates through corporals.
  it('is made for every grade from private to corporal', () => {
    for (const [grade, next] of [
      ['E1', 'PRIVATE FIRST CLASS'],
      ['E2', 'LANCE CORPORAL'],
      ['E3', 'CORPORAL'],
      ['E4', 'SERGEANT'],
    ]) {
      const result = promotionRestrictionEntry(guiltyCorporal({ accusedPayGrade: grade }));
      expect(result.kind, grade).toBe('entry');
      if (result.kind === 'entry') expect(result.entry.text).toContain(`PROMOTION TO ${next}`);
    }
  });

  it('is not made for a sergeant, and says which paragraph does not reach them', () => {
    const result = promotionRestrictionEntry(guiltyCorporal({ accusedPayGrade: 'E5' }));
    expect(result.kind).toBe('unavailable');
    if (result.kind !== 'unavailable') return;
    expect(result.reason).toBe('not-corporal-or-below');
    expect(result.detail).toContain('4006.3e');
  });

  /**
   * STEPHEN, 2026-08-26, on a form generated for a Master Sergeant: "where
   * is the right hand side Pg. 11 entry for promotion restriction". It was
   * correctly absent. What the message did not say is the thing that makes
   * the absence make sense: the Marine IS promotion restricted, because
   * MCTFSPRIUM 70503 note 1 posts three months automatically at every grade
   * when the TTC 268 is reported. 4006.3e requires the Page 11 RECORDING
   * that restriction only for corporals and below. Two different things, and
   * a message naming only the first invites the question again.
   */
  it('says the restriction still applies, only the Page 11 entry does not', () => {
    const result = promotionRestrictionEntry(guiltyCorporal({ accusedPayGrade: 'E8' }));
    expect(result.kind).toBe('unavailable');
    if (result.kind !== 'unavailable') return;
    expect(result.detail).toContain('70503 note 1');
    expect(result.detail).toContain('three-month promotion restriction');
    expect(result.detail).toContain('every grade');
  });

  // Every grade above corporal, so the message is not a special case for one.
  it('is not made for any grade above corporal', () => {
    for (const grade of ['E5', 'E6', 'E7', 'E8', 'E9']) {
      const result = promotionRestrictionEntry(guiltyCorporal({ accusedPayGrade: grade }));
      expect(result.kind, grade).toBe('unavailable');
      if (result.kind === 'unavailable') expect(result.reason, grade).toBe('not-corporal-or-below');
    }
  });

  // A REDUCTION MOVES THE GRADE THE RESTRICTION RUNS FROM. A corporal
  // reduced to lance corporal is next eligible for corporal, not sergeant.
  it('reads the grade AFTER an unsuspended reduction', () => {
    const result = promotionRestrictionEntry(
      guiltyCorporal({ punishments: [{ code: 'N08', gradeReducedTo: 'LCpl' }], suspensions: [] }),
    );
    if (result.kind !== 'entry') throw new Error('expected an entry');
    expect(result.entry.text).toContain('PROMOTION TO CORPORAL');
  });

  // A SUSPENDED reduction changes no pay grade, which is the same reason
  // navmc10132-mctfs.ts reports one as history rather than as a TTC 056.
  it('ignores a SUSPENDED reduction, because no pay grade has changed', () => {
    const result = promotionRestrictionEntry(
      guiltyCorporal({
        punishments: [{ code: 'N08', gradeReducedTo: 'LCpl' }],
        suspensions: [{ punishmentIndex: 0, months: '6' }],
      }),
    );
    if (result.kind !== 'entry') throw new Error('expected an entry');
    expect(result.entry.text).toContain('PROMOTION TO SERGEANT');
  });

  it('brings a sergeant reduced to corporal back into the paragraph', () => {
    const result = promotionRestrictionEntry(
      guiltyCorporal({
        accusedPayGrade: 'E5',
        punishments: [{ code: 'N08', gradeReducedTo: 'Cpl' }],
        suspensions: [],
      }),
    );
    expect(result.kind).toBe('entry');
    if (result.kind === 'entry') expect(result.entry.text).toContain('PROMOTION TO SERGEANT');
  });
});

describe('what the promotion restriction refuses to invent', () => {
  // The paragraph states the restriction in months. This app has no rule for
  // rounding days into them, and inventing one would put a period on a
  // service record entry that nobody wrote.
  it('refuses a suspension stated in days rather than converting it', () => {
    const result = promotionRestrictionEntry(
      guiltyCorporal({ suspensions: [{ punishmentIndex: 0, days: '90' }] }),
    );
    expect(result.kind).toBe('unavailable');
    if (result.kind !== 'unavailable') return;
    expect(result.reason).toBe('suspension-not-in-months');
  });

  it('makes no entry with no guilty finding', () => {
    expect(
      promotionRestrictionEntry(guiltyCorporal({ offenses: offenses() })).kind,
    ).toBe('unavailable');
  });

  /**
   * THE DATE STOPPED BEING A REFUSAL ON 2026-08-27, and this pair is the
   * record of why.
   *
   * Stephen, looking at a NAVMC 118(11) where the 6105 had generated and the
   * restriction had not: "pg. 11 right side is not generating as the app does
   * not recognize the item 6 completion." Item 6 WAS complete on that
   * document, N07 for $853; what was missing was the item 6 DATE.
   *
   * Both entries print on ONE form, and the 6105 has always opened with
   * '[DATE]' and listed the gap. Refusing on this side produced a page with
   * one column filled and one empty over the same missing input, which is the
   * app contradicting itself about whether it can proceed.
   *
   * WHAT DID NOT CHANGE is the suspension case above. A missing date is a
   * blank a clerk fills in with a pen. A suspension stated in days leaves the
   * app unable to say whether the entry cites MCO P1400.32 par 1204.4J or
   * 1204.4K, and a service record entry naming the wrong paragraph of the
   * order is worse than no entry at all.
   */
  it('still writes the entry with no date, carrying a named blank', () => {
    const result = promotionRestrictionEntry(guiltyCorporal({ punishmentDate: '' }));
    expect(result.kind).toBe('entry');
    if (result.kind !== 'entry') return;
    expect(result.entry.text).toContain('[DATE]. I UNDERSTAND THAT I AM ELIGIBLE');
    expect(result.entry.missing).toEqual(['the item 6 punishment date, which opens the entry']);
    // Everything the app DOES know is still stated, so the blank is one blank
    // and not a template.
    expect(result.entry.text).toContain('IAW MCO P1400.32, PAR 1204.4J');
    expect(result.entry.months).toBe(3);
  });

  it('reports no gap and no placeholder once the date is set', () => {
    const result = promotionRestrictionEntry(guiltyCorporal({ punishmentDate: '2026-08-26' }));
    expect(result.kind).toBe('entry');
    if (result.kind !== 'entry') return;
    expect(result.entry.missing).toEqual([]);
    expect(result.entry.text).not.toContain('[DATE]');
    expect(result.entry.text).toContain('20260826.');
  });

  it('makes no entry when item 19 carries no pay grade', () => {
    const result = promotionRestrictionEntry(guiltyCorporal({ accusedPayGrade: '' }));
    expect(result.kind).toBe('unavailable');
    if (result.kind === 'unavailable') expect(result.reason).toBe('no-grade');
  });
});

describe('the 6105 counseling entry, IRAM 4006.2r', () => {
  it('opens with the date and states the deficiencies from the guilty findings', () => {
    const entry = separationCounselingEntry(guiltyCorporal(), COUNSELING);
    expect(entry.text.startsWith('20130501. Counseled this date concerning deficiencies;')).toBe(
      true,
    );
    expect(entry.text).toContain('Art. 92');
    expect(entry.text).toContain('Failed to obey an order');
  });

  // A row found Not Guilty is not a deficiency the Marine is counseled for.
  // Putting one in a service record entry records misconduct nobody found.
  it('counsels no deficiency that was found not guilty', () => {
    const entry = separationCounselingEntry(
      guiltyCorporal({
        offenses: offenses(
          { articleLabel: ART_92, summary: 'Order', finding: 'Guilty' },
          { articleLabel: ART_86, summary: 'Three days UA', finding: 'Not Guilty' },
        ),
      }),
      COUNSELING,
    );
    expect(entry.text).toContain('Art. 92');
    expect(entry.text).not.toContain('Three days UA');
  });

  it('carries the corrective action and the assistance available', () => {
    const entry = separationCounselingEntry(guiltyCorporal(), COUNSELING);
    expect(entry.text).toContain('comply with all lawful orders');
    expect(entry.text).toContain('unit SACO and chaplain');
    expect(entry.missing).toEqual([]);
  });

  // Neither is on a NAVMC 10132, so an empty one is ordinary state rather
  // than a bug. It gets a named blank and a line in `missing`, never a
  // silently short entry.
  it('names its own blanks rather than printing a counseling entry that counsels nothing', () => {
    const entry = separationCounselingEntry(guiltyCorporal(), {
      ...COUNSELING,
      correctiveAction: '',
      assistanceAvailable: '',
    });
    expect(entry.text).toContain('[CORRECTIVE ACTION]');
    expect(entry.text).toContain('[ASSISTANCE AVAILABLE]');
    expect(entry.missing.some((m) => m.includes('corrective action'))).toBe(true);
    expect(entry.missing.some((m) => m.includes('assistance available'))).toBe(true);
  });

  // 4006.2r requires ONE of two statements. Not processing prints the
  // paragraph's own sentence, verbatim.
  it('prints the paragraph\'s own sentence when no separation is contemplated', () => {
    const entry = separationCounselingEntry(guiltyCorporal(), COUNSELING);
    expect(entry.text).toContain(NO_SEPARATION_SENTENCE);
  });

  it('states what the Marine is being processed for instead, when they are', () => {
    const entry = separationCounselingEntry(guiltyCorporal(), {
      ...COUNSELING,
      intent: 'processing',
      processingDetail: 'administrative separation for a pattern of misconduct',
    });
    expect(entry.text).toContain('administrative separation for a pattern of misconduct');
    expect(entry.text).not.toContain(NO_SEPARATION_SENTENCE);
  });

  it('carries neither statement, and says so, until the commander decides', () => {
    const entry = separationCounselingEntry(guiltyCorporal(), { ...COUNSELING, intent: '' });
    expect(entry.text).toContain('[SEPARATION PROCESSING STATEMENT, IRAM 4006.2R]');
    expect(entry.text).not.toContain(NO_SEPARATION_SENTENCE);
    expect(entry.missing.some((m) => m.includes('4006.2r'))).toBe(true);
  });

  // PAA 12/11 replaced the rebuttal advisory across Page 11 counseling
  // entries when e-Records made the SRB obsolete. 4006.2r as printed still
  // says the document side of the SRB. See the module header.
  it('uses the OMPF rebuttal advisory, not the SRB wording 4006.2r still prints', () => {
    const entry = separationCounselingEntry(guiltyCorporal(), COUNSELING);
    expect(entry.text).toContain('filed in my OMPF');
    expect(entry.text).not.toContain('document side of the SRB');
  });

  // The Marine strikes one at acknowledgment. An app that picked one would
  // be recording an election nobody made.
  it('leaves both rebuttal options standing on both entries', () => {
    const page = njpPage11(guiltyCorporal(), COUNSELING);
    expect(page.remarksLeft).toContain('I choose (to) (not to) make a rebuttal.');
    expect(page.remarksRight).toContain('I CHOOSE (TO) (NOT TO) MAKE A REBUTTAL.');
  });
});

describe('the two entries on one form', () => {
  it('puts the 6105 left and the restriction right, with the Marine identified', () => {
    const page = njpPage11(guiltyCorporal(), COUNSELING);
    expect(page.remarksLeft).toContain('Counseled this date concerning deficiencies');
    expect(page.remarksRight).toContain('NOT RECOMMENDED FOR PROMOTION');
    expect(page.name).toBe('GUILTY, I M');
    expect(page.edipi).toBe('1234567890');
    expect(page.restrictionOmitted).toBeNull();
  });

  /**
   * THE DEFECT STEPHEN REPORTED ON 2026-08-27, at form level.
   *
   * His document: Cpl/E-4, Art. 123 found Guilty, N07 for $853 imposed, item
   * 6 carrying no date. The 6105 generated with '[DATE]'. The restriction
   * generated nothing at all. One NAVMC 118(11), one column filled.
   *
   * ASSERTED AS A PAIR, because either half alone passes on a broken build.
   * A test that only checked the right column is non-empty would pass on an
   * app that silently invented a date, and one that only checked the gap is
   * reported would pass on the old refusing behaviour.
   */
  it('fills BOTH columns when item 6 carries a punishment but no date', () => {
    const page = njpPage11(guiltyCorporal({ punishmentDate: '' }), COUNSELING);

    expect(page.remarksLeft).toContain('[DATE]. Counseled this date');
    expect(page.remarksRight).toContain('[DATE]. I UNDERSTAND THAT I AM ELIGIBLE');
    expect(page.restrictionOmitted).toBeNull();
  });

  // ONE GAP, NOT TWO. Both entries open with the same date and word the gap
  // identically, so a clerk who left it unset is told once.
  it('reports the shared date gap a single time across both columns', () => {
    const page = njpPage11(guiltyCorporal({ punishmentDate: '' }), COUNSELING);
    const dateGaps = page.missing.filter((gap) => gap.includes('item 6 punishment date'));
    expect(dateGaps).toHaveLength(1);
  });

  it('reports no date gap and no placeholder once the date is set', () => {
    const page = njpPage11(guiltyCorporal({ punishmentDate: '2026-08-26' }), COUNSELING);
    expect(page.missing.filter((gap) => gap.includes('item 6 punishment date'))).toEqual([]);
    expect(page.remarksLeft).not.toContain('[DATE]');
    expect(page.remarksRight).not.toContain('[DATE]');
  });

  // AN EMPTY RIGHT COLUMN IS USUALLY CORRECT rather than a failure, so the
  // reason travels with it.
  it('leaves the right column empty for a sergeant and says why', () => {
    const page = njpPage11(guiltyCorporal({ accusedPayGrade: 'E5' }), COUNSELING);
    expect(page.remarksRight).toBe('');
    expect(page.restrictionOmitted).toContain('4006.3e');
    // The counseling entry is still made: 4006.2r reaches every grade.
    expect(page.remarksLeft).toContain('Counseled this date');
  });
});

describe('the helpers, on the cases the entries above do not reach', () => {
  it('nextGradeTitle walks the enlisted table and stops at the top', () => {
    expect(nextGradeTitle('E4')).toBe('SERGEANT');
    expect(nextGradeTitle('E-4')).toBe('SERGEANT');
    expect(nextGradeTitle('e4')).toBe('SERGEANT');
    expect(nextGradeTitle('E9')).toBe('');
    expect(nextGradeTitle('')).toBe('');
    expect(nextGradeTitle('O3')).toBe('');
  });

  it('longestSuspensionMonths ignores a period stated in days', () => {
    expect(longestSuspensionMonths(guiltyCorporal())).toBeNull();
    expect(
      longestSuspensionMonths(guiltyCorporal({ suspensions: [{ punishmentIndex: 0, days: '90' }] })),
    ).toBeNull();
    expect(
      longestSuspensionMonths(guiltyCorporal({ suspensions: [{ punishmentIndex: 0, months: '6' }] })),
    ).toBe(6);
  });

  it('gradeAfterNjp falls back to item 19 when nothing reduces it', () => {
    expect(gradeAfterNjp(guiltyCorporal())).toBe('E4');
  });

  it('guiltyArticleNumbers and counseledDeficiencies read the same rows', () => {
    const formData = guiltyCorporal();
    expect(guiltyArticleNumbers(formData)).toEqual(['92']);
    expect(counseledDeficiencies(formData)).toHaveLength(1);
  });

  it('REBUTTAL_ADVISORY is one sentence pair, used by the left column verbatim', () => {
    expect(separationCounselingEntry(guiltyCorporal(), COUNSELING).text).toContain(
      REBUTTAL_ADVISORY,
    );
  });
});

// ---------------------------------------------------------------------------
// THE PARAGRAPH BREAKS.
//
// STEPHEN, 2026-08-26: "we should have hard spaces in the Pg. 11", with the
// breaks laid out sentence by sentence. The entry used to print as one
// unbroken block, which on a Page 11 is a wall of text a Marine signs
// without reading.
// ---------------------------------------------------------------------------
describe('the 6105 prints as paragraphs', () => {
  const blank: CounselingInput = {
    correctiveAction: '',
    assistanceAvailable: '',
    intent: 'not-processing',
    processingDetail: '',
  };

  it('breaks into the five paragraphs Stephen laid out, in that order', () => {
    const entry = separationCounselingEntry(guiltyCorporal(), blank);
    expect(entry.paragraphs).toHaveLength(5);
    expect(entry.paragraphs[0].startsWith('20130501. Counseled this date')).toBe(true);
    // The corrective action closes the FIRST paragraph. Date, deficiencies
    // and what to do about them are one thought.
    expect(entry.paragraphs[0]).toContain('Recommended corrective action:');
    expect(entry.paragraphs[1].startsWith('Assistance available:')).toBe(true);
    expect(entry.paragraphs[2]).toBe(NO_SEPARATION_SENTENCE);
    expect(entry.paragraphs[3]).toBe(REBUTTAL_ADVISORY);
    expect(entry.paragraphs[4]).toBe(REBUTTAL_CHOICE);
  });

  it('joins them with a blank line, and the text is the paragraphs', () => {
    const entry = separationCounselingEntry(guiltyCorporal(), blank);
    expect(entry.text).toBe(entry.paragraphs.join(PARAGRAPH_BREAK));
    expect(entry.text.split(PARAGRAPH_BREAK)).toHaveLength(5);
    // No paragraph runs into the next.
    for (const paragraph of entry.paragraphs) {
      expect(paragraph.trim()).toBe(paragraph);
      expect(paragraph).not.toContain('\n');
    }
  });

  // The election is the one sentence the Marine acts on. Buried at the end
  // of the advisory paragraph it is easy to sign past.
  it('puts the rebuttal election on its own paragraph', () => {
    const entry = separationCounselingEntry(guiltyCorporal(), blank);
    expect(REBUTTAL_ADVISORY).not.toContain('I choose');
    expect(entry.paragraphs[entry.paragraphs.length - 1]).toBe(REBUTTAL_CHOICE);
  });

  it('keeps five paragraphs when the commander is processing for separation', () => {
    const entry = separationCounselingEntry(guiltyCorporal(), {
      ...blank,
      intent: 'processing',
      processingDetail: 'administrative separation',
    });
    expect(entry.paragraphs).toHaveLength(5);
    expect(entry.paragraphs[2]).toContain('administrative separation');
  });

  /**
   * THE BREAKS HAVE TO REACH THE PRINTED FORM. xfaEscape turns a newline
   * into &#xD;, the carriage return an XFA multiline field breaks on. A
   * version of this that stripped them would look right in the panel and
   * print as one block, which is the defect being fixed.
   */
  it('survives into the NAVMC 118(11) datasets as carriage returns', async () => {
    const { buildNavmc11811Xml } = await import('@/lib/xfa-form-fill');
    const page = njpPage11(guiltyCorporal(), blank);
    const xml = buildNavmc11811Xml({
      documentType: 'page11',
      name: page.name,
      edipi: page.edipi,
      remarksLeft: page.remarksLeft,
      remarksRight: page.remarksRight,
    } as unknown as FormData);
    // Four blank lines between five paragraphs, each a doubled carriage
    // return, and no raw newline left in the XML.
    expect(xml.match(/&#xD;&#xD;/g)).toHaveLength(4);
    expect(xml).not.toContain('\n');
  });

  /**
   * THE RIGHT COLUMN IS DELIBERATELY LEFT AS ONE BLOCK. Stephen's two worked
   * examples for 4006.3e print the promotion restriction as a single
   * flowing entry, and those examples are what this reproduces byte for
   * byte. Breaking it would be a better-looking entry that no longer matches
   * the source it was built from.
   */
  it('leaves the promotion restriction unbroken, as its own source prints it', () => {
    const page = njpPage11(guiltyCorporal(), blank);
    expect(page.remarksRight).not.toContain(PARAGRAPH_BREAK);
  });
});
