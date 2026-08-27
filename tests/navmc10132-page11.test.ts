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
      '20130501.\n' +
        'I understand that I am eligible but not recommended for promotion to sergeant due ' +
        'to my recent NJP for violation of art 92 for a period of 3 months IAW MCO P1400.32, ' +
        'par 1204.4j, unless waived by appropriate authority. I was advised that within 5 ' +
        'working days after acknowledgment of this entry, a written rebuttal can be ' +
        'submitted, and this rebuttal will be filed in my OMPF. I choose (to) (not to) make ' +
        'a rebuttal.\n\n\n' +
        '_____________________          _____________________\n' +
        'Signature of Marine                Signature of CO',
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
    expect(result.entry.text).toContain('[DATE].\nI understand that I am eligible');
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
    expect(page.remarksRight).toContain('[DATE].\nI understand that I am eligible');
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
    const body = page.remarksRight
      .slice(page.remarksRight.indexOf('\n') + 1)
      .replace(`${PARAGRAPH_BREAK}\n${SIGNATURE_BLOCK}`, '');

    expect(body.startsWith('I understand that I am eligible')).toBe(true);
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
