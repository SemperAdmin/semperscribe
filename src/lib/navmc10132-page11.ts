/**
 * The two NAVMC 118(11) entries an NJP produces.
 *
 * STEPHEN, 2026-08-26: two Page 11 entries generated from the NJP data, the
 * 6105 administrative separation counseling on the left and the promotion
 * restriction on the right, sitting after the proceedings and before the
 * appeal. He supplied both paragraphs and the amendments to the second.
 *
 * ONE FORM, TWO COLUMNS, his ruling the same day. The NAVMC 118(11) carries
 * Remarks1 and Remarks2, and this fills both from one NJP so the Marine
 * acknowledges the pair together.
 *
 * SOURCES, and what each one settles:
 *
 *   MCO P1070.12K (IRAM) para 4006.2r      the 6105 counseling entry
 *   MCO P1070.12K (IRAM) para 4006.3e      the promotion restriction entry
 *   PAA 09/11, 10/11, 12/11                three amendments to 4006.3e
 *   MCO P1400.32 para 1204.4j / 1204.4k    which paragraph the restriction
 *                                          cites, and for how long
 *
 * THE REBUTTAL ADVISORY IS THE OMPF WORDING ON BOTH ENTRIES, and that is a
 * decision rather than a transcription. 4006.2r as printed says a rebuttal
 * "will be filed on the document side of the SRB". PAA 12/11 replaced that
 * sentence: "DUE TO INTEGRATION TO E-RECORDS, IT IS NECESSARY TO CHANGE THE
 * REBUTTAL STATEMENT ADVISORY IN THE PAGE 11 COUNSELING ENTRY ... A WRITTEN
 * REBUTTAL CAN BE SUBMITTED AND THIS REBUTTAL WILL BE FILED IN MY OMPF."
 * The PAA is headed PAGE 11 COUNSELING ENTRY FORMAT and its reason, that the
 * SRB no longer exists, is not narrower than the paragraph it was published
 * under. A 6105 is a Page 11 counseling entry, so it takes the current
 * advisory. Printing a Marine a promise that a rebuttal will be filed in a
 * record that no longer exists is the alternative.
 *
 * NOTHING IS CHOSEN FOR THE MARINE. Both entries end "I choose (to) (not to)
 * make a rebuttal", with both options standing, exactly as the source prints
 * them. The Marine strikes one at acknowledgment. An app that picked one
 * would be recording an election nobody made.
 */

import type { FormData } from '@/types';
import type { Navmc10132PunishmentEntry, Navmc10132Suspension } from '@/types/navmc';
import { resolveArticle, resolvePunishment } from '@/lib/navmc10132-utils';
import { NAVMC_10132_USMC_ENLISTED_RANKS, reducedPayGrade } from '@/lib/navmc10132-ranks';
import { mctfsDate } from '@/lib/navmc10132-mctfs';

/** Reads a string off the loose FormData bag. */
function str(formData: FormData, key: string): string {
  const value: unknown = (formData as Record<string, unknown>)[key];
  return typeof value === 'string' ? value.trim() : '';
}

function punishmentEntries(formData: FormData): Navmc10132PunishmentEntry[] {
  const value: unknown = formData.punishments;
  return Array.isArray(value) ? (value as Navmc10132PunishmentEntry[]) : [];
}

function suspensions(formData: FormData): Navmc10132Suspension[] {
  const value: unknown = formData.suspensions;
  return Array.isArray(value) ? (value as Navmc10132Suspension[]) : [];
}

/**
 * The bare article numbers of every guilty finding, in row order, without
 * repeats.
 *
 * DEDUPLICATED because two offense labels can be one punitive article, the
 * same property navmc10132-mctfs.ts handles for the TTC 212 slots. An entry
 * reading "VIOLATION OF ART 92 AND ART 92" says the Marine was punished
 * twice under one article.
 */
export function guiltyArticleNumbers(formData: FormData): string[] {
  const rows: unknown = formData.offenses;
  if (!Array.isArray(rows)) return [];
  const out: string[] = [];
  for (const raw of rows) {
    const row = (raw ?? {}) as Record<string, unknown>;
    const finding = typeof row.finding === 'string' ? row.finding.trim() : '';
    const label = typeof row.articleLabel === 'string' ? row.articleLabel.trim() : '';
    if (finding !== 'Guilty' || label === '') continue;
    const article = resolveArticle(label);
    const number = article?.mctfsCode ?? '';
    if (number !== '' && !out.includes(number)) out.push(number);
  }
  return out;
}

/** "ART 92", or "ART 86 AND ART 92" for more than one. */
function articlePhrase(numbers: readonly string[]): string {
  const parts = numbers.map((n) => `ART ${n}`);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} AND ${parts[parts.length - 1]}`;
}

/**
 * The grade the Marine holds AFTER this NJP, which is the grade the
 * promotion restriction runs from.
 *
 * A REDUCTION MOVES IT. The restriction is about the next promotion, and
 * after an unsuspended reduction the next promotion is back to the grade the
 * Marine just left. A SUSPENDED reduction moves nothing: no pay grade has
 * changed, which is the same reason navmc10132-mctfs.ts reports it as
 * history rather than as a TTC 056.
 */
export function gradeAfterNjp(formData: FormData): string {
  const suspended = new Set(suspensions(formData).map((s) => s.punishmentIndex));
  const entries = punishmentEntries(formData);
  for (let i = 0; i < entries.length; i++) {
    const punishment = resolvePunishment(entries[i].code);
    if (!punishment?.parameters.includes('gradeReducedTo')) continue;
    if (suspended.has(i)) continue;
    const target = reducedPayGrade((entries[i].gradeReducedTo ?? '').trim());
    if (target !== '') return target;
  }
  return str(formData, 'accusedPayGrade');
}

/**
 * The rank title of the next grade up, in the entry's own upper case.
 *
 * E-8 IS TWO RANKS. Master Sergeant and First Sergeant share the pay grade,
 * and this returns the first of them. It is never reached from a promotion
 * restriction entry, which only exists for Corporal and below, so it is a
 * property of the table rather than a decision this needs to make.
 */
export function nextGradeTitle(payGrade: string): string {
  const grade = payGrade.replace(/[\s-]/g, '').toUpperCase();
  const match = /^E0*(\d)$/.exec(grade);
  if (!match) return '';
  const next = `E${Number(match[1]) + 1}`;
  const rank = NAVMC_10132_USMC_ENLISTED_RANKS.find((r) => r.payGrade === next);
  return rank ? rank.title.toUpperCase() : '';
}

/**
 * The longest suspension on this NJP, in months, or null where none is
 * stated in months.
 *
 * THE LONGEST, not the first. A restriction that expired while a suspension
 * was still running would leave the Marine promotable during the period the
 * suspension was meant to hold over them, so the operative period is the one
 * that outlasts the others.
 *
 * A suspension stated in DAYS returns null rather than being converted. The
 * paragraph states the restriction in months and the app has no rule for
 * rounding days into them; inventing one would put a period on a service
 * record entry that nobody wrote.
 */
export function longestSuspensionMonths(formData: FormData): number | null {
  let longest: number | null = null;
  for (const suspension of suspensions(formData)) {
    const months = Number((suspension.months ?? '').trim());
    if (!Number.isFinite(months) || months <= 0) continue;
    if (longest === null || months > longest) longest = months;
  }
  return longest;
}

/** Why no promotion restriction entry is produced. */
/**
 * Why NO promotion restriction entry is made.
 *
 * EVERY REASON HERE MEANS THE ENTRY DOES NOT EXIST, not that it is
 * incomplete. That distinction was blurred until 2026-08-27, when
 * 'no-njp-date' sat in this list and suppressed the whole entry over one
 * unfilled blank. Stephen, looking at a form where the 6105 had generated
 * and the restriction had not: "pg. 11 right side is not generating as the
 * app does not recognize the item 6 completion." Both entries print on one
 * NAVMC 118(11), so half a form appearing over a blank the other half
 * happily carries as [DATE] was the app contradicting itself.
 *
 * The date is now a named blank on this side too. What stays here is the
 * cases where the app cannot produce a CORRECT entry at all:
 *
 *  - no-grade: cannot tell whether 4006.3e even reaches this Marine.
 *  - not-corporal-or-below: 4006.3e does not reach them. No entry is made.
 *  - no-guilty-finding: there is no NJP to restrict promotion for.
 *  - suspension-not-in-months: NOT a blank, a citation. The period decides
 *    whether the entry cites MCO P1400.32 par 1204.4J or 1204.4K, and an
 *    entry naming the wrong paragraph of the order is worse than no entry.
 */
export type RestrictionUnavailable =
  | 'not-corporal-or-below'
  | 'no-grade'
  | 'no-guilty-finding'
  | 'suspension-not-in-months';

export interface PromotionRestriction {
  text: string;
  /**
   * Named parts the entry carries as a blank, in the same shape and the same
   * words CounselingEntry.missing uses, so the section can list both columns'
   * gaps as one set. See RestrictionUnavailable for why a blank is not a
   * reason to withhold the entry.
   */
  missing: string[];
  /** Months the restriction runs. */
  months: number;
  /** The MCO P1400.32 paragraph this cites. */
  paragraph: string;
  /** True where the period came from a suspension rather than the default. */
  fromSuspension: boolean;
}

export type PromotionRestrictionResult =
  | { kind: 'entry'; entry: PromotionRestriction }
  | { kind: 'unavailable'; reason: RestrictionUnavailable; detail: string };

/** Pay grades a promotion restriction entry is required for. IRAM 4006.3e. */
const CORPORAL_AND_BELOW = ['E1', 'E2', 'E3', 'E4'];

/**
 * The promotion restriction entry.
 *
 * THE FORMAT IS STEPHEN'S OWN RECONSTRUCTION, 2026-08-26, of 4006.3e as
 * amended by PAA 09/11 (the restriction and its period must both be stated),
 * PAA 10/11 (1204.3f through 3hh, not 3n or 3gg) and PAA 12/11 (the OMPF
 * advisory). His two worked examples are what this is built to reproduce,
 * because they are the paragraph applied to an NJP rather than the generic
 * template:
 *
 *   ... NOT RECOMMENDED FOR PROMOTION TO SERGEANT DUE TO MY RECENT NJP FOR
 *   VIOLATION OF ART 92 FOR A PERIOD OF 6 MONTHS IAW MCO P1400.32, PAR
 *   1204.4K, UNLESS WAIVED BY APPROPRIATE AUTHORITY ...
 *
 * THE PERIOD COMES FROM THE SUSPENSION, his ruling. No suspension is three
 * months under 1204.4j, which is also the automatic restriction MCTFS posts
 * off the TTC 268 (MCTFSPRIUM 70503 note 1). A suspension runs the
 * restriction for the suspension's own length under 1204.4k, so his
 * six-month example follows from its six-month suspension rather than from a
 * fixed six.
 *
 * CORPORAL AND BELOW ONLY. 4006.3e is written for privates through
 * corporals. A sergeant gets no entry and the caller is told why rather than
 * being handed an entry that cites a paragraph not about them.
 */
export function promotionRestrictionEntry(formData: FormData): PromotionRestrictionResult {
  const grade = gradeAfterNjp(formData);
  if (grade === '') {
    return {
      kind: 'unavailable',
      reason: 'no-grade',
      detail:
        'The pay grade in item 19 is not set, so the app cannot tell whether this Marine is a ' +
        'corporal or below, nor what grade they are eligible for.',
    };
  }
  if (!CORPORAL_AND_BELOW.includes(grade)) {
    return {
      kind: 'unavailable',
      reason: 'not-corporal-or-below',
      detail:
        `IRAM 4006.3e is written for privates through corporals, and this Marine is ${grade} ` +
        'after the NJP, so no promotion restriction entry is made. The RESTRICTION itself ' +
        'still applies: MCTFSPRIUM 70503 note 1 posts a three-month promotion restriction ' +
        'automatically when the TTC 268 is reported, at every grade. What 4006.3e requires ' +
        'for corporals and below is the Page 11 entry recording it, not the restriction.',
    };
  }

  const articles = guiltyArticleNumbers(formData);
  if (articles.length === 0) {
    return {
      kind: 'unavailable',
      reason: 'no-guilty-finding',
      detail:
        'No offense carries a Guilty finding, so there is no NJP to restrict promotion for.',
    };
  }

  // A NAMED BLANK, NOT A REFUSAL. See RestrictionUnavailable. The 6105 in
  // the left column has always printed '[DATE]' here and listed the gap, and
  // both entries go on ONE form, so refusing on this side produced a page
  // with one column filled and one empty for the same missing input.
  const missing: string[] = [];
  const date = mctfsDate(str(formData, 'punishmentDate'));
  // WORDED IDENTICALLY to separationCounselingEntry's, on purpose: njpPage11
  // merges the two lists and a clerk should be told once, not twice.
  if (date === '') missing.push('the item 6 punishment date, which opens the entry');

  const hasSuspension = suspensions(formData).length > 0;
  const suspendedMonths = longestSuspensionMonths(formData);
  if (hasSuspension && suspendedMonths === null) {
    return {
      kind: 'unavailable',
      reason: 'suspension-not-in-months',
      detail:
        'Item 7 states a suspension in days rather than months. The restriction period is ' +
        'stated in months and this app has no rule for converting one into the other, so the ' +
        'period has to be written by hand.',
    };
  }

  const months = suspendedMonths ?? 3;
  const paragraph = suspendedMonths === null ? '1204.4J' : '1204.4K';
  const nextGrade = nextGradeTitle(grade);

  const text =
    `${date || '[DATE]'}. I UNDERSTAND THAT I AM ELIGIBLE BUT NOT RECOMMENDED FOR PROMOTION TO ` +
    `${nextGrade || '[GRADE]'} DUE TO MY RECENT NJP FOR VIOLATION OF ${articlePhrase(articles)} ` +
    `FOR A PERIOD OF ${months} MONTHS IAW MCO P1400.32, PAR ${paragraph}, UNLESS WAIVED BY ` +
    'APPROPRIATE AUTHORITY. I WAS ADVISED THAT WITHIN 5 WORKING DAYS AFTER ACKNOWLEDGMENT OF ' +
    'THIS ENTRY, A WRITTEN REBUTTAL CAN BE SUBMITTED AND THIS REBUTTAL WILL BE FILED IN MY ' +
    'OMPF. I CHOOSE (TO) (NOT TO) MAKE A REBUTTAL.';

  return {
    kind: 'entry',
    entry: { text, months, paragraph, fromSuspension: suspendedMonths !== null, missing },
  };
}

/**
 * What the commander intends after the counseling, which the 6105 paragraph
 * branches on and no field on the NAVMC 10132 answers.
 *
 * 4006.2r: "If the commander plans to process the Marine for judicial or
 * separation proceedings as a result of the deficiencies, include that
 * information in the entry. If the commander does not plan to process the
 * Marine for separation due to the deficiencies, include the following
 * sentence: 'I am advised that failure to take corrective action may result
 * in administrative separation or limitation on further service.'"
 *
 * Both are lawful entries and only the commander knows which, so this is a
 * control on the section rather than something inferred from the charge
 * sheet (Stephen's ruling, 2026-08-26).
 */
export type SeparationIntent = '' | 'processing' | 'not-processing';

export interface CounselingInput {
  /** Free text: what the commander directs. 4006.2r requires it. */
  correctiveAction: string;
  /** Free text: what the unit offers. 4006.2r requires it. */
  assistanceAvailable: string;
  intent: SeparationIntent;
  /** Free text, used only when `intent` is 'processing'. */
  processingDetail: string;
}

export interface CounselingEntry {
  /** The whole entry, paragraphs separated by a blank line. */
  text: string;
  /** The same content, one string per paragraph, in order. */
  paragraphs: string[];
  /** Named parts 4006.2r requires that the form does not carry. */
  missing: string[];
}

/**
 * The deficiencies, as the counseling entry states them.
 *
 * FROM THE GUILTY FINDINGS, not from every charged row. A row found Not
 * Guilty is not a deficiency the Marine is being counseled for, and putting
 * one in a service record entry records misconduct that was not found.
 */
export function counseledDeficiencies(formData: FormData): string[] {
  const rows: unknown = formData.offenses;
  if (!Array.isArray(rows)) return [];
  const out: string[] = [];
  for (const raw of rows) {
    const row = (raw ?? {}) as Record<string, unknown>;
    const finding = typeof row.finding === 'string' ? row.finding.trim() : '';
    const label = typeof row.articleLabel === 'string' ? row.articleLabel.trim() : '';
    if (finding !== 'Guilty' || label === '') continue;
    const summary = typeof row.summary === 'string' ? row.summary.trim() : '';
    out.push(summary === '' ? label : `${label} (${summary})`);
  }
  return out;
}

/** The exact sentence 4006.2r requires when no separation is contemplated. */
export const NO_SEPARATION_SENTENCE =
  'I am advised that failure to take corrective action may result in administrative separation ' +
  'or limitation on further service.';

/**
 * The rebuttal advisory, in the wording PAA 12/11 substituted.
 *
 * See this module's header for why the OMPF wording is used on the 6105 as
 * well as on the promotion restriction, when 4006.2r as printed still says
 * the document side of the SRB.
 */
export const REBUTTAL_ADVISORY =
  'I was advised that within 5 working days after acknowledgment of this entry a written ' +
  'rebuttal can be submitted and this rebuttal will be filed in my OMPF.';

/**
 * The Marine's election, on its own line.
 *
 * SEPARATE FROM THE ADVISORY ABOVE because it is the one sentence on the
 * entry the Marine acts on: they strike one option at acknowledgment.
 * Buried at the end of a paragraph it is easy to sign past.
 */
export const REBUTTAL_CHOICE = 'I choose (to) (not to) make a rebuttal.';

/**
 * The blank line between two paragraphs of an entry.
 *
 * STEPHEN, 2026-08-26: "we should have hard spaces in the Pg. 11", with the
 * paragraph breaks he wants laid out sentence by sentence. A 6105 runs to
 * five paragraphs and the entry used to print as one unbroken block, which
 * on a Page 11 is a wall of text a Marine signs without reading.
 *
 * SURVIVES THE FORM. `xfaEscape` in xfa-form-fill.ts turns every newline
 * into &#xD;, which is the carriage return an XFA multiline field breaks
 * on, so these reach the printed NAVMC 118(11) as real blank lines rather
 * than as collapsed whitespace.
 */
export const PARAGRAPH_BREAK = '\n\n';

/**
 * The 6105 administrative separation counseling entry, IRAM 4006.2r.
 *
 * WHAT THE APP FILLS AND WHAT IT CANNOT. The date and the deficiencies come
 * off the NJP. The corrective action and the assistance available are the
 * commander's and the unit's, and no field on a NAVMC 10132 holds either, so
 * they are inputs. Where one is empty the entry carries a named blank and
 * says so in `missing` rather than printing a counseling entry that counsels
 * nothing.
 */
export function separationCounselingEntry(
  formData: FormData,
  input: CounselingInput,
): CounselingEntry {
  const missing: string[] = [];

  const date = mctfsDate(str(formData, 'punishmentDate'));
  if (date === '') missing.push('the item 6 punishment date, which opens the entry');

  const deficiencies = counseledDeficiencies(formData);
  if (deficiencies.length === 0) {
    missing.push('a Guilty finding in items 1 and 5, which is what the counseling is about');
  }

  const corrective = input.correctiveAction.trim();
  if (corrective === '') {
    missing.push('the recommendation for corrective action, required by IRAM 4006.2r');
  }

  const assistance = input.assistanceAvailable.trim();
  if (assistance === '') {
    missing.push('the assistance available, required by IRAM 4006.2r');
  }

  // ONE PARAGRAPH PER ELEMENT OF THE ENTRY, in the breaks Stephen laid out
  // on 2026-08-26. The date, the deficiencies and the corrective action are
  // one thought and stay together; everything after it is a separate
  // statement the Marine is being told, and the last is the one they answer.
  const parts: string[] = [
    `${date || '[DATE]'}. Counseled this date concerning deficiencies; ` +
      `${deficiencies.join('; ') || '[DEFICIENCIES]'}. ` +
      `Recommended corrective action: ${corrective || '[CORRECTIVE ACTION]'}.`,
    `Assistance available: ${assistance || '[ASSISTANCE AVAILABLE]'}.`,
  ];

  if (input.intent === 'processing') {
    const detail = input.processingDetail.trim();
    if (detail === '') {
      missing.push(
        'what the Marine is being processed for. IRAM 4006.2r requires that information in ' +
          'the entry when the commander plans to process for judicial or separation proceedings.',
      );
    }
    parts.push(
      `As a result of these deficiencies you are being processed for ` +
        `${detail || '[JUDICIAL OR SEPARATION PROCEEDINGS]'}.`,
    );
  } else if (input.intent === 'not-processing') {
    parts.push(NO_SEPARATION_SENTENCE);
  } else {
    missing.push(
      'whether the commander plans to process for judicial or separation proceedings. IRAM ' +
        '4006.2r requires one of the two statements and the entry carries neither until it ' +
        'is set.',
    );
    parts.push('[SEPARATION PROCESSING STATEMENT, IRAM 4006.2R]');
  }

  parts.push(REBUTTAL_ADVISORY);
  parts.push(REBUTTAL_CHOICE);

  return { text: parts.join(PARAGRAPH_BREAK), paragraphs: parts, missing };
}

export interface NjpPage11 {
  /** Remarks1, the left column. The 6105 entry. */
  remarksLeft: string;
  /** Remarks2, the right column. The promotion restriction, or empty. */
  remarksRight: string;
  /** Name as item 18 carries it. */
  name: string;
  /** EDIPI as item 20 carries it. */
  edipi: string;
  /** Everything 4006.2r needs that the document does not yet carry. */
  missing: string[];
  /** Why the right column is empty, when it is. */
  restrictionOmitted: string | null;
}

/**
 * Both entries, laid out for one NAVMC 118(11).
 *
 * ONE FORM, TWO COLUMNS, Stephen's ruling on 2026-08-26. The 6105 goes left
 * and the promotion restriction right, so the Marine acknowledges the pair
 * in one sitting.
 *
 * THE RIGHT COLUMN IS OFTEN EMPTY, and that is correct rather than a
 * failure. IRAM 4006.3e reaches privates through corporals only, so a
 * sergeant's form carries the counseling entry alone. The reason is
 * returned so the section can say it rather than leaving a blank column
 * looking like a bug.
 */
export function njpPage11(formData: FormData, input: CounselingInput): NjpPage11 {
  const counseling = separationCounselingEntry(formData, input);
  const restriction = promotionRestrictionEntry(formData);

  // BOTH COLUMNS' GAPS, DEDUPED. The two entries open with the same date and
  // word the gap identically, so a clerk who left it unset must be told once
  // rather than twice. Set preserves first-seen order.
  const missing = [
    ...new Set([
      ...counseling.missing,
      ...(restriction.kind === 'entry' ? restriction.entry.missing : []),
    ]),
  ];

  return {
    remarksLeft: counseling.text,
    remarksRight: restriction.kind === 'entry' ? restriction.entry.text : '',
    name: str(formData, 'accusedName'),
    edipi: str(formData, 'accusedEdipi'),
    missing,
    restrictionOmitted: restriction.kind === 'entry' ? null : restriction.detail,
  };
}

export interface NjpPage11Document extends NjpPage11 {
  blob: Blob;
  filename: string;
}

/**
 * Fills the official NAVMC 118(11) with both entries.
 *
 * ROUTED THROUGH THE APP'S OWN PAGE 11 EXPORT rather than a second filler.
 * `exportOfficialForm` reads `documentType` and builds the datasets XML, so
 * this hands it a page11-shaped bag carrying the two columns. The form that
 * comes back is the official blank, still fillable, with the header dates
 * and the signature boxes left open because they are signed by hand.
 */
export async function renderNjpPage11(
  formData: FormData,
  input: CounselingInput,
): Promise<NjpPage11Document> {
  const page = njpPage11(formData, input);
  const { exportOfficialForm } = await import('@/lib/xfa-form-fill');
  const blob = await exportOfficialForm({
    formData: {
      documentType: 'page11',
      name: page.name,
      edipi: page.edipi,
      remarksLeft: page.remarksLeft,
      remarksRight: page.remarksRight,
    } as unknown as FormData,
    vias: [],
    references: [],
    enclosures: [],
    copyTos: [],
    paragraphs: [],
  });

  const slug =
    page.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'njp';

  return { ...page, blob, filename: `page11-njp-${slug}.pdf` };
}
