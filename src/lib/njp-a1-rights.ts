/**
 * JAGMAN A-1-c / A-1-d generator: the accused's pre-hearing NJP rights
 * notification and election of rights form (JAGMAN 0108 and 0109).
 *
 * A-1-c and A-1-d are the same form with one difference, whether the
 * vessel exception applies (see the LETTERING WARNING in
 * jagman-appendix-a1.ts - A-1-b is a Letter of Instruction sample, not a
 * rights form, despite what MCO 5800.16 Vol 14 para 010701 still cites).
 * selectRightsAppendix picks between them.
 *
 * WHAT THIS MODULE FILLS: the caption (rank, name, unit), the MCM edition,
 * paragraph 1's offense list, paragraph 2's basis-of-allegation summaries,
 * and, on A-1-d only, paragraph 3's maximum-punishment rule. It leaves
 * every election checkbox and every signature block untouched, because
 * those are made and signed at the moment of election, not composed in
 * advance.
 *
 * THE PARAGRAPH 1 / PARAGRAPH 2 SPLIT is the form's own, not a formatting
 * choice. Paragraph 1 asks what offenses are alleged. Paragraph 2 asks what
 * information the allegations are based on. The UPB carries the same split
 * across item 1's two fields, so the article goes in paragraph 1 and its
 * summary follows in paragraph 2 under the same letter.
 */

import { APPENDIX_A_1_C, APPENDIX_A_1_D, type JagmanAppendix } from '@/lib/jagman-appendix-a1';
import { fillAppendix, type A1Fill, type A1FillReport } from '@/lib/jagman-a1-fill';
import { appendixWidth, wrapHanging } from '@/lib/jagman-a1-wrap';
import { renderMaximumPunishment, resolveAuthorityLevel } from '@/lib/njp-maximum-punishment';
import type { Navmc10132Service } from '@/lib/navmc10132-ranks';

/**
 * What is known BEFORE the hearing. Deliberately carries NO finding and NO
 * imposed punishment: the rights advisement is served before either exists,
 * and A-1-d paragraph 3 asks for the MAXIMUM punishment, never the imposed
 * one. Printing an imposed punishment there would tell a Marine deciding
 * whether to demand court-martial that his own not-yet-imposed sentence is
 * the ceiling. The type is the guard, so do not widen it with anything from
 * item 5 or item 6.
 *
 * The two pay grades below are NOT punishment data. `authorityPayGrade` is
 * item 8A and decides the company-grade or field-grade ceiling.
 * `accusedPayGrade` is item 19 and decides only whether the USMC reduction
 * bar removes reduction from that ceiling.
 */
export interface NjpRightsCase {
  /** Item 19 rank abbreviation, printed before the name. May be empty. */
  accusedRank: string;
  accusedName: string;
  unit: string;
  /** Item 1 offenses. NOTE: no `finding` field, on purpose. */
  offenses: ReadonlyArray<{ articleLabel: string; summary: string }>;
  /** True selects A-1-c, false selects A-1-d. */
  vesselException: boolean;
  /** Item 8A pay grade. Empty leaves the A-1-d maximum rule blank. */
  authorityPayGrade: string;
  /** Item 19 pay grade. Empty applies no reduction bar. */
  accusedPayGrade: string;
  accusedService?: Navmc10132Service;
}

export interface HandFillBlank {
  item: string;
  why: string;
}

/**
 * Current MCM edition, confirmed from the Manual for Courts-Martial,
 * United States (2024 edition) title page and preface, which incorporates
 * E.O. 14103 of 28 July 2023 and names Nonjudicial Punishment Procedure
 * among the parts updated. One constant, so a future edition change is one
 * edit, not a hunt through every fill site citing it.
 */
export const MCM_CURRENT_EDITION = '2024 ed.';

/**
 * Rank then name, the way a caption is written. Falls back to the name
 * alone when the rank is not set rather than printing a leading space,
 * because the caption is a single inline replacement and a stray space
 * there is visible on the rendered form.
 */
export function captionName(rank: string, name: string): string {
  const r = rank.trim();
  const n = name.trim();
  return r === '' ? n : `${r} ${n}`;
}

/**
 * Item 1's own lettering convention, A through E and, on a sixth or later
 * offense, continuing exactly the way the NAVMC 10132 item 21 overflow
 * instruction continues item 1 past its five printed rows ("YYYY-MM-DD
 * ITEM 1: Additional Offenses: F. ... G. ..."). The JAGMAN A-1-c/d text
 * itself prints no lettered rows at all - paragraph 1 is a single
 * free-text note - so nothing in the appendix caps this list. Only the
 * UPB's own five-row printed capacity does, and this module follows its
 * overflow convention past it rather than inventing a cap of its
 * own. Refusing to produce a rights advisement over a sixth offense would
 * block a legitimate case.
 */
function offenseLetter(index: number): string {
  let n = index;
  let letters = '';
  do {
    letters = String.fromCharCode(65 + (n % 26)) + letters;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letters;
}

export function selectRightsAppendix(vesselException: boolean): JagmanAppendix {
  return vesselException ? APPENDIX_A_1_C : APPENDIX_A_1_D;
}

/** One constant per anchor so none is ever retyped between the wrap-width
 *  lookup below and the fill list that uses it for real. */
const OFFENSES_NOTE_ANCHOR = 'Here describe the offenses, including the UCMJ';
const BASIS_NOTE_ANCHOR = 'Here provide a brief summary of that information.';
/** The last line of A-1-d paragraph 3's prose, immediately above the four
 *  blank rules the maximum punishment is written into. Matched 'exact'
 *  because it is a short fragment. A-1-c has no such line at all, which is
 *  correct: a vessel-attached accused cannot refuse NJP, so that form
 *  carries no ceiling to state. */
const MAXIMUM_RULE_ANCHOR = 'accept NJP is:';

function leadingWhitespace(line: string): string {
  return line.match(/^[ \t]*/)?.[0] ?? '';
}

/** The indent replaceNote will apply for this note, read from the
 *  anchor's own line in the SOURCE appendix text - matches module 1's own
 *  applyReplaceNote logic, so the width budget below is exact rather than
 *  a guess at how much room the note's block actually has. */
function noteIndent(appendix: JagmanAppendix, anchor: string): string {
  const idx = appendix.text.findIndex((l) => l.includes(anchor));
  return idx === -1 ? '' : leadingWhitespace(appendix.text[idx]);
}

/** Wraps a lettered list to the width the note's own block leaves, hanging
 *  continuation lines under the text rather than under the letter. */
function formatLettered(
  appendix: JagmanAppendix,
  anchor: string,
  entries: ReadonlyArray<{ letter: string; text: string }>,
): string[] {
  const indent = noteIndent(appendix, anchor);
  const budget = Math.max(appendixWidth(appendix) - indent.length, 1);
  return entries.flatMap((e) => wrapHanging(e.text, budget, `${e.letter}. `));
}

/** A sentence closed with a period, unless the caller already closed it. */
function sentence(text: string): string {
  const t = text.trim();
  if (t === '') return t;
  return /[.?!]$/.test(t) ? t : `${t}.`;
}

/** Offenses that carry a basis summary, keeping their paragraph 1 letter so
 *  the two paragraphs line up item for item. */
function summarised(
  offenses: NjpRightsCase['offenses'],
): Array<{ letter: string; text: string }> {
  return offenses
    .map((o, i) => ({ letter: offenseLetter(i), text: sentence(o.summary) }))
    .filter((e) => e.text !== '');
}

export function renderNjpRights(
  input: NjpRightsCase,
): { designator: string; lines: string[]; report: A1FillReport } {
  const appendix = selectRightsAppendix(input.vesselException);

  const fills: A1Fill[] = [
    {
      id: 'mcm-edition',
      anchor: '[insert current edition]',
      mode: 'replaceInline',
      value: [MCM_CURRENT_EDITION],
    },
    {
      id: 'caption-name',
      anchor: '__________________________________, assigned or attached to',
      mode: 'replaceInline',
      value: [captionName(input.accusedRank, input.accusedName)],
    },
    // Anchored on the blank's OWN full trimmed line, matched 'exact', not
    // as a substring: a longer, unrelated underscore-then-period run
    // exists elsewhere in both appendices ("lawyer, on ______.....___.."),
    // and a plain substring match on this short blank's own content would
    // also match the other line. 'exact' makes this fill independent of
    // caption-name and of array order - each fill here now touches its
    // own line and no two fills share an anchor.
    {
      id: 'caption-unit',
      anchor: '_______________________.',
      anchorMatch: 'exact',
      mode: 'replaceInline',
      value: [input.unit],
    },
  ];

  // Paragraph 1 asks for the offenses. With none supplied there is
  // nothing to letter in, so the note is left exactly as printed rather
  // than replaced with an empty block - the caller sees this in the
  // report (no 'offenses-notice' entry in `applied`), not an exception.
  if (input.offenses.length > 0) {
    fills.push({
      id: 'offenses-notice',
      anchor: OFFENSES_NOTE_ANCHOR,
      mode: 'replaceNote',
      value: formatLettered(
        appendix,
        OFFENSES_NOTE_ANCHOR,
        input.offenses.map((o, i) => ({
          letter: offenseLetter(i),
          text: sentence(o.articleLabel),
        })),
      ),
    });
  }

  // Paragraph 2 asks what INFORMATION the allegations are based on. That is
  // the follow-on half of item 1's own two-field split: the article names
  // the offense in paragraph 1 and its summary states the basis here, under
  // the same letter. An offense entered with no summary yet contributes no
  // line, and if none of them carry one the note is left printed for hand
  // completion rather than replaced with an empty block.
  const basis = summarised(input.offenses);
  if (basis.length > 0) {
    fills.push({
      id: 'basis-notice',
      anchor: BASIS_NOTE_ANCHOR,
      mode: 'replaceNote',
      value: formatLettered(appendix, BASIS_NOTE_ANCHOR, basis),
    });
  }

  // Paragraph 3, A-1-d only. Null when item 8A's pay grade is not readable,
  // and null prints the four rules exactly as the appendix does, blank.
  if (!input.vesselException) {
    const maximum = renderMaximumPunishment(
      {
        authorityPayGrade: input.authorityPayGrade,
        accusedPayGrade: input.accusedPayGrade,
        accusedService: input.accusedService,
      },
      appendixWidth(appendix),
    );
    if (maximum !== null) {
      fills.push({
        id: 'maximum-punishment',
        anchor: MAXIMUM_RULE_ANCHOR,
        anchorMatch: 'exact',
        mode: 'fillRule',
        value: maximum,
      });
    }
  }

  const { lines, report } = fillAppendix(appendix, fills);
  return { designator: appendix.designator, lines, report };
}

/**
 * Every blank this module leaves for the accused, a witness, or the preparer
 * to complete by hand, and why, for THIS case rather than in general. The
 * list shrinks as the case fills in: supply the offense summaries and the
 * paragraph 2 entry disappears, set item 8A and the maximum-punishment entry
 * disappears.
 */
export function rightsHandFillBlanks(input: NjpRightsCase): HandFillBlank[] {
  const blanks: HandFillBlank[] = [];

  if (!input.vesselException && resolveAuthorityLevel(input.authorityPayGrade) === null) {
    blanks.push({
      item: 'A-1-d paragraph 3 - maximum punishment if NJP is accepted',
      why:
        'Left blank because item 8A carries no readable pay grade, and the ceiling turns on ' +
        'whether the imposing officer is company grade or field grade (MCM Part V para 5.b(2)). ' +
        'Set item 8A and regenerate, or complete the rule by hand from MCM Part V para 5.b.',
    });
  }

  if (summarised(input.offenses).length === 0) {
    blanks.push({
      item: 'Paragraph 2 - summary of the information the allegations are based on',
      why:
        'Cite MCM Part V para 4. No offense carries a summary yet, so nothing was written here. ' +
        'Fill item 1 summaries and regenerate, or complete the note by hand.',
    });
  }

  blanks.push(
    {
      item: 'Lawyer election checkboxes and consultation blanks',
      why: 'The accused checks these and, if consulting a lawyer, names the lawyer and the date.',
    },
    {
      item: 'Personal appearance election checkboxes',
      why: 'The accused checks whether to appear personally, and whether written matters are attached.',
    },
    {
      item: 'Elections-at-personal-appearance checkboxes and witness name blanks',
      why: 'The accused checks whether to request witnesses or an open proceeding, and names any witnesses.',
    },
    {
      item: 'Witness and accused signature and date blocks',
      why: 'Signed at the time each election is made, not composed in advance.',
    },
    {
      item: 'Witness and accused printed name blocks',
      why: 'Completed alongside the corresponding signature block.',
    },
  );

  return blanks;
}
