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
    // THE UCMJ ARTICLE, NOT THE MCTFS CODE, and the two diverge on twenty of
    // this app's labels. Found on 2026-08-27 while wiring the 1204.4q drug
    // restriction: an Art. 112a NJP printed "art 112A" because mctfsCode
    // carries the upper-case form. Pulling that thread showed worse, because
    // every Art. 134 label carries a sub-code, so a disorderly conduct NJP
    // was writing "violation of art 134.96" onto a service record entry.
    // 134.96 is a transaction code for the unit diary. It is not an article
    // of the Uniform Code, and a Marine acknowledging that entry would be
    // signing a citation to something no reader could look up.
    //
    // LOWERCASED, because the entry is sentence case: "art 112a".
    const number = (article?.articleNumber ?? '').toLowerCase();
    if (number !== '' && !out.includes(number)) out.push(number);
  }
  return out;
}

/** "ART 92", or "ART 86 AND ART 92" for more than one. */
function articlePhrase(numbers: readonly string[]): string {
  // LOWERCASE 'art', because the entry is sentence case. Stephen supplied
  // the promotion restriction in ALL CAPS on 2026-08-26 and in sentence case
  // on 2026-08-27, and ruled for the latter: "art 123", "par 1204.4j".
  const parts = numbers.map((n) => `art ${n}`);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
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
  // Lowercase, matching the sentence-case entry: 'promotion to sergeant'.
  return rank ? rank.title.toLowerCase() : '';
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

/**
 * The date both Page 11 entries open with.
 *
 * ITEM 10, NOT ITEM 6. Stephen, 2026-08-27: "item 10 is the date of NJP",
 * and both columns of his layout open with "[Item 10 date in YYYYMMDD]".
 * Item 10 is the date of notice to the accused of final disposition taken,
 * which is the day the Marine is stood in front of the entry, so it is the
 * date the entry is counseled on.
 *
 * SCOPED TO THE PAGE 11, on his ruling the same day. Item 6 still drives the
 * unit diary NJP DATE and every MCTFS DOA and ED, because PRIUM 70508 fixes
 * the TTC 212 Date of Action as "the date the Courts-martial or Nonjudicial
 * Punishment is adjudged". Adjudged is item 6. Item 10 can fall later, and a
 * diary entry priced on the notice date would report the wrong DOA.
 */
export function page11Date(formData: FormData): string {
  return mctfsDate(str(formData, 'dispositionNoticeDate'));
}

/** Worded once, because both columns open with this date and njpPage11
 *  merges their gap lists. A clerk is told about it one time. */
export const PAGE11_DATE_GAP =
  'the item 10 disposition notice date, which both entries open with';

/**
 * The offence labels that put a Marine under MCO P1400.32D par 1204.4q.
 *
 * WHY LABELS AND NOT ARTICLE NUMBERS. Article 92 carries twenty-two labels
 * in this app and nineteen of them have nothing to do with a substance:
 * hazing, fraternization, extremism, intimate images. Keying 1204.4q to
 * "art 92" would put an eighteen-month drug restriction on a Marine who
 * violated the harassment order. The label is where the subject matter
 * lives, so the label is what this reads.
 *
 * THE FOUR CERTAIN ONES, Stephen's ruling 2026-08-27 after I put six in
 * front of him. 1204.4q reaches "distribution, use, or possession of
 * illegal drugs", which is the first two, and "the abuse of a legal
 * substance with the intent to obtain a 'high', i.e., huffing, spice, etc.",
 * which is the OTC and Natural labels.
 *
 * DELIBERATELY EXCLUDED, and each for a stated reason:
 *
 *  - SECNAVINST 5300.28 (Paraphernalia). A pipe is not distribution, use or
 *    possession of a drug. Left out pending his ruling.
 *  - ALNAV 074/20 (Hemp Use). Hemp is federally legal and CBD use is
 *    frequently not for a high at all, so it does not plainly sit inside
 *    q's second clause. Left out pending his ruling.
 *  - Every alcohol label: Art. 95 drunk on post, Art. 112 drunk on duty and
 *    drunkenness, Art. 134 drunkenness and drunk and disorderly. Alcohol is
 *    not an illegal drug, and 1204.4 handles alcohol conduct at r rather
 *    than folding it into q.
 *  - Art. 113 drunken or reckless operation. That is 1204.4r, which Stephen
 *    ruled out on 2026-08-27: "not everyone who is NJPed was convicted".
 *
 * KNOWN HOLE. The four Art. 134 General Article labels carry no subject
 * matter, so a general-article drug offence is invisible to any rule reading
 * labels. Nothing here fixes that.
 */
export const DRUG_RESTRICTION_OFFENSE_LABELS: readonly string[] = [
  'Art. 112a  Wrongful use, possession, etc. of controlled substances',
  'Art. 92  Viol. SECNAVINST 5300.28 (series) (Controlled Substance)',
  'Art. 92  Viol. SECNAVINST 5300.28 (series) (OTC Substance)',
  'Art. 92  Viol. SECNAVINST 5300.28 (series) (Natural Substance)',
];

/** The 1204.4q period, in months. The order fixes it; nothing derives it. */
export const DRUG_RESTRICTION_MONTHS = 18;

/**
 * True where an offence found GUILTY puts this NJP under 1204.4q.
 *
 * GUILTY ONLY, same rule the deficiencies and the article phrase use. A row
 * found Not Guilty restricts nothing.
 */
export function drugRestrictionApplies(formData: FormData): boolean {
  const rows: unknown = formData.offenses;
  if (!Array.isArray(rows)) return false;
  return rows.some((raw) => {
    const row = (raw ?? {}) as Record<string, unknown>;
    const finding = typeof row.finding === 'string' ? row.finding.trim() : '';
    const label = typeof row.articleLabel === 'string' ? row.articleLabel.trim() : '';
    return finding === 'Guilty' && DRUG_RESTRICTION_OFFENSE_LABELS.includes(label);
  });
}

/**
 * The date the 1204.4q clock starts, which is NOT the date of the NJP.
 *
 * Stephen, 2026-08-27: "q is before the NJP and would cover the period of
 * the NJP so it would supersede the NJP but would be effective possibly
 * before the NJP took place."
 *
 * The order agrees. The eighteen months "will begin on the date positive
 * confirmation is received from the DoD-certified drug testing laboratory in
 * the case of urinalysis detection, or from the date of the illegal drug
 * incident". Neither is on the NAVMC 10132 and neither is derivable from it,
 * so the app collects it the way it collects years of service, and prints a
 * named blank until it has it.
 */
export function drugRestrictionStart(formData: FormData): string {
  return mctfsDate(str(formData, 'drugRestrictionStartDate'));
}

/** Named once. The Page 11 section collects it and the entry opens on it. */
export const DRUG_RESTRICTION_DATE_GAP =
  'the date of positive laboratory confirmation or of the drug incident, which starts the ' +
  '18-month restriction under MCO P1400.32D par 1204.4q';

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
  const date = page11Date(formData);
  // WORDED IDENTICALLY to separationCounselingEntry's, on purpose: njpPage11
  // merges the two lists and a clerk should be told once, not twice.
  if (date === '') missing.push(PAGE11_DATE_GAP);

  const drugOffense = drugRestrictionApplies(formData);
  const hasSuspension = suspensions(formData).length > 0;
  const suspendedMonths = longestSuspensionMonths(formData);

  // A SUSPENSION IN DAYS ONLY BLOCKS THE ENTRY WHERE THE PERIOD DEPENDS ON
  // IT. Under 1204.4j and 1204.4k the suspension IS the period, so days
  // leave the app unable to say which paragraph applies or for how long, and
  // it refuses. Under 1204.4q the order fixes the period at eighteen months
  // regardless, so the entry is fully computable and the days affect only
  // the additional k sentence, which becomes a named gap instead.
  if (!drugOffense && hasSuspension && suspendedMonths === null) {
    return {
      kind: 'unavailable',
      reason: 'suspension-not-in-months',
      detail:
        'Item 7 states a suspension in days rather than months. The restriction period is ' +
        'stated in months and this app has no rule for converting one into the other, so the ' +
        'period has to be written by hand.',
    };
  }
  if (drugOffense && hasSuspension && suspendedMonths === null) {
    missing.push(
      'the probationary period under MCO P1400.32D par 1204.4k. Item 7 states the suspension ' +
        'in days and the paragraph states periods in months, so that sentence has to be ' +
        'written by hand. The 18-month drug restriction below is unaffected.',
    );
  }

  /**
   * WHICH PARAGRAPH OF 1204.4 GOVERNS, and it is not always the NJP one.
   *
   * 1204.4q carries a NOTE in the order's own words: "This promotion
   * restriction does take precedence over the restrictions contained in
   * paragraphs 1204.4g, 1204.4h, and 1204.4j." j is the NJP paragraph, so a
   * drug offence displaces it outright.
   *
   * THE NOTE DOES NOT NAME k, and the omission is doing work. k is the
   * probationary status a suspended punishment creates, and the order left
   * it standing where it removed g, h and j. So on a drug NJP with a
   * suspended portion this entry states BOTH restrictions rather than
   * choosing. 1204.5 requires the entry to include "the specific promotion
   * restriction that applies and the period of time the restriction remains
   * in effect", and on that document two apply.
   *
   * THIS IS THE ONE INFERENCE IN THIS FUNCTION, flagged rather than buried.
   * Stephen ruled the article list on 2026-08-27 and did not rule the q and
   * k interaction. Stating a restriction that applies is the safer error
   * than omitting one, and the omission from the NOTE is the textual basis.
   */
  const drug = drugOffense;
  const months = drug ? DRUG_RESTRICTION_MONTHS : (suspendedMonths ?? 3);
  // LOWERCASE IN THE ENTRY, which is sentence case: "par 1204.4j". The
  // PromotionRestriction.paragraph field keeps the same string, so a caller
  // reporting which paragraph governs reads exactly what prints.
  const paragraph = drug ? '1204.4q' : suspendedMonths === null ? '1204.4j' : '1204.4k';
  const nextGrade = nextGradeTitle(grade);

  // The q clock runs from the laboratory confirmation or the incident, not
  // from the NJP, so the period sentence needs a date the form does not
  // carry. Blank prints as a named blank, the same discipline the rest of
  // this module uses.
  const drugStart = drug ? drugRestrictionStart(formData) : '';
  if (drug && drugStart === '') missing.push(DRUG_RESTRICTION_DATE_GAP);

  // SENTENCE CASE, from Stephen's 2026-08-27 layout, which replaces the ALL
  // CAPS he gave on 2026-08-26. He confirmed the case change when asked
  // rather than leaving it to be read as chat typing.
  //
  // THE BODY RUNS ON FROM THE DATE. His layout put a line break after it and
  // he corrected that on the printed form the same day: "the right hand
  // needs to start after the date not the line under." Which also matches
  // the 6105 in the left column, where the date has always opened the first
  // sentence rather than standing on a line of its own.
  //
  // THE REBUTTAL SENTENCE HERE IS NOT THE LEFT COLUMN'S. He sent both in one
  // message with different wording, and they rest on different paragraphs:
  // 4006.3e here, 4006.2r there. This one keeps "acknowledgment of", "can be
  // submitted" and "my OMPF"; the 6105 does not.
  /**
   * THE PERIOD SENTENCE, which differs on a drug NJP in three ways.
   *
   *  1. Eighteen months rather than three or the suspension's own length.
   *  2. It states WHEN the period runs from, because 1204.4q's clock starts
   *     at the laboratory confirmation or the incident and Stephen's point
   *     stands: that date falls before the NJP, so an entry stating only a
   *     length leaves the reader to assume it runs from the NJP and to
   *     compute an end date months too late.
   *  3. NO WAIVER CLAUSE. Paragraph 1204.6: "No waivers of the promotion
   *     restrictions resulting from illegal drug use/possession will be
   *     granted." Printing "unless waived by appropriate authority" on a
   *     drug entry states a remedy the order forbids, so it comes off. This
   *     is the order's own sentence rather than an inference.
   */
  const period = drug
    ? `for a period of ${months} months from ${drugStart || '[DATE OF CONFIRMATION OR INCIDENT]'} ` +
      `IAW MCO P1400.32, par ${paragraph}`
    : `for a period of ${months} months IAW MCO P1400.32, par ${paragraph}, unless waived by ` +
      'appropriate authority';

  // The suspended-probation restriction, stated ALONGSIDE q rather than
  // instead of it. See the paragraph-selection note above for why the
  // order's NOTE leaves k standing where it removes j.
  const alsoProbationary =
    drug && suspendedMonths !== null
      ? ` I further understand that I am in a probationary status for ${suspendedMonths} months ` +
        'IAW MCO P1400.32, par 1204.4k, because a portion of this punishment is suspended.'
      : '';

  const text =
    `${date || '[DATE]'}. ` +
    `I understand that I am eligible but not recommended for promotion to ` +
    `${nextGrade || '[grade]'} due to my recent NJP for violation of ${articlePhrase(articles)} ` +
    `${period}.${alsoProbationary} I was advised that within 5 working days after ` +
    'acknowledgment of this entry, a written rebuttal can be submitted, and this rebuttal ' +
    'will be filed in my OMPF. I choose (to) (not to) make a rebuttal.' +
    `${PARAGRAPH_BREAK}\n${SIGNATURE_BLOCK}`;

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
 * The consequences-of-discharge sentence, stated in EVERY 6105 counseling
 * entry regardless of whether the commander is processing for separation.
 *
 * Stephen supplied it 2026-08-27 as the tail of paragraph 2. It is
 * unconditional in his layout, which is right: it warns the Marine what a
 * less-than-honorable characterization costs them, and that warning does not
 * depend on whether anybody is processing them today.
 */
export const DISCHARGE_CONSEQUENCES_SENTENCE =
  'I understand that failure to complete my enlistment contract with an honorable ' +
  'characterization of service may preclude my eligibility for benefits from the Department ' +
  'of Veterans Affairs or other organizations and have an adverse effect on future civilian ' +
  'employment.';

/**
 * The acknowledgment block that closes every Page 11 entry.
 *
 * TYPED INTO THE REMARKS, not left to the form. Stephen, 2026-08-27, gave it
 * at the foot of both columns. A NAVMC 118(11) column holds more than one
 * entry over a Marine's career, so each entry carries its own signature
 * lines; a single pair of boxes at the foot of the page would not say which
 * entry was being acknowledged.
 *
 * THE SPACE COUNT IS COMPUTED, NOT EYEBALLED, and the first attempt was
 * eyeballed and wrong. Stephen, 2026-08-27, looking at the printed form:
 * "we need the Signature of Co start at the same position as the line above
 * it." It did not, because this block was padded as if the field were
 * monospaced. The NAVMC 118(11) remarks columns render in Times New Roman,
 * where a space is 250 units per em and an underscore is 500, so equal
 * character counts give unequal widths.
 *
 * Measured off his screenshot to confirm the face before trusting the
 * numbers: "Signature of Marine" renders 0.766 of the width of 21
 * underscores, and Times metrics predict 0.767.
 *
 * The arithmetic, in units per 1000 em:
 *
 *   rule 2 starts at   21 underscores + 10 spaces  = 10500 + 2500 = 13000
 *   label 2 must start at the same place
 *   "Signature of Marine"                          =  8054
 *   so the label needs (13000 - 8054) / 250        = 19.8 spaces
 *
 * Twenty is the closest whole number, leaving the label 54 units (0.054 em)
 * right of the rule, which is under a tenth of a space. See
 * tests/navmc10132-page11.test.ts, which recomputes this rather than
 * hard-coding the space count, so a change to either string is caught.
 *
 * SPACES RATHER THAN A TAB, because an XFA multiline field has no tab stops
 * and a literal tab renders differently in every viewer.
 */
/**
 * The same acknowledgment, laid out for the app's own NAVMC 118(11).
 *
 * STACKED, NOT SIDE BY SIDE, and the reason is measurement rather than
 * taste. drawSimpleColumn in services/pdf/navmc11811Generator draws these
 * columns in Courier at 9pt and wraps them by CHARACTER COUNT at 48, not by
 * measured width:
 *
 *   drawSimpleColumn(page, data.remarksLeft, PAGE11_BOXES.remarksLeft,
 *                    monoFont, 9, 10, 48)
 *
 * The side-by-side block breaks on that count alone. Its rule line is 52
 * characters and splits into a 30-character fragment and a 21-character one;
 * its label line is 54 and splits with "of CO" orphaned onto a fourth line.
 * Two rules render as three fragments with a dangling signer, which is the
 * page Stephen reported on 2026-08-27.
 *
 * The padding is NOT the problem, contrary to two earlier revisions of this
 * comment. n consecutive spaces split into n - 1 empty strings and rejoin as
 * n spaces, so alignment survives the wrapper intact. Only the count breaks
 * it. The test writes out all four rendered lines rather than describing
 * them, because both wrong explanations passed a green suite.
 *
 * The stacked block has no line over 30 characters, so every line clears the
 * 48-character measure and the wrapper returns it unchanged.
 *
 * VERTICAL BUDGET. The column box is 400pt tall at a 10pt line height, so 40
 * lines, and drawSimpleColumn breaks out of the loop when it runs past the
 * bottom rather than reporting it. The counseling entry renders 32 of those
 * 40 lines on a short corrective action, this block included. A long enough
 * item 3 or item 4 will clip silently, the same defect item 21 had.
 *
 * TWO BLOCKS RATHER THAN ONE COMPROMISE. The official form renders 9pt
 * Times into a 266.5pt column, where the side-by-side block measures 211.5pt
 * and fits, and Stephen tuned its alignment by hand on 2026-08-27. Forcing
 * one layout on both would either break on the app or undo work he approved
 * on the form. Each block is measured against the renderer that draws it,
 * and the tests assert both.
 *
 * TWO BLANK LINES IN EACH GAP, Stephen 2026-08-28: "lets add two hard spaces
 * between the I choose (to) (not to) make a rebuttal. and the MArine
 * signature and the Marine signature and the co signature line." Blank lines
 * survive this renderer: split('\n') yields '', wrapTextByCharCount returns
 * [''] for it, and the draw loop still spends a line height on it.
 */
export const APP_PAGE11_SIGNATURE_BLOCK =
  '______________________________\n' +
  'Signature of Marine\n' +
  '\n' +
  '\n' +
  '______________________________\n' +
  'Signature of CO';

/** Which renderer the entry is being laid out for. */
export type SignatureBlockTarget = 'official-form' | 'app-page11';

export const SIGNATURE_BLOCK =
  '_____________________          _____________________\n' +
  'Signature of Marine                    Signature of CO';

/**
 * The rebuttal advisory, in the wording PAA 12/11 substituted.
 *
 * See this module's header for why the OMPF wording is used on the 6105 as
 * well as on the promotion restriction, when 4006.2r as printed still says
 * the document side of the SRB.
 */
export const REBUTTAL_ADVISORY =
  'I was advised that within 5 working days after acknowledging this entry I may submit a ' +
  'written rebuttal which will be filed in the electronic service record.';

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

  const date = page11Date(formData);
  if (date === '') missing.push(PAGE11_DATE_GAP);

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

  // FOUR PARAGRAPHS, VERBATIM FROM STEPHEN'S 2026-08-27 LAYOUT. It replaces
  // the 2026-08-26 one, and the changes are his rather than editorial:
  //
  //  1. The date and the deficiencies alone. The corrective action moved out.
  //  2. Corrective action and assistance in ONE sentence, followed by the
  //     discharge-consequences warning, which is unconditional.
  //  3. The separation statement, which branches. See below.
  //  4. The advisory and the election in ONE paragraph, no longer two, and
  //     reworded: "acknowledging" for "acknowledgment of", "I may submit"
  //     for "can be submitted", and "the electronic service record" for
  //     "my OMPF".
  //
  // THE RIGHT COLUMN KEEPS THE OLDER WORDING on purpose. Stephen sent both
  // columns in the same message with different rebuttal sentences, and they
  // cite different paragraphs, 4006.2r here and 4006.3e there. Do not
  // "harmonise" them.
  const parts: string[] = [
    `${date || '[DATE]'}. Counseled this date concerning the following deficiencies: ` +
      `${deficiencies.join('; ') || '[DEFICIENCIES]'}.`,
    `Specific recommendations for corrective action are ` +
      `${corrective || '[CORRECTIVE ACTION]'} and to seek assistance, which is available ` +
      `through the chain of command and ${assistance || '[ASSISTANCE AVAILABLE]'}. ` +
      DISCHARGE_CONSEQUENCES_SENTENCE,
  ];

  // BOTH BRANCHES SURVIVE. Stephen's layout shows only the processing
  // sentence, and he ruled on 2026-08-27 that the not-processing case keeps
  // IRAM 4006.2r's own sentence. The paragraph is one or the other and never
  // neither: 4006.2r requires one of the two statements in every entry.
  if (input.intent === 'processing') {
    const detail = input.processingDetail.trim();
    if (detail === '') {
      missing.push(
        'what the Marine is being processed for. IRAM 4006.2r requires that information in ' +
          'the entry when the commander plans to process for judicial or separation proceedings.',
      );
    }
    parts.push(
      `I understand that I am being processed for the following judicial or adverse ` +
        `administrative action: ${detail || '[JUDICIAL OR ADVERSE ADMINISTRATIVE ACTION]'}.`,
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

  parts.push(`${REBUTTAL_ADVISORY} ${REBUTTAL_CHOICE}`);

  return {
    text: `${parts.join(PARAGRAPH_BREAK)}${PARAGRAPH_BREAK}\n${SIGNATURE_BLOCK}`,
    paragraphs: parts,
    missing,
  };
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
export interface NjpPage11Options {
  /**
   * Which renderer the entries are laid out for.
   *
   * BOTH TARGETS CARRY THE LINES. Stephen, 2026-08-27: "we still need the
   * line and the signature of member and signature of CO." An earlier
   * revision stripped them from the app's Page 11 on the reasoning that the
   * path places real CAC fields, which was wrong: the acknowledgment lines
   * are part of the entry a Marine signs, and a placed field sits ON one
   * rather than replacing it.
   *
   * WHAT DIFFERS IS THE LAYOUT, because the two renderers are not alike.
   * The official form draws 9pt Times into a 266.5pt column and takes the
   * side-by-side block at 211.5pt. The app draws 11pt Helvetica into a 261pt
   * column, where the same block measures 287.5pt and wraps, and its
   * wrapText splits on ' ' so the padding is destroyed before it is
   * measured. See APP_PAGE11_SIGNATURE_BLOCK.
   */
  signatureBlock?: SignatureBlockTarget;
}

/**
 * Swaps the block the entry builders appended for the target's own.
 *
 * AN EXACT SUFFIX MATCH, NOT A PATTERN OVER ITS WORDS. A differential
 * proved this needed saying: a regex over "Signature of Marine" passed every
 * test, because no entry happened to contain that phrase in its body. One
 * realistically can. A clerk directing a Marine to "obtain the Signature of
 * Marine Corps counsel" writes it into the corrective action, and a pattern
 * would eat that sentence and everything after it, including the rebuttal
 * election the Marine answers.
 */
function retargetSignatureBlock(text: string, target: SignatureBlockTarget): string {
  if (target === 'official-form') return text;
  const suffix = `${PARAGRAPH_BREAK}\n${SIGNATURE_BLOCK}`;
  if (!text.endsWith(suffix)) return text;
  // TWO blank lines before the first rule, matching the gap the official
  // form already opens above its own block.
  return `${text.slice(0, -suffix.length)}${PARAGRAPH_BREAK}\n${APP_PAGE11_SIGNATURE_BLOCK}`;
}

export function njpPage11(
  formData: FormData,
  input: CounselingInput,
  options: NjpPage11Options = {},
): NjpPage11 {
  const target = options.signatureBlock ?? 'official-form';
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
    remarksLeft: retargetSignatureBlock(counseling.text, target),
    remarksRight:
      restriction.kind === 'entry'
        ? retargetSignatureBlock(restriction.entry.text, target)
        : '',
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
