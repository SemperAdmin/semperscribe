// NAVMC 10132 (Unit Punishment Book) - date-family validators.
//
// Covers the blockers and warnings whose controlling instruction turns on a
// comparison between two of the form's date fields, plus the two rules that
// are date-adjacent (item 13's date-vs-checkbox exclusivity, and item 2's
// demand-vs-punishment interaction). Rule source: docs/NAVMC_10132_SPEC.md
// section 6, "6. Validators".
//
// TYPE-ONLY. The ValidationIssue contract lives in the shared validator
// module and is imported type-only here so this module never becomes a
// runtime dependency of it (matches the 10922 validator module's pattern).
import type { ValidationIssue } from '@/lib/letter-validators';

import type { FormData } from '@/types';
import { parseIsoDate } from '@/lib/navmc10132-date';
import {
  NAVMC_10132_DEMAND,
  navmc10132ExportGateStage,
  navmc10132StageAtLeast,
  type Navmc10132Offense,
} from '@/types/navmc';

/**
 * Item 1 offense rows. FormData is loosely typed, so narrow through unknown in
 * one named place rather than casting at each read site.
 */
function offenseRows(formData: FormData): Navmc10132Offense[] {
  const value = (formData as unknown as Record<string, unknown>).offenses;
  return Array.isArray(value) ? (value as Navmc10132Offense[]) : [];
}

function issue(
  id: string, severity: ValidationIssue['severity'],
  rule: string, citation: string, detail: string,
): ValidationIssue {
  return { id, severity, rule, citation, detail };
}

// ---------------------------------------------------------------------------
// V-06 - item 3 rights-certification date must not be after item 6.
// ---------------------------------------------------------------------------

/**
 * V-06 (blocker). The item 3 rights-certification date must fall on or
 * before the item 6 punishment date. The item 3 instruction requires the
 * certification to precede imposition. An equal date is legal (same-day
 * certification and imposition is the normal case), only a later
 * certification date is an error.
 *
 * Silent when either date is missing or fails strict ISO parsing, since the
 * rule cannot be evaluated without both real calendar dates.
 */
export function v06RightsCertificationNotAfterPunishment(formData: FormData): ValidationIssue[] {
  const attestDate = parseIsoDate(formData.rightsAttestDate);
  const punishDate = parseIsoDate(formData.punishmentDate);
  if (!attestDate || !punishDate) {
    return [];
  }
  if (attestDate.getTime() <= punishDate.getTime()) {
    return [];
  }
  return [
    issue(
      'navmc10132-v06-rights-cert-after-punishment',
      'block',
      'The item 3 rights-certification date is after the item 6 punishment date.',
      'Item 3 instruction: must precede imposition.',
      'Set the item 3 date to the same day as, or an earlier day than, the item 6 punishment date. Certification must precede imposition, it cannot follow it.',
    ),
  ];
}

// ---------------------------------------------------------------------------
// V-07 - item 11 appeal-advisement date must not be before item 6.
// ---------------------------------------------------------------------------

/**
 * V-07 (blocker). The item 11 appeal-advisement date must not fall before
 * the item 6 punishment date. The item 11 instruction says advisement is
 * normally the same date as imposition and in no case prior to it. An equal
 * date is legal, only an earlier advisement date is an error.
 *
 * Silent when either date is missing or fails strict ISO parsing.
 */
export function v07AppealAdvisementNotBeforePunishment(formData: FormData): ValidationIssue[] {
  const advisementDate = parseIsoDate(formData.appealAdvisementDate);
  const punishDate = parseIsoDate(formData.punishmentDate);
  if (!advisementDate || !punishDate) {
    return [];
  }
  if (advisementDate.getTime() >= punishDate.getTime()) {
    return [];
  }
  return [
    issue(
      'navmc10132-v07-appeal-advisement-before-punishment',
      'block',
      'The item 11 appeal-advisement date is before the item 6 punishment date.',
      'Item 11 instruction.',
      'Set the item 11 date to the same day as the item 6 punishment date, or later. The instruction allows same-day advisement but never an earlier date.',
    ),
  ];
}

// ---------------------------------------------------------------------------
// V-08 - item 13 is a date XOR the Not Appealed checkbox.
// ---------------------------------------------------------------------------

/**
 * V-08 (blocker). Item 13 must carry exactly one of: an appeal date
 * (`appealDate`) or the Not Appealed checkbox (`notAppealed`). Never both,
 * never neither. Emits a different issue id for each violated case so the
 * message can name the actual problem.
 *
 * Presence of `appealDate` is decided by a plain non-empty check, not by
 * `parseIsoDate`. Item 13's instruction is about which ONE of the two
 * item-13 controls was used, not about whether the typed date is a valid
 * calendar date, so a malformed-but-present string still counts as "the
 * date option was used" here. (Documented ambiguity, see module report.)
 *
 * STAGE-SCOPED, THE "-NEITHER" BRANCH ONLY (D-43, D-46, section 13.1: item
 * 13 belongs to pass 6). Item 13 is unreachable before pass 6, so an empty
 * item 13 on an earlier-stage document is not a defect, it is a field the
 * document has not gotten to yet. Silent rather than blocking when the
 * export-gate stage (`navmc10132ExportGateStage`, NOT `navmc10132Stage`,
 * see that function's own JSDoc for why the export gate defaults an absent
 * `stage` to `'complete'` rather than pass 1) has not reached pass 6.
 *
 * The "-both" branch is deliberately NOT stage-scoped. It fires only when
 * BOTH `appealDate` and `notAppealed` are already set, which cannot happen
 * on a document that has not reached item 13 yet, so it is silent on an
 * early-stage document on its own regardless of stage, and a document that
 * genuinely carries both values recorded is contradictory at any stage.
 */
export function v08AppealDateExclusiveOfNotAppealed(formData: FormData): ValidationIssue[] {
  const hasAppealDate = typeof formData.appealDate === 'string' && formData.appealDate.trim() !== '';
  const hasNotAppealed = formData.notAppealed === true;

  if (hasAppealDate && hasNotAppealed) {
    return [
      issue(
        'navmc10132-v08-item13-both',
        'block',
        'Item 13 carries both an appeal date and the Not Appealed checkbox.',
        'Item 13 instruction.',
        'Clear one of the two item 13 entries. If the accused appealed, remove the Not Appealed checkbox. If the accused did not appeal, remove the item 13 date.',
      ),
    ];
  }
  if (!hasAppealDate && !hasNotAppealed) {
    const stage = navmc10132ExportGateStage(formData);
    if (!navmc10132StageAtLeast(stage, 6)) return [];
    return [
      issue(
        'navmc10132-v08-item13-neither',
        'block',
        'Item 13 has neither an appeal date nor the Not Appealed checkbox set.',
        'Item 13 instruction.',
        'Enter the date the accused appealed, or check Not Appealed if the accused did not. Item 13 cannot be left blank.',
      ),
    ];
  }
  return [];
}

// ---------------------------------------------------------------------------
// W-09 - offense more than two years before item 6, mined from item 1 text.
// ---------------------------------------------------------------------------

const MONTH_NAMES: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

const ISO_DATE_IN_TEXT_RE = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
const MONTH_NAME_DATE_IN_TEXT_RE =
  /\b(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})\b/g;

/**
 * Pulls candidate offense dates out of a free-text item 1 summary.
 *
 * W-09 DECISION (documented per task instructions): the offense date is not
 * a structured field, it is embedded in item 1's free-text summary. Rather
 * than skip the rule entirely, this parses the text with two tolerant,
 * narrow patterns (bare ISO `YYYY-MM-DD`, and `D Mon YYYY` / `D Month YYYY`)
 * and warns ONLY when exactly one distinct, calendar-valid date is found in
 * the summary. Any of the following makes the row silent rather than a
 * guess:
 *   - no date-shaped text found,
 *   - more than one DISTINCT date-shaped match found (ambiguous: which one
 *     is the offense date versus, say, a reporting date or a second
 *     specification date mentioned in the same sentence),
 *   - a match that fails calendar validation (e.g. a rolled-over date).
 * This keeps the rule false-positive-averse at the cost of false negatives
 * on summaries that don't spell the date out in one of these two shapes.
 * That tradeoff is intentional: a missed warning here is recoverable (the
 * preparer still has to justify the case on the merits either way), a
 * fabricated one is not.
 */
function extractConfidentOffenseDate(summary: string): Date | null {
  if (!summary) {
    return null;
  }
  const found: Date[] = [];

  for (const m of summary.matchAll(ISO_DATE_IN_TEXT_RE)) {
    const iso = `${m[1]}-${m[2]}-${m[3]}`;
    const d = parseIsoDate(iso);
    if (d) {
      found.push(d);
    }
  }

  for (const m of summary.matchAll(MONTH_NAME_DATE_IN_TEXT_RE)) {
    const day = m[1].padStart(2, '0');
    const monthKey = m[2].toLowerCase();
    const month = MONTH_NAMES[monthKey];
    if (month === undefined) {
      continue;
    }
    const iso = `${m[3]}-${String(month + 1).padStart(2, '0')}-${day}`;
    const d = parseIsoDate(iso);
    if (d) {
      found.push(d);
    }
  }

  const distinctTimes = new Set(found.map((d) => d.getTime()));
  if (distinctTimes.size !== 1) {
    return null;
  }
  return found[0];
}

/**
 * W-09 (warning). An offense occurred more than two years before the item 6
 * punishment date. Checked per item 1 row, mined from that row's free-text
 * summary per the decision documented on `extractConfidentOffenseDate`.
 * Waivable by a knowing and intelligent waiver, which is why this warns
 * rather than blocks.
 *
 * Silent when the item 6 date is missing/unparseable, or when a given row
 * has no offense selected, or when no confident single date is found in
 * that row's summary.
 */
export function w09StaleOffenseDate(formData: FormData): ValidationIssue[] {
  const punishDate = parseIsoDate(formData.punishmentDate);
  if (!punishDate) {
    return [];
  }
  const cutoff = new Date(
    punishDate.getFullYear() - 2,
    punishDate.getMonth(),
    punishDate.getDate(),
  );

  const issues: ValidationIssue[] = [];
  offenseRows(formData).forEach((offense, index) => {
    if (!offense.articleLabel) {
      return;
    }
    const offenseDate = extractConfidentOffenseDate(offense.summary);
    if (!offenseDate) {
      return;
    }
    if (offenseDate.getTime() < cutoff.getTime()) {
      issues.push(
        issue(
          `navmc10132-w09-stale-offense-row-${index + 1}`,
          'warn',
          `The item 1 row ${index + 1} offense date appears to be more than two years before the item 6 punishment date.`,
          'MCM Part V para 1.f.(4), paraphrased: NJP is ordinarily barred for an offense more than two years old, MCO 5800.16 Vol 14 para 010702.',
          'Confirm the offense date read from the item 1 summary. If it is correct, NJP for an offense this old requires a knowing and intelligent waiver of the two-year bar from the accused before you proceed.',
        ),
      );
    }
  });
  return issues;
}

// ---------------------------------------------------------------------------
// W-11 - item 2 refusal/demand alongside item 6 punishment.
// ---------------------------------------------------------------------------

/**
 * W-11 (warning). Item 2 shows a refusal or a demand for trial, and item 6
 * nonetheless carries punishment. The item 2 instruction directs the case
 * be forwarded to the officer exercising court-martial jurisdiction instead
 * of proceeding to NJP. The two triggering demand values are the REFUSE
 * export string, and, when `accusedRefusedToSign` is true, any demand value
 * (including empty or ACCEPT), since a refusal to sign item 2 means the
 * accused's actual election is unrecorded and cannot be read as acceptance.
 *
 * Silent when item 6 carries no punishment entries.
 */
export function w11DemandOrRefusalWithPunishment(formData: FormData): ValidationIssue[] {
  const isRefuse = formData.demand === NAVMC_10132_DEMAND.REFUSE;
  const isUnsignedElection = formData.accusedRefusedToSign === true;
  if (!isRefuse && !isUnsignedElection) {
    return [];
  }
  if (!formData.punishments || formData.punishments.length === 0) {
    return [];
  }
  return [
    issue(
      'navmc10132-w11-demand-with-punishment',
      'warn',
      'Item 2 shows a demand for trial or an unrecorded election, but item 6 carries punishment.',
      'Item 2 instruction: forward to the officer exercising court-martial jurisdiction.',
      'Item 2 indicates the accused demanded trial by court-martial, or refused to sign so no election is recorded. Forward this case to the officer exercising court-martial jurisdiction rather than imposing NJP in item 6.',
    ),
  ];
}

// ---------------------------------------------------------------------------
// Aggregate
// ---------------------------------------------------------------------------

/**
 * Runs every date-family validator (V-06, V-07, V-08, W-09, W-11) and
 * returns the combined issue list. Group functions each return `[]` when
 * their rule does not apply, so this is a plain concatenation.
 */
export function dateIssues(formData: FormData): ValidationIssue[] {
  return [
    ...v06RightsCertificationNotAfterPunishment(formData),
    ...v07AppealAdvisementNotBeforePunishment(formData),
    ...v08AppealDateExclusiveOfNotAppealed(formData),
    ...w09StaleOffenseDate(formData),
    ...w11DemandOrRefusalWithPunishment(formData),
  ];
}
