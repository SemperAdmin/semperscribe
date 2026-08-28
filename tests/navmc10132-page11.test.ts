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
  PAGE11_DATE_GAP,
  SIGNATURE_BLOCK,
  DISCHARGE_CONSEQUENCES_SENTENCE,
  DRUG_RESTRICTION_OFFENSE_LABELS,
  DRUG_RESTRICTION_MONTHS,
  DRUG_RESTRICTION_DATE_GAP,
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

/**
 * Corporal I. M. Guilty, NJP for Article 92 on 20130501. Stephen's example.
 *
 * BOTH DATES ARE SET, AND THEY DIFFER, which is deliberate. Stephen ruled on
 * 2026-08-27 that "item 10 is the date of NJP" for the Page 11, so a fixture
 * carrying only one date could not tell a correct entry from one still
 * reading item 6. Item 10 is the day after item 6 here, as a notice of final
 * disposition ordinarily is.
 */
function guiltyCorporal(overrides: Record<string, unknown> = {}): FormData {
  return {
    documentType: 'navmc10132',
    ...createEmptyNavmc10132Data(),
    accusedName: 'GUILTY, I M',
    accusedEdipi: '1234567890',
    accusedPayGrade: 'E4',
    punishmentDate: '2013-04-30',
    dispositionNoticeDate: '2013-05-01',
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
    // VERBATIM AGAINST STEPHEN'S 2026-08-27 TEXT, whole string rather than
    // toContain, because this entry goes verbatim onto a service record and
    // a substring assertion passes on a sentence with extra words in it.
    // The date is item 10's, 20130501, not item 6's 20130430.
    expect(result.entry.text).toBe(
      '20130501. ' +
        'I understand that I am eligible but not recommended for promotion to sergeant due ' +
        'to my recent NJP for violation of art 92 for a period of 3 months IAW MCO P1400.32, ' +
        'par 1204.4j, unless waived by appropriate authority. I was advised that within 5 ' +
        'working days after acknowledgment of this entry, a written rebuttal can be ' +
        'submitted, and this rebuttal will be filed in my OMPF. I choose (to) (not to) make ' +
        `a rebuttal.\n\n\n${SIGNATURE_BLOCK}`,
    );
  });

  // EXAMPLE (1): a portion suspended for six months. Six months, 1204.4k.
  it('reproduces the suspended example, six months under 1204.4K', () => {
    const result = promotionRestrictionEntry(
      guiltyCorporal({ suspensions: [{ punishmentIndex: 0, months: '6' }] }),
    );
    expect(result.kind).toBe('entry');
    if (result.kind !== 'entry') return;
    expect(result.entry.text).toContain('for a period of 6 months IAW MCO P1400.32, par 1204.4k');
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
    expect(result.entry.text).toContain('for a period of 12 months');
    expect(result.entry.paragraph).toBe('1204.4k');
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
    expect(result.entry.text).toContain('violation of art 86 and art 92');
    expect(result.entry.text.match(/art 86/g)?.length).toBe(1);
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
    expect(result.entry.text).toContain('art 92');
    expect(result.entry.text).not.toContain('art 86');
  });
});

describe('who the promotion restriction is for', () => {
  // IRAM 4006.3e is written for privates through corporals.
  it('is made for every grade from private to corporal', () => {
    for (const [grade, next] of [
      ['E1', 'private first class'],
      ['E2', 'lance corporal'],
      ['E3', 'corporal'],
      ['E4', 'sergeant'],
    ]) {
      const result = promotionRestrictionEntry(guiltyCorporal({ accusedPayGrade: grade }));
      expect(result.kind, grade).toBe('entry');
      if (result.kind === 'entry') expect(result.entry.text).toContain(`promotion to ${next}`);
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
    expect(result.entry.text).toContain('promotion to corporal');
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
    expect(result.entry.text).toContain('promotion to sergeant');
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
    if (result.kind === 'entry') expect(result.entry.text).toContain('promotion to sergeant');
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
    const result = promotionRestrictionEntry(guiltyCorporal({ dispositionNoticeDate: '' }));
    expect(result.kind).toBe('entry');
    if (result.kind !== 'entry') return;
    expect(result.entry.text).toContain('[DATE]. I understand that I am eligible');
    expect(result.entry.missing).toEqual([PAGE11_DATE_GAP]);
    // Everything the app DOES know is still stated, so the blank is one blank
    // and not a template.
    expect(result.entry.text).toContain('IAW MCO P1400.32, par 1204.4j');
    expect(result.entry.months).toBe(3);
  });

  it('reports no gap and no placeholder once the date is set', () => {
    const result = promotionRestrictionEntry(guiltyCorporal({ dispositionNoticeDate: '2026-08-26' }));
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
  // THE DATE IS ITEM 10'S. Stephen, 2026-08-27: "item 10 is the date of NJP".
  // The fixture carries item 6 as 20130430 and item 10 as 20130501, so an
  // entry still reading item 6 fails here rather than passing on a document
  // where the two happen to agree.
  it('opens with the item 10 date and states the deficiencies from the guilty findings', () => {
    const entry = separationCounselingEntry(guiltyCorporal(), COUNSELING);
    expect(
      entry.text.startsWith('20130501. Counseled this date concerning the following deficiencies:'),
    ).toBe(true);
    expect(entry.text).not.toContain('20130430');
    expect(entry.text).toContain('Art. 92');
    expect(entry.text).toContain('Failed to obey an order');
  });

  // THE SAME RULE ON THE OTHER SIDE, asserted at the same place so a reader
  // sees the pair. Item 6 drives the unit diary and every MCTFS DOA and ED,
  // and this ruling did not touch those; see page11Date.
  it('opens the promotion restriction with the item 10 date too', () => {
    const result = promotionRestrictionEntry(guiltyCorporal());
    if (result.kind !== 'entry') throw new Error('expected an entry');
    expect(result.entry.text.startsWith('20130501.')).toBe(true);
    expect(result.entry.text).not.toContain('20130430');
  });

  // THE CONSEQUENCES SENTENCE IS UNCONDITIONAL in Stephen's layout, sitting
  // at the tail of paragraph 2 whether or not anybody is being processed. It
  // warns the Marine what a less-than-honorable characterization costs them,
  // and that does not depend on today's intent.
  it('states the discharge consequences on both separation branches', () => {
    for (const intent of ['not-processing', 'processing'] as const) {
      const entry = separationCounselingEntry(guiltyCorporal(), {
        ...COUNSELING,
        intent,
        processingDetail: 'administrative separation',
      });
      expect(entry.text, intent).toContain(DISCHARGE_CONSEQUENCES_SENTENCE);
    }
  });

  // BOTH ENTRIES CLOSE WITH THE ACKNOWLEDGMENT LINES, Stephen 2026-08-27. A
  // NAVMC 118(11) column holds more than one entry over a career, so the
  // signature lines belong to the entry rather than to the page.
  it('closes both entries with the signature block', () => {
    const page = njpPage11(guiltyCorporal(), COUNSELING);
    expect(page.remarksLeft.endsWith(SIGNATURE_BLOCK)).toBe(true);
    expect(page.remarksRight.endsWith(SIGNATURE_BLOCK)).toBe(true);
    // A blank line stands between the last sentence and the lines, so the
    // signature does not read as part of the rebuttal paragraph.
    expect(page.remarksLeft).toContain('make a rebuttal.\n\n\n_____');
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

  // ONE SENTENCE NOW, not two paragraphs. Stephen's 2026-08-27 layout runs
  // the corrective action and the assistance together: "Specific
  // recommendations for corrective action are X and to seek assistance,
  // which is available through the chain of command and Y."
  it('carries the corrective action and the assistance available in one sentence', () => {
    const entry = separationCounselingEntry(guiltyCorporal(), COUNSELING);
    expect(entry.text).toContain(
      'Specific recommendations for corrective action are comply with all lawful orders and ' +
        'to seek assistance, which is available through the chain of command and unit SACO ' +
        'and chaplain.',
    );
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

  /**
   * PAA 12/11 replaced the rebuttal advisory across Page 11 counseling
   * entries when e-Records made the SRB obsolete. 4006.2r as printed still
   * says the document side of the SRB.
   *
   * THE TWO COLUMNS WORD IT DIFFERENTLY, AND THAT IS NOT AN OVERSIGHT.
   * Stephen sent both in one message on 2026-08-27. The 6105 says
   * "acknowledging this entry I may submit a written rebuttal which will be
   * filed in the electronic service record"; the promotion restriction says
   * "acknowledgment of this entry, a written rebuttal can be submitted, and
   * this rebuttal will be filed in my OMPF". They rest on different
   * paragraphs, 4006.2r and 4006.3e. Asserted as a contrast so nobody
   * harmonises them into one constant.
   */
  it('uses the SRB-free advisory, worded per column', () => {
    const page = njpPage11(guiltyCorporal(), COUNSELING);

    expect(page.remarksLeft).toContain(
      'within 5 working days after acknowledging this entry I may submit a written rebuttal ' +
        'which will be filed in the electronic service record.',
    );
    expect(page.remarksRight).toContain(
      'within 5 working days after acknowledgment of this entry, a written rebuttal can be ' +
        'submitted, and this rebuttal will be filed in my OMPF.',
    );

    expect(page.remarksLeft).not.toContain('OMPF');
    expect(page.remarksRight).not.toContain('electronic service record');
    expect(page.remarksLeft).not.toContain('document side of the SRB');
    expect(page.remarksRight).not.toContain('document side of the SRB');
  });

  // The Marine strikes one at acknowledgment. An app that picked one would
  // be recording an election nobody made. Sentence case on both sides now,
  // per Stephen's 2026-08-27 ruling on the right column.
  it('leaves both rebuttal options standing on both entries', () => {
    const page = njpPage11(guiltyCorporal(), COUNSELING);
    expect(page.remarksLeft).toContain('I choose (to) (not to) make a rebuttal.');
    expect(page.remarksRight).toContain('I choose (to) (not to) make a rebuttal.');
    expect(page.remarksRight).not.toContain('I CHOOSE (TO) (NOT TO)');
  });
});

describe('the two entries on one form', () => {
  it('puts the 6105 left and the restriction right, with the Marine identified', () => {
    const page = njpPage11(guiltyCorporal(), COUNSELING);
    expect(page.remarksLeft).toContain('Counseled this date concerning the following deficiencies');
    expect(page.remarksRight).toContain('not recommended for promotion');
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
    const page = njpPage11(guiltyCorporal({ dispositionNoticeDate: '' }), COUNSELING);

    expect(page.remarksLeft).toContain('[DATE]. Counseled this date');
    expect(page.remarksRight).toContain('[DATE]. I understand that I am eligible');
    expect(page.restrictionOmitted).toBeNull();
  });

  // ONE GAP, NOT TWO. Both entries open with the same date and word the gap
  // identically, so a clerk who left it unset is told once.
  it('reports the shared date gap a single time across both columns', () => {
    const page = njpPage11(guiltyCorporal({ dispositionNoticeDate: '' }), COUNSELING);
    const dateGaps = page.missing.filter((gap) => gap.includes('item 10'));
    expect(dateGaps).toHaveLength(1);
  });

  it('reports no date gap and no placeholder once the date is set', () => {
    const page = njpPage11(guiltyCorporal({ dispositionNoticeDate: '2026-08-26' }), COUNSELING);
    expect(page.missing.filter((gap) => gap.includes('item 10'))).toEqual([]);
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
    expect(nextGradeTitle('E4')).toBe('sergeant');
    expect(nextGradeTitle('E-4')).toBe('sergeant');
    expect(nextGradeTitle('e4')).toBe('sergeant');
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

  /**
   * FOUR PARAGRAPHS, not the five of 2026-08-26. Stephen's 2026-08-27 layout
   * moved the corrective action out of paragraph 1 and into paragraph 2
   * alongside the assistance, and merged the rebuttal advisory and the
   * election back into one paragraph.
   */
  it('breaks into the four paragraphs Stephen laid out, in that order', () => {
    const entry = separationCounselingEntry(guiltyCorporal(), blank);
    expect(entry.paragraphs).toHaveLength(4);

    // 1. Date and deficiencies, and nothing else.
    expect(entry.paragraphs[0].startsWith('20130501. Counseled this date')).toBe(true);
    expect(entry.paragraphs[0]).not.toContain('corrective action');

    // 2. Corrective action, assistance, then the consequences warning.
    expect(entry.paragraphs[1].startsWith('Specific recommendations for corrective action are'))
      .toBe(true);
    expect(entry.paragraphs[1]).toContain('to seek assistance, which is available through the');
    expect(entry.paragraphs[1].endsWith(DISCHARGE_CONSEQUENCES_SENTENCE)).toBe(true);

    // 3. One of 4006.2r's two statements.
    expect(entry.paragraphs[2]).toBe(NO_SEPARATION_SENTENCE);

    // 4. Advisory and election together.
    expect(entry.paragraphs[3]).toBe(`${REBUTTAL_ADVISORY} ${REBUTTAL_CHOICE}`);
  });

  it('joins them with a blank line and closes with the signature block', () => {
    const entry = separationCounselingEntry(guiltyCorporal(), blank);
    expect(entry.text).toBe(
      `${entry.paragraphs.join(PARAGRAPH_BREAK)}${PARAGRAPH_BREAK}\n${SIGNATURE_BLOCK}`,
    );
    // No paragraph runs into the next, and none carries a stray newline of
    // its own. The signature block is the only multi-line part.
    for (const paragraph of entry.paragraphs) {
      expect(paragraph.trim()).toBe(paragraph);
      expect(paragraph).not.toContain('\n');
    }
  });

  // The election is the last thing the Marine reads before signing, and it
  // stays a separate SENTENCE even though it is no longer a separate
  // paragraph. An app that dropped it would be taking the choice away.
  it('ends the last paragraph on the rebuttal election', () => {
    const entry = separationCounselingEntry(guiltyCorporal(), blank);
    expect(REBUTTAL_ADVISORY).not.toContain('I choose');
    expect(entry.paragraphs[entry.paragraphs.length - 1].endsWith(REBUTTAL_CHOICE)).toBe(true);
  });

  it('keeps four paragraphs when the commander is processing for separation', () => {
    const entry = separationCounselingEntry(guiltyCorporal(), {
      ...blank,
      intent: 'processing',
      processingDetail: 'administrative separation',
    });
    expect(entry.paragraphs).toHaveLength(4);
    expect(entry.paragraphs[2]).toBe(
      'I understand that I am being processed for the following judicial or adverse ' +
        'administrative action: administrative separation.',
    );
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
    // The breaks reach the XML rather than being stripped. Counting exact
    // occurrences would just restate the paragraph count asserted above, so
    // this asserts the thing the escaping is FOR: no raw newline survives,
    // and the doubled carriage return that makes a blank line is present in
    // both columns.
    expect(xml).not.toContain('\n');
    expect(xml).toContain('&#xD;&#xD;');
    expect((xml.match(/&#xD;/g) ?? []).length).toBeGreaterThanOrEqual(
      (page.remarksLeft.match(/\n/g) ?? []).length +
        (page.remarksRight.match(/\n/g) ?? []).length,
    );
  });

  /**
   * THE RIGHT COLUMN'S BODY IS STILL ONE BLOCK. Stephen's worked examples
   * for 4006.3e print the promotion restriction as a single flowing entry,
   * and that is what this reproduces. His 2026-08-27 layout added two things
   * around it and neither breaks the body: the date sits on its own line
   * above, and the signature block below.
   */
  it('leaves the promotion restriction body unbroken, as its own source prints it', () => {
    const page = njpPage11(guiltyCorporal(), blank);
    const body = page.remarksRight.replace(`${PARAGRAPH_BREAK}\n${SIGNATURE_BLOCK}`, '');

    expect(body.startsWith('20130501. I understand that I am eligible')).toBe(true);
    expect(body.endsWith('make a rebuttal.')).toBe(true);
    expect(body).not.toContain('\n');
  });
});

// ---------------------------------------------------------------------------
// THE DATE SOURCE.
//
// Stephen, 2026-08-27: "item 10 is the date of NJP", scoped to the Page 11
// when asked. Item 6 is the date the punishment was adjudged; item 10 is the
// date of notice to the accused of final disposition, which is the day the
// Marine is stood in front of these entries and signs them.
//
// THE SCOPE IS THE LOAD-BEARING PART. PRIUM 70508 fixes the TTC 212 Date of
// Action as "the date the Courts-martial or Nonjudicial Punishment is
// adjudged", so the unit diary and every MCTFS transaction must keep item 6.
// A change that moved all of them together would be a defect nobody would
// find until a diary entry was rejected, so the boundary is asserted here.
// ---------------------------------------------------------------------------
describe('both Page 11 entries open with item 10, and nothing else moved', () => {
  it('reads item 10 even when item 6 carries a different date', () => {
    const page = njpPage11(
      guiltyCorporal({ punishmentDate: '2013-04-30', dispositionNoticeDate: '2013-05-01' }),
      COUNSELING,
    );
    expect(page.remarksLeft.startsWith('20130501.')).toBe(true);
    expect(page.remarksRight.startsWith('20130501.')).toBe(true);
    expect(page.remarksLeft).not.toContain('20130430');
    expect(page.remarksRight).not.toContain('20130430');
  });

  // THE INVERSE, which is what tells a real reading of item 10 from a
  // fallback chain that happens to reach item 6. An entry that printed
  // 20130430 here would be reading the wrong field.
  it('carries the blank rather than falling back to item 6', () => {
    const page = njpPage11(
      guiltyCorporal({ punishmentDate: '2013-04-30', dispositionNoticeDate: '' }),
      COUNSELING,
    );
    expect(page.remarksLeft.startsWith('[DATE].')).toBe(true);
    expect(page.remarksRight.startsWith('[DATE].')).toBe(true);
    expect(page.remarksLeft).not.toContain('20130430');
    expect(page.remarksRight).not.toContain('20130430');
    expect(page.missing).toContain(PAGE11_DATE_GAP);
  });

  it('names item 10 in the gap it reports, not item 6', () => {
    const page = njpPage11(guiltyCorporal({ dispositionNoticeDate: '' }), COUNSELING);
    expect(PAGE11_DATE_GAP).toContain('item 10');
    expect(PAGE11_DATE_GAP).not.toContain('item 6');
    expect(page.missing).toContain(PAGE11_DATE_GAP);
  });

  // THE BOUNDARY. The unit diary handoff and the MCTFS statements are priced
  // on item 6 and this ruling did not touch them. Asserted here, in the file
  // that changed, because a future reader looking for "did the Page 11 date
  // change break the diary" will look at this commit.
  it('leaves the unit diary NJP DATE on item 6', async () => {
    const { unitDiaryBlock } = await import('@/lib/navmc10132-unit-diary');
    const { text } = unitDiaryBlock(
      guiltyCorporal({ punishmentDate: '2013-04-30', dispositionNoticeDate: '2013-05-01' }),
    );
    // The diary prints the ISO date rather than the MCTFS eight-byte form.
    expect(text).toContain('NJP DATE    2013-04-30');
    expect(text).not.toContain('2013-05-01');
  });

  it('leaves the MCTFS transaction dates on item 6', async () => {
    const { mctfsNjpStatements } = await import('@/lib/navmc10132-mctfs');
    const result = mctfsNjpStatements(
      guiltyCorporal({ punishmentDate: '2013-04-30', dispositionNoticeDate: '2013-05-01' }),
    );
    const lines = result.statements.map((statement) => statement.text).join('\n');
    expect(lines).toContain('20130430');
    expect(lines).not.toContain('20130501');
  });
});

// ---------------------------------------------------------------------------
// THE SIGNATURE BLOCK'S COLUMN ALIGNMENT.
//
// Stephen, 2026-08-27, on the printed NAVMC 118(11): "we need the Signature
// of Co start at the same position as the line above it". It did not, because
// the block was padded as if the remarks field were monospaced. It is not.
//
// THIS TEST MEASURES RATHER THAN RESTATES. Asserting "twenty spaces" would
// pass on any future change to either string while the columns drifted apart
// on paper, which is exactly the failure being fixed. It lays out both lines
// in Times New Roman advance widths and checks that the second rule and the
// second label begin at the same x.
//
// THE FACE WAS CONFIRMED BEFORE THE METRICS WERE TRUSTED. On Stephen's
// screenshot "Signature of Marine" measures 0.766 of the width of 21
// underscores; the table below predicts 0.767.
// ---------------------------------------------------------------------------
describe('the signature block lines up in the form\'s own font', () => {
  /** Times New Roman advance widths, units per 1000 em. */
  const ADVANCE: Record<string, number> = {
    ' ': 250, '_': 500,
    S: 556, i: 278, g: 500, n: 500, a: 444, t: 278, u: 500, r: 333, e: 444,
    o: 500, f: 333, M: 889, C: 667, O: 722,
  };

  function width(text: string): number {
    let total = 0;
    for (const character of text) {
      const advance = ADVANCE[character];
      // A character with no width here would silently measure as zero and
      // make every assertion below meaningless.
      expect(advance, `no advance width for ${JSON.stringify(character)}`).toBeDefined();
      total += advance ?? 0;
    }
    return total;
  }

  const [ruleLine, labelLine] = SIGNATURE_BLOCK.split('\n');

  it('is exactly two lines, a rule line and a label line', () => {
    expect(SIGNATURE_BLOCK.split('\n')).toHaveLength(2);
    expect(ruleLine.replace(/[_ ]/g, '')).toBe('');
    expect(labelLine).toContain('Signature of Marine');
    expect(labelLine).toContain('Signature of CO');
  });

  it('starts both labels within a tenth of a space of their own rule', () => {
    // The index the SECOND rule begins at, which is after the run of spaces
    // between them. lastIndexOf on a run of underscores would land inside
    // the second rule rather than at its start.
    const split = /^(_+)( +)(_+)$/.exec(ruleLine);
    expect(split, 'the rule line is two underscore runs separated by spaces').not.toBeNull();
    if (split === null) return;
    const secondRuleStart = width(split[1] + split[2]);
    const secondLabelStart = width(labelLine.slice(0, labelLine.lastIndexOf('Signature of CO')));

    // The first pair is trivially aligned, both at zero, and is asserted so a
    // block that indented one line and not the other is caught too.
    expect(ruleLine.startsWith('_')).toBe(true);
    expect(labelLine.startsWith('Signature of Marine')).toBe(true);

    // A quarter of a space. Whole spaces are the only adjustment available,
    // so anything under half a space is as close as the block can get.
    expect(Math.abs(secondRuleStart - secondLabelStart)).toBeLessThan(ADVANCE[' '] / 4);
  });

  // The rules have to be long enough to sign on, and equal to each other, or
  // the second column reads as an afterthought.
  it('gives both signers the same length of rule', () => {
    const rules = ruleLine.split(/ +/);
    expect(rules).toHaveLength(2);
    expect(rules[0]).toBe(rules[1]);
    expect(rules[0].length).toBeGreaterThanOrEqual(20);
  });
});

// ---------------------------------------------------------------------------
// THE DATE OPENS THE SENTENCE, on both sides.
//
// Stephen, 2026-08-27, correcting his own layout against the printed form:
// "the right hand needs to start after the date not the line under."
// ---------------------------------------------------------------------------
describe('both entries run the body on from the date', () => {
  it('puts no line break between the date and the promotion restriction', () => {
    const page = njpPage11(guiltyCorporal(), COUNSELING);
    expect(page.remarksRight.startsWith('20130501. I understand that I am eligible')).toBe(true);
  });

  it('does the same with the blank, so the shapes cannot diverge', () => {
    const page = njpPage11(guiltyCorporal({ dispositionNoticeDate: '' }), COUNSELING);
    expect(page.remarksRight.startsWith('[DATE]. I understand that I am eligible')).toBe(true);
  });

  // The only newlines in either column are the paragraph breaks and the
  // signature block. A stray one would break a sentence across lines on a
  // field that wraps by itself.
  it('leaves the signature block as the only line break inside a paragraph', () => {
    const page = njpPage11(guiltyCorporal(), COUNSELING);
    for (const column of [page.remarksLeft, page.remarksRight]) {
      const body = column.replace(`${PARAGRAPH_BREAK}\n${SIGNATURE_BLOCK}`, '');
      for (const paragraph of body.split(PARAGRAPH_BREAK)) {
        expect(paragraph).not.toContain('\n');
      }
    }
  });
});

// ---------------------------------------------------------------------------
// MCO P1400.32D par 1204.4q, THE DRUG RESTRICTION.
//
// The order attaches a NOTE to q in its own words: "This promotion
// restriction does take precedence over the restrictions contained in
// paragraphs 1204.4g, 1204.4h, and 1204.4j." j is the NJP paragraph, so a
// drug offence displaces it.
//
// Stephen ruled the trigger list on 2026-08-27 after seeing six candidates:
// the four certain ones only. He also named the consequence the order
// confirms: "q is before the NJP and would cover the period of the NJP so it
// would supersede the NJP but would be effective possibly before the NJP took
// place."
// ---------------------------------------------------------------------------
describe('a drug offence puts the entry under 1204.4q, not 1204.4j', () => {
  function withOffense(label: string, overrides: Record<string, unknown> = {}): FormData {
    return guiltyCorporal({
      offenses: offenses({
        articleLabel: resolveArticle(label)?.formLabel ?? label,
        summary: 'x',
        finding: 'Guilty',
      }),
      ...overrides,
    });
  }

  const DRUG_START = { drugRestrictionStartDate: '2013-02-14' };

  // EVERY LABEL STEPHEN RULED IN, one case each, so a list edited down to
  // three still fails rather than silently dropping a trigger.
  it.each([...DRUG_RESTRICTION_OFFENSE_LABELS])('triggers on %s', (label) => {
    const result = promotionRestrictionEntry(withOffense(label, DRUG_START));
    expect(result.kind).toBe('entry');
    if (result.kind !== 'entry') return;
    expect(result.entry.paragraph).toBe('1204.4q');
    expect(result.entry.months).toBe(DRUG_RESTRICTION_MONTHS);
  });

  // THE EXCLUSIONS, and they matter more than the inclusions. Article 92
  // carries twenty-two labels in this app and nineteen have nothing to do
  // with a substance, so a rule keyed to "art 92" would put an 18-month drug
  // restriction on a hazing NJP.
  it.each([
    'Art. 92  Viol. MCO 5354.1 (series) (Hazing)',
    'Art. 92  Viol. SECNAVINST 5300.28 (series) (Paraphernalia)',
    'Art. 92  Viol. ALNAV 074/20 (Hemp Use)',
    'Art. 112  Drunk on duty',
    'Art. 134  Drunkenness',
    'Art. 113  Drunken or reckless operation of vehicle, aircraft, or vessel',
  ])('does not trigger on %s', (label) => {
    const result = promotionRestrictionEntry(withOffense(label));
    expect(result.kind).toBe('entry');
    if (result.kind !== 'entry') return;
    expect(result.entry.paragraph).toBe('1204.4j');
    expect(result.entry.months).toBe(3);
  });

  // A row found Not Guilty restricts nothing, same rule the deficiencies and
  // the article phrase already follow.
  it('ignores a drug offence found not guilty', () => {
    const result = promotionRestrictionEntry(
      guiltyCorporal({
        offenses: offenses(
          { articleLabel: ART_92, summary: 'Order', finding: 'Guilty' },
          {
            articleLabel: DRUG_RESTRICTION_OFFENSE_LABELS[0],
            summary: 'Urinalysis',
            finding: 'Not Guilty',
          },
        ),
      }),
    );
    if (result.kind !== 'entry') throw new Error('expected an entry');
    expect(result.entry.paragraph).toBe('1204.4j');
  });

  /**
   * THE CLOCK STARTS BEFORE THE NJP, which is the whole reason this needs a
   * field of its own. The order runs the 18 months from laboratory
   * confirmation or from the incident. An entry stating only a length would
   * be read as running from the NJP and would put the end date months late.
   */
  it('states the date the period runs from, which is not the NJP date', () => {
    const result = promotionRestrictionEntry(withOffense(
      DRUG_RESTRICTION_OFFENSE_LABELS[0], DRUG_START,
    ));
    if (result.kind !== 'entry') throw new Error('expected an entry');
    expect(result.entry.text).toContain('for a period of 18 months from 20130214');
    // The entry date is item 10's and the period start is neither it nor
    // item 6's, so all three are distinct on this fixture.
    expect(result.entry.text).toContain('20130501.');
    expect(result.entry.text).not.toContain('20130430');
  });

  it('names the missing start date rather than printing a period with no origin', () => {
    const result = promotionRestrictionEntry(
      withOffense(DRUG_RESTRICTION_OFFENSE_LABELS[0]),
    );
    if (result.kind !== 'entry') throw new Error('expected an entry');
    expect(result.entry.text).toContain('18 months from [DATE OF CONFIRMATION OR INCIDENT]');
    expect(result.entry.missing).toContain(DRUG_RESTRICTION_DATE_GAP);
  });

  /**
   * PARAGRAPH 1204.6: "No waivers of the promotion restrictions resulting
   * from illegal drug use/possession will be granted." The waiver clause
   * states a remedy the order forbids, so it comes off a q entry. This is
   * the order's own sentence rather than an inference, and it is asserted
   * against the non-drug entry so the clause is proved present elsewhere.
   */
  it('drops the waiver clause, which 1204.6 forbids on a drug restriction', () => {
    const drug = promotionRestrictionEntry(withOffense(
      DRUG_RESTRICTION_OFFENSE_LABELS[0], DRUG_START,
    ));
    const ordinary = promotionRestrictionEntry(guiltyCorporal());
    if (drug.kind !== 'entry' || ordinary.kind !== 'entry') throw new Error('expected entries');

    expect(drug.entry.text).not.toContain('unless waived');
    expect(ordinary.entry.text).toContain('unless waived by appropriate authority');
  });

  /**
   * THE NOTE NAMES g, h AND j, AND STOPS. k is the probationary status a
   * suspended punishment creates, and the order left it standing where it
   * removed the other three. So a drug NJP with a suspended portion states
   * BOTH, per 1204.5's requirement that the entry include "the specific
   * promotion restriction that applies and the period of time".
   *
   * THIS IS THE ONE INFERENCE IN THE MODULE. Stephen ruled the article list
   * and did not rule this, and stating a restriction that applies is the
   * safer error than omitting one.
   */
  it('states 1204.4k alongside q when a portion is suspended', () => {
    const result = promotionRestrictionEntry(
      withOffense(DRUG_RESTRICTION_OFFENSE_LABELS[0], {
        ...DRUG_START,
        suspensions: [{ punishmentIndex: 0, months: '6' }],
      }),
    );
    if (result.kind !== 'entry') throw new Error('expected an entry');
    expect(result.entry.paragraph).toBe('1204.4q');
    expect(result.entry.text).toContain('for a period of 18 months from 20130214');
    expect(result.entry.text).toContain(
      'probationary status for 6 months IAW MCO P1400.32, par 1204.4k',
    );
  });

  it('says nothing about 1204.4k on a drug NJP with nothing suspended', () => {
    const result = promotionRestrictionEntry(withOffense(
      DRUG_RESTRICTION_OFFENSE_LABELS[0], DRUG_START,
    ));
    if (result.kind !== 'entry') throw new Error('expected an entry');
    expect(result.entry.text).not.toContain('1204.4k');
    expect(result.entry.text).not.toContain('probationary');
  });

  /**
   * A SUSPENSION IN DAYS STOPS BEING FATAL ON A DRUG NJP. Under j and k the
   * suspension IS the period, so days leave the app unable to say how long,
   * and it refuses. Under q the order fixes eighteen months regardless, so
   * the entry is fully computable and only the k sentence is lost.
   */
  it('still writes the q entry when the suspension is stated in days', () => {
    const result = promotionRestrictionEntry(
      withOffense(DRUG_RESTRICTION_OFFENSE_LABELS[0], {
        ...DRUG_START,
        suspensions: [{ punishmentIndex: 0, days: '90' }],
      }),
    );
    expect(result.kind).toBe('entry');
    if (result.kind !== 'entry') return;
    expect(result.entry.text).toContain('for a period of 18 months from 20130214');
    expect(result.entry.missing.some((gap) => gap.includes('1204.4k'))).toBe(true);
  });

  it('still refuses on a suspension in days when no drug offence is present', () => {
    const result = promotionRestrictionEntry(
      guiltyCorporal({ suspensions: [{ punishmentIndex: 0, days: '90' }] }),
    );
    expect(result.kind).toBe('unavailable');
    if (result.kind === 'unavailable') expect(result.reason).toBe('suspension-not-in-months');
  });
});

// ---------------------------------------------------------------------------
// THE ENTRY CITES A UCMJ ARTICLE, NOT AN MCTFS TRANSACTION CODE.
//
// Found on 2026-08-27 while wiring 1204.4q. guiltyArticleNumbers read
// `mctfsCode`, and twenty of this app's labels carry a code that is not the
// article: every Art. 134 label has a sub-code, and the sexual-harassment
// labels use 92.1.
//
// The Marine signs this entry. A citation to "art 134.96" points at a unit
// diary transaction code, not at anything in the Uniform Code, so no reader
// could look it up.
// ---------------------------------------------------------------------------
describe('the article phrase names the article', () => {
  it.each([
    ['Art. 134  Disorderly conduct', 'art 134'],
    ['Art. 134  Drunkenness', 'art 134'],
    ['Art. 92  Viol. MCO 5354.1 (series) (Sexual Harassment)', 'art 92'],
    ['Art. 112a  Wrongful use, possession, etc. of controlled substances', 'art 112a'],
  ])('renders %s as %s', (label, expected) => {
    const result = promotionRestrictionEntry(
      guiltyCorporal({
        offenses: offenses({
          articleLabel: resolveArticle(label)?.formLabel ?? label,
          summary: 'x',
          finding: 'Guilty',
        }),
        drugRestrictionStartDate: '2013-02-14',
      }),
    );
    if (result.kind !== 'entry') throw new Error('expected an entry');
    expect(result.entry.text).toContain(`violation of ${expected} `);
  });

  // The sub-code and the upper-case form are the two shapes that leaked.
  it('lets no transaction sub-code or upper-case article into the entry', () => {
    for (const label of [
      'Art. 134  Disorderly conduct',
      'Art. 92  Viol. MCO 5354.1 (series) (Sexual Harassment)',
      'Art. 112a  Wrongful use, possession, etc. of controlled substances',
    ]) {
      const result = promotionRestrictionEntry(
        guiltyCorporal({
          offenses: offenses({
            articleLabel: resolveArticle(label)?.formLabel ?? label,
            summary: 'x',
            finding: 'Guilty',
          }),
          drugRestrictionStartDate: '2013-02-14',
        }),
      );
      if (result.kind !== 'entry') throw new Error('expected an entry');
      expect(result.entry.text, label).not.toMatch(/art \d+\.\d/);
      expect(result.entry.text, label).not.toMatch(/art \d+[A-Z]/);
    }
  });
});

// ---------------------------------------------------------------------------
// THE TYPED SIGNATURE LINES BELONG TO ONE PATH, NOT BOTH.
//
// Stephen, 2026-08-27, looking at the entries rendered in the app's own Page
// 11 beside the official export: "the PG.11 part of the semper scribe app is
// not formatted correctly as the NJP Pg. 11 export is do you see the
// difference and the problem with the digital signed option."
//
// TWO FAILURES, AND THE SECOND IS THE REAL ONE.
//
// The formatting half is measurable. navmc11811Generator wraps at an 11pt
// column 261pt wide, and its wrapText splits the string on ' ', so a run of
// padding spaces is destroyed and rejoined with single ones. The rule line
// measures 287.5pt at 11pt Helvetica and wraps, which is why one rule
// appeared instead of two and the labels stacked. A space-padded two-column
// block cannot survive that renderer.
//
// The half that matters is that it should not be there at all. That path
// exists to place REAL CAC signature fields. Typed lines under placed fields
// are a second set of lines nobody signs, on a service record entry.
//
// The official form keeps them, because its one native signature field
// belongs to the Article 137 header block and an entry there has nowhere
// else to put a signature.
// ---------------------------------------------------------------------------
describe('signature lines follow the path, not the entry', () => {
  it('keeps them by default, which is the official form', () => {
    const page = njpPage11(guiltyCorporal(), COUNSELING);
    expect(page.remarksLeft.endsWith(SIGNATURE_BLOCK)).toBe(true);
    expect(page.remarksRight.endsWith(SIGNATURE_BLOCK)).toBe(true);
  });

  it('drops them for the app Page 11, which places real fields', () => {
    const page = njpPage11(guiltyCorporal(), COUNSELING, { signatureLines: false });
    expect(page.remarksLeft).not.toContain('Signature of Marine');
    expect(page.remarksRight).not.toContain('Signature of Marine');
    expect(page.remarksLeft).not.toContain('_____');
    expect(page.remarksRight).not.toContain('_____');
  });

  // STRIPPING TAKES THE BLOCK AND NOTHING ELSE. A regex over underscores or a
  // slice at the last blank line would eat the rebuttal sentence or leave a
  // trailing blank, and either would show on a printed service record entry.
  it('leaves every entry ending on the rebuttal election', () => {
    const page = njpPage11(guiltyCorporal(), COUNSELING, { signatureLines: false });
    expect(page.remarksLeft.endsWith('I choose (to) (not to) make a rebuttal.')).toBe(true);
    expect(page.remarksRight.endsWith('I choose (to) (not to) make a rebuttal.')).toBe(true);
  });

  // The two versions differ by exactly the block and by nothing else.
  it('changes nothing else about either entry', () => {
    const withLines = njpPage11(guiltyCorporal(), COUNSELING);
    const without = njpPage11(guiltyCorporal(), COUNSELING, { signatureLines: false });
    const suffix = `${PARAGRAPH_BREAK}\n${SIGNATURE_BLOCK}`;

    expect(withLines.remarksLeft).toBe(without.remarksLeft + suffix);
    expect(withLines.remarksRight).toBe(without.remarksRight + suffix);
  });

  /**
   * STRIPPING IS AN EXACT MATCH ON THE BLOCK, NOT A PATTERN OVER ITS WORDS.
   *
   * A differential caught this being untested: replacing the exact-suffix
   * check with /[\s_]*Signature of Marine[\s\S]*$/ passed every case above,
   * because no entry happened to contain that phrase in its body. One that
   * does is not far-fetched. A clerk directing a Marine to "obtain the
   * Signature of Marine Corps counsel" writes it into the corrective action,
   * and a pattern would eat that sentence and everything after it, including
   * the rebuttal election the Marine answers.
   */
  it('strips only the block, never a body sentence that echoes its words', () => {
    const counseling: CounselingInput = {
      ...COUNSELING,
      correctiveAction: 'obtain the Signature of Marine Corps counsel before the hearing',
    };
    const page = njpPage11(guiltyCorporal(), counseling, { signatureLines: false });

    expect(page.remarksLeft).toContain('Signature of Marine Corps counsel');
    expect(page.remarksLeft.endsWith('I choose (to) (not to) make a rebuttal.')).toBe(true);
    // The block's own rule line is gone even though its words survive above.
    expect(page.remarksLeft).not.toContain('_____');
  });

  // AN EMPTY RIGHT COLUMN STAYS EMPTY. A sergeant gets no restriction entry,
  // and stripping must not turn '' into something.
  it('leaves an absent right column absent', () => {
    const page = njpPage11(guiltyCorporal({ accusedPayGrade: 'E5' }), COUNSELING, {
      signatureLines: false,
    });
    expect(page.remarksRight).toBe('');
  });
});
