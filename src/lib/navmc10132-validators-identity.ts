/**
 * NAVMC 10132 (Unit Punishment Book) validators, identity group.
 *
 * Covers the blockers and warnings concerned with the accused and NJP
 * authority's identity data, field capacity, item 17's unit, item 21's
 * remark formatting, and the four MCM Part V 1.f warnings that touch more
 * than one offense or more than one document. Rule source, citations, and
 * the ValidationIssue contract come from docs/NAVMC_10132_SPEC.md section
 * 6 (rules V-09 through V-12, W-04, W-10, W-13 through W-16).
 *
 * Two-space indent. Prose in comments and in issue text avoids em-dashes
 * and semicolons, periods, commas, and hyphens only, per house style.
 */

// TYPE-ONLY. Neither of these modules is touched at runtime, only their
// shapes are used, so both imports erase during the TypeScript build and
// need no runtime module to exist.
import type { FormData } from '@/types';
import type {
  Navmc10132Offense,
  Navmc10132PunishmentEntry,
} from '@/types/navmc';

import {
  fitsInField,
  overflowBy,
  isPrescribedFormat,
} from '@/lib/navmc10132-utils';

/** The shared validator issue contract used across every NAVMC 10132 rule group. */
export interface ValidationIssue {
  id: string; // 'navmc10132-<slug>'
  severity: 'block' | 'fail' | 'warn'; // blockers use 'block', warnings use 'warn'
  rule: string; // one sentence, what is wrong
  citation: string; // the controlling source, verbatim enough to look up
  detail: string; // what the user should do about it
}

function issue(
  id: string,
  severity: ValidationIssue['severity'],
  rule: string,
  citation: string,
  detail: string,
): ValidationIssue {
  return { id, severity, rule, citation, detail };
}

/**
 * FormData is loosely typed across the app, so every accessor below reads
 * with `(formData.x as T) ?? fallback` rather than trusting a strict shape.
 * This mirrors the convention documented for the section components.
 */
function str(formData: FormData, key: string): string {
  const value = (formData as unknown as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : '';
}

function arr<T>(formData: FormData, key: string): T[] {
  const value = (formData as unknown as Record<string, unknown>)[key];
  return Array.isArray(value) ? (value as T[]) : [];
}

// ---------------------------------------------------------------------------
// V-09: every capacity-bound field is within its measured width
// ---------------------------------------------------------------------------

interface CapacityField {
  /** Exact AcroForm field name, byte-exact per navmc10132-map.json. */
  field: string;
  /** Item number as printed on the form, for the message. */
  item: string;
  value: string;
}

/**
 * The eleven capacity-bound fields named in the spec. Offense summaries come
 * from the offenses array, everything else is a flat FormData string field.
 * Deliberately does not include every text field on the form, only the ones
 * the spec calls out as capacity-checked here.
 */
function capacityFields(formData: FormData): CapacityField[] {
  const offenses = arr<Navmc10132Offense>(formData, 'offenses');
  const summaryRows: CapacityField[] = ['1A', '1B', '1C', '1D', '1E'].map((letter, i) => ({
    field: `${letter} SUMMARY`,
    item: letter,
    value: offenses[i]?.summary ?? '',
  }));
  return [
    ...summaryRows,
    {
      field: '4 CURRENT UAS OVER 24 HRS AND MARKS OF DESERTION',
      item: '4',
      value: str(formData, 'unauthorizedAbsences'),
    },
    { field: '7 SUSPENSION IF ANY', item: '7', value: str(formData, 'suspension') },
    {
      field: '8 NJP AUTHORITY NAME TITLE SERVICE',
      item: '8',
      value: str(formData, 'njpAuthorityName'),
    },
    { field: '8A NJP AUTHORITY GRADE', item: '8A', value: str(formData, 'njpAuthorityGrade') },
    { field: '14 APPEAL DECISION', item: '14', value: str(formData, 'appealDecision') },
    { field: '17 UNIT', item: '17', value: str(formData, 'unit') },
    { field: '18 ACCUSED FULL NAME', item: '18', value: str(formData, 'accusedName') },
    { field: '16 FINAL ADMIN UD', item: '16', value: str(formData, 'finalAdminUd') },
    { field: '16 FINAL ADMIN DTD', item: '16', value: str(formData, 'finalAdminDtd') },
    { field: '21 REMARKS', item: '21', value: str(formData, 'remarksComposed') },
  ];
}

/**
 * V-09. Every capacity-bound field must fit its measured widget width.
 *
 * Uses fitsInField/overflowBy from the engine rather than a character count.
 * Every widget renders at Arial 8pt, none auto-shrink, and Arial is
 * proportional, so a character-count check would pass strings that clip
 * silently on export (section 2.2 of the spec) and fail strings that do fit.
 */
export function checkFieldCapacities(formData: FormData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const { field, item, value } of capacityFields(formData)) {
    if (value === '') continue;
    if (fitsInField(field, value)) continue;
    const overflow = overflowBy(field, value);
    issues.push(
      issue(
        `navmc10132-v09-overflow-${field.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        'block',
        `Item ${item} ("${field}") does not fit its measured field width.`,
        'NAVMC 10132 capacity map section 2.2, silent clipping',
        `The text in item ${item} is ${overflow.toFixed(1)} points wider than the ` +
          `"${field}" widget can render at 8pt Arial. No widget on this form auto-shrinks, ` +
          'so the excess clips silently on export with no on-screen warning. Shorten the ' +
          'text. Do not rely on a character count to judge this, Arial is proportional and ' +
          'a short string of wide characters can overflow while a longer string of narrow ' +
          'characters fits.',
      ),
    );
  }
  return issues;
}

// ---------------------------------------------------------------------------
// V-10: accused name, rank, and EDIPI present
// ---------------------------------------------------------------------------

/**
 * V-10. Items 18 through 20 (accused full name, rank/grade, EDIPI) must all
 * be present.
 *
 * Also notes, in the detail, that items 23 to 25 on page 2 are copies of
 * these three fields. The official form only populates 23 to 25 through its
 * own on-blur JavaScript (see the form's calculationOrder), and the app does
 * not run PDF JavaScript, so the app itself has to write items 23 to 25 from
 * this same data at export time. That is downstream of this validator, but a
 * preparer reading this message should know why fixing 18 to 20 alone is
 * enough.
 */
export function checkAccusedIdentity(formData: FormData): ValidationIssue[] {
  const fields: Array<{ item: string; label: string; value: string }> = [
    { item: '18', label: 'full name', value: str(formData, 'accusedName') },
    { item: '19', label: 'rank/grade', value: str(formData, 'accusedRankGrade') },
    { item: '20', label: 'EDIPI', value: str(formData, 'accusedEdipi') },
  ];
  const missing = fields.filter((f) => f.value.trim() === '');
  if (missing.length === 0) return [];
  const missingList = missing.map((f) => `item ${f.item} (${f.label})`).join(', ');
  return [
    issue(
      'navmc10132-v10-accused-identity-incomplete',
      'block',
      `The accused's identity is incomplete, ${missingList} is blank.`,
      'Items 18-20 and MCO 5800.16 Vol 14 para 011103',
      `Enter ${missingList} before export. MCO 5800.16 Vol 14 para 011103 requires that ` +
        "any additional sheet attached to this form carry the Marine's name and EDIPI, so " +
        'these three fields have to be right before anything else can be trusted. Note that ' +
        'items 23 to 25 on page 2 are meant to be exact copies of items 18 to 20, the ' +
        'official blank only fills them through its own on-blur JavaScript, and the app ' +
        'does not run PDF JavaScript, so the app writes 23 to 25 itself from this same data ' +
        'at export time. Completing 18 to 20 here is what makes that copy correct.',
    ),
  ];
}

// ---------------------------------------------------------------------------
// V-11: item 17 names a company-sized unit up to the first GCMCA
// ---------------------------------------------------------------------------

/**
 * V-11. Item 17 must name the accused's unit.
 *
 * Whether item 17 correctly names a company-sized unit up to the first
 * officer exercising general court-martial jurisdiction in the chain of
 * command is a judgment call the app has no data to make, it would need the
 * command's full command relationship, which is not part of this form. The
 * app only enforces that the field is not blank, that much is a real defect
 * regardless of echelon. A shallow, honestly-labeled shape check is added on
 * top as a warning, it proves nothing about the echelon chain and says so.
 */
export function checkUnitEchelon(formData: FormData): ValidationIssue[] {
  const unit = str(formData, 'unit').trim();
  if (unit === '') {
    return [
      issue(
        'navmc10132-v11-unit-blank',
        'block',
        'Item 17 (unit) is blank.',
        'Item 17 instruction',
        'Enter the unit responsible for imposing this NJP. Item 17 must name a ' +
          'company-sized unit up to the first officer exercising general court-martial ' +
          'jurisdiction (GCMCA) in the chain of command. The app has no command ' +
          'relationship data and cannot determine which unit that is, only that item 17 ' +
          'cannot be empty.',
      ),
    ];
  }
  const accusedName = str(formData, 'accusedName').trim();
  if (accusedName !== '' && unit.toLowerCase() === accusedName.toLowerCase()) {
    return [
      issue(
        'navmc10132-v11-unit-matches-accused-name',
        'warn',
        "Item 17 (unit) is identical to item 18 (the accused's name).",
        'Item 17 instruction',
        "Item 17 and item 18 hold the same text, which usually means the accused's name " +
          'was typed into the unit field by mistake. This is a shape check only. It does ' +
          'not, and cannot, confirm that item 17 names the correct company-sized unit up ' +
          'to the first GCMCA, only a human with the command relationship can do that. ' +
          'Verify item 17 by hand either way.',
      ),
    ];
  }
  return [];
}

// ---------------------------------------------------------------------------
// V-12: EDIPI is exactly 10 digits
// ---------------------------------------------------------------------------

const EDIPI_RE = /^\d{10}$/;

/**
 * V-12. accusedEdipi (item 20) and njpAuthorityEdipi (item 8B) must each be
 * exactly 10 digits when present.
 *
 * An empty accused EDIPI is V-10's problem, not this rule's, so it is
 * skipped here. An empty authority EDIPI is not an error at all, item 8B is
 * not one of the fields V-10 requires. Only a present but malformed value is
 * a V-12 error.
 */
export function checkEdipiFormat(formData: FormData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const candidates: Array<{ item: string; label: string; value: string }> = [
    { item: '20', label: 'accused EDIPI', value: str(formData, 'accusedEdipi') },
    { item: '8B', label: 'NJP authority EDIPI', value: str(formData, 'njpAuthorityEdipi') },
  ];
  for (const { item, label, value } of candidates) {
    const trimmed = value.trim();
    if (trimmed === '') continue;
    if (EDIPI_RE.test(trimmed)) continue;
    issues.push(
      issue(
        `navmc10132-v12-edipi-format-${item.toLowerCase()}`,
        'block',
        `Item ${item} (${label}) is not a 10-digit EDIPI.`,
        'DoD standard, EDIPI is a 10-digit identifier',
        `"${trimmed}" is not 10 digits. Re-enter item ${item} using the Marine's 10-digit ` +
          'EDIPI, digits only, no spaces or dashes.',
      ),
    );
  }
  return issues;
}

// ---------------------------------------------------------------------------
// W-04: item 21 appears to contain victim PII
// ---------------------------------------------------------------------------

/**
 * Deliberately narrow patterns. An SSN-shaped number is a strong signal on
 * its own. Everything else requires the word "victim" directly next to a
 * PII-type noun (SSN, date of birth, home address, phone number, full name),
 * which ordinary item 21 remarks (the ten prescribed formats, forwarding
 * notes, appeal notes) do not produce. Only cite item 21, the item 21
 * instruction is what carries this prohibition, the item 1 instruction does
 * not, only the printed item 1 heading does.
 */
const VICTIM_PII_PATTERNS: RegExp[] = [
  /\b\d{3}-\d{2}-\d{4}\b/, // SSN-shaped
  /\bvictim'?s?\s+(?:ssn|social security (?:number|no\.?)|dob|date of birth|home address|address is|phone number)\b/i,
  /\bvictim'?s?\s+full name\s+(?:is|was)\b/i,
];

/**
 * W-04. Item 21 (remarksComposed) appears to contain victim personally
 * identifying information.
 *
 * This is necessarily a heuristic, item 21 is free text. Kept conservative
 * on purpose, a noisy warning here is worse than none.
 */
export function checkVictimPii(formData: FormData): ValidationIssue[] {
  const remarks = str(formData, 'remarksComposed');
  if (remarks === '') return [];
  const hit = VICTIM_PII_PATTERNS.find((re) => re.test(remarks));
  if (!hit) return [];
  return [
    issue(
      'navmc10132-w04-victim-pii',
      'warn',
      'Item 21 appears to contain victim personally identifying information.',
      'Item 21 instruction, explicit prohibition against victim PII',
      'The item 21 instruction prohibits victim PII in remarks. This is a keyword and ' +
        'pattern heuristic over free text, not a certainty, review item 21 yourself and ' +
        'remove any victim PII it actually contains. Victim demographics belong in item 22 ' +
        'instead.',
    ),
  ];
}

// ---------------------------------------------------------------------------
// W-10: appealed punishment crosses a judge-advocate review threshold
// ---------------------------------------------------------------------------

/**
 * Punishment codes grouped by the MCO 011402 review categories they map to.
 * See navmc10132-punishments.ts for the full code table. The higher-tier
 * codes under 10 U.S.C. 815(b)(2)(H) (N04, N12, N13, N14, N15) exist
 * precisely because they need field-grade authority, and each corresponds to
 * one of these thresholds by construction:
 *   N03 arrest in quarters (threshold is over 7 days)
 *   N06/N12 correctional custody (N06 caps at 7, N12 goes to 30)
 *   N04 forfeiture of one-half of one month's pay per month for two months,
 *     which is structurally more than 7 days' pay, this code has no "days"
 *     parameter to compare against 7, so its presence alone crosses the
 *     threshold
 *   N08 reduction, the threshold keys on the accused's own pay grade, not
 *     on days
 *   N09/N13 extra duties (N09 caps at 14, N13 goes to 45)
 *   N01/N02/N05/N10/N11/N14/N15 restriction (the 14-and-under codes cap
 *     exactly at 14 and cannot cross the threshold, the 30 and 60 day codes
 *     can)
 */
const ARREST_IN_QUARTERS_CODES = new Set(['N03']);
const CORRECTIONAL_CUSTODY_CODES = new Set(['N06', 'N12']);
const FIELD_GRADE_FORFEITURE_CODES = new Set(['N04']);
const REDUCTION_CODES = new Set(['N08']);
const EXTRA_DUTY_CODES = new Set(['N09', 'N13']);
const RESTRICTION_CODES = new Set(['N01', 'N02', 'N05', 'N10', 'N11', 'N14', 'N15']);

function numeric(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Parses an accused pay grade like 'E5' or 'E-5' to its numeric grade. */
function enlistedGradeNumber(payGrade: string): number | null {
  const match = /^E-?(\d+)/i.exec(payGrade.trim());
  return match ? Number(match[1]) : null;
}

/**
 * W-10. An appealed punishment crosses one of the MCO 5800.16 Vol 14 para
 * 011402 mandatory judge-advocate review thresholds.
 *
 * Only fires when an appeal was actually made (item 13 carries a date, not
 * the Not Appealed checkbox). Deliberately does NOT implement the para
 * 011402.G threshold for detention of more than 14 days' pay. MCM Part V
 * para 5.b does not authorize detention as an NJP punishment at all, and no
 * MCTFS code exists for it (see navmc10132-punishments.ts header note 2), so
 * 011402.G describes a punishment no commander can actually impose. That
 * subparagraph is dead text, and implementing it would mean warning on a
 * value the app has no field to collect.
 */
export function checkAppealReviewThreshold(formData: FormData): ValidationIssue[] {
  const appealDate = str(formData, 'appealDate').trim();
  if (appealDate === '') return [];

  const punishments = arr<Navmc10132PunishmentEntry>(formData, 'punishments');
  const accusedPayGrade = str(formData, 'accusedPayGrade');
  const reasons: string[] = [];

  for (const p of punishments) {
    const days = numeric(p.days);
    if (ARREST_IN_QUARTERS_CODES.has(p.code) && days !== null && days > 7) {
      reasons.push('arrest in quarters imposed for more than 7 days');
    }
    if (CORRECTIONAL_CUSTODY_CODES.has(p.code) && days !== null && days > 7) {
      reasons.push('correctional custody imposed for more than 7 days');
    }
    if (FIELD_GRADE_FORFEITURE_CODES.has(p.code)) {
      reasons.push("forfeiture imposed under N04, structurally more than 7 days' pay");
    }
    if (REDUCTION_CODES.has(p.code)) {
      const grade = enlistedGradeNumber(accusedPayGrade);
      if (grade !== null && grade >= 4) {
        reasons.push('reduction imposed on a Marine in the fourth or higher enlisted pay grade');
      }
    }
    if (EXTRA_DUTY_CODES.has(p.code) && days !== null && days > 14) {
      reasons.push('extra duties imposed for more than 14 days');
    }
    if (RESTRICTION_CODES.has(p.code) && days !== null && days > 14) {
      reasons.push('restriction imposed for more than 14 days');
    }
  }

  if (reasons.length === 0) return [];
  return [
    issue(
      'navmc10132-w10-appeal-review-threshold',
      'warn',
      `This appealed punishment crosses a mandatory judge-advocate review threshold, ${reasons.join(', ')}.`,
      'MCO 5800.16 Vol 14 para 011402',
      'Route this appeal to a judge advocate for review before it is acted on. Note, para ' +
        "011402.G also lists detention of more than 14 days' pay as a review trigger, but " +
        'MCM Part V para 5.b does not authorize detention as an NJP punishment at all and no ' +
        'MCTFS code exists for it, so that subparagraph is not checked here, there is no ' +
        'punishment data it could ever match.',
    ),
  ];
}

// ---------------------------------------------------------------------------
// W-13: a remark line does not match a prescribed format
// ---------------------------------------------------------------------------

/**
 * The structured block of item 21 is whatever composeRemarks() produced from
 * the remarks array, remarksComposed then has remarksFreeText appended after
 * it. This module does not import composeRemarks (it only formats, it does
 * not need to), so the structured/free-text boundary is recovered by
 * stripping the free-text suffix back off remarksComposed. That only works
 * if composeRemarks appends free text as a literal suffix, which matches the
 * data model comment on remarksComposed (the structured entries are dated
 * and chronological, free text has no date and is not one of the ten
 * formats, so it can only go at the end).
 */
function structuredRemarksPortion(formData: FormData): string {
  const composed = str(formData, 'remarksComposed');
  const freeText = str(formData, 'remarksFreeText');
  if (freeText !== '' && composed.endsWith(freeText)) {
    return composed.slice(0, composed.length - freeText.length);
  }
  return composed;
}

const REMARK_ENTRY_START_RE = /^\d{4}-\d{2}-\d{2}\s+ITEM\s+\d+[A-Z]?:/;

/**
 * Splits the structured portion into remark entries rather than raw text
 * lines. An "Additional Offenses:" or "Additional Victims:" entry spans
 * several physical lines (the lettered sub-rows and the NOTE line), and the
 * two fixed ITEM 13 forms are each one line, so grouping by "a new entry
 * starts at a YYYY-MM-DD ITEM N: prefix" is what lets isPrescribedFormat see
 * a whole entry, including its continuation lines, rather than a fragment
 * that can never match on its own.
 */
function splitRemarkEntries(structured: string): string[] {
  const rawLines = structured.split('\n').map((l) => l.replace(/\r$/, ''));
  const entries: string[] = [];
  let current: string[] = [];
  for (const line of rawLines) {
    if (REMARK_ENTRY_START_RE.test(line.trim())) {
      if (current.length > 0) entries.push(current.join('\n').trim());
      current = [line];
    } else if (current.length > 0 && line.trim() !== '') {
      current.push(line);
    }
  }
  if (current.length > 0) entries.push(current.join('\n').trim());
  return entries.filter((e) => e !== '');
}

/**
 * W-13. Every entry in the structured portion of item 21 must match one of
 * the ten prescribed formats.
 *
 * Free text appended after the structured block is not checked, the item 21
 * instruction allows other remarks there as long as they are not victim PII
 * (W-04's job), it only prescribes format for the ten dated entry kinds.
 */
export function checkRemarkFormats(formData: FormData): ValidationIssue[] {
  const structured = structuredRemarksPortion(formData);
  if (structured.trim() === '') return [];
  const issues: ValidationIssue[] = [];
  const entries = splitRemarkEntries(structured);
  entries.forEach((entry, index) => {
    if (isPrescribedFormat(entry)) return;
    const preview = entry.length > 80 ? `${entry.slice(0, 80)}...` : entry;
    issues.push(
      issue(
        `navmc10132-w13-remark-format-${index}`,
        'warn',
        'A line in item 21 does not match one of the ten prescribed remark formats.',
        'Item 21 instruction',
        `The entry "${preview}" does not match a prescribed item 21 format. Check it ` +
          'against the ten formats on the item 21 instruction page, including the two fixed ' +
          'ITEM 13 stay-of-punishment forms, which are literal text, not a template.',
      ),
    );
  });
  return issues;
}

// ---------------------------------------------------------------------------
// W-14: an offense on this record also appears on another
// ---------------------------------------------------------------------------

/**
 * W-14. Flags an offense that appears more than once within THIS form.
 *
 * MCM Part V para 1.f.(1) prohibits double punishment for the same offense.
 * The app can only see one document at a time, it has no session library or
 * cross-document store to check here, so cross-document double punishment
 * is NOT checkable and is not attempted. Detecting the same article charged
 * twice on the same form, with the same summary, is checkable and is a real
 * mistake worth catching (a copy-pasted row, most likely), so that is what
 * this implements.
 */
export function checkDuplicateOffenses(formData: FormData): ValidationIssue[] {
  const offenses = arr<Navmc10132Offense>(formData, 'offenses');
  const letters = ['1A', '1B', '1C', '1D', '1E'];
  const seen = new Map<string, number>(); // key -> first index seen
  const issues: ValidationIssue[] = [];
  offenses.forEach((offense, index) => {
    const article = (offense?.articleLabel ?? '').trim();
    const summary = (offense?.summary ?? '').trim().toLowerCase();
    if (article === '' || summary === '') return;
    const key = `${article} ${summary}`;
    const firstIndex = seen.get(key);
    if (firstIndex === undefined) {
      seen.set(key, index);
      return;
    }
    issues.push(
      issue(
        `navmc10132-w14-duplicate-offense-${index}`,
        'warn',
        `Item ${letters[firstIndex]} and item ${letters[index]} charge the same offense with an identical summary.`,
        'MCM Part V para 1.f.(1), double punishment prohibited (paraphrased)',
        'Confirm this was not a copy-pasted row. If both rows really describe the same ' +
          'conduct, punishing it twice on one UPB is what MCM Part V para 1.f.(1) forbids, ' +
          'remove one of them. This check only sees offenses on this one form, it cannot ' +
          'detect the same offense already punished on a different UPB, that would need a ' +
          'cross-document library search the app does not have.',
      ),
    );
  });
  return issues;
}

// ---------------------------------------------------------------------------
// W-15: multiple offenses share a date and place
// ---------------------------------------------------------------------------

const DATE_TOKEN_RE =
  /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{2,4}\b/i;
const PLACE_TOKEN_RE = /\b(?:at|in)\s+([A-Z][\w.'-]*(?:\s+[A-Z][\w.'-]*){0,4})/;

function extractDate(summary: string): string | null {
  const match = DATE_TOKEN_RE.exec(summary);
  return match ? match[0].toLowerCase() : null;
}

function extractPlace(summary: string): string | null {
  const match = PLACE_TOKEN_RE.exec(summary);
  if (!match) return null;
  // Strip trailing sentence punctuation the character class can pick up
  // (e.g. a period ending the summary) so two summaries naming the same
  // place do not fail to match on punctuation alone.
  return match[1].trim().replace(/[.,;:]+$/, '').toLowerCase();
}

/**
 * W-15. Advisory only. Flags offenses whose free-text summaries appear to
 * share both a date and a place, suggesting a single incident that MCM Part
 * V para 1.f.(3) says should ordinarily be considered together rather than
 * punished separately.
 *
 * Date and place live inside item 1 free text, there is no structured field
 * for either, so detection is a conservative two-part heuristic, a matching
 * date token AND a matching "at/in <Place>" token, deliberately requiring
 * both so an unrelated pair of offenses that merely happened on the same day
 * does not trigger this on date alone.
 */
export function checkIncidentGrouping(formData: FormData): ValidationIssue[] {
  const offenses = arr<Navmc10132Offense>(formData, 'offenses');
  const letters = ['1A', '1B', '1C', '1D', '1E'];
  const parsed = offenses.map((o) => {
    const summary = o?.summary ?? '';
    return { date: extractDate(summary), place: extractPlace(summary) };
  });
  const issues: ValidationIssue[] = [];
  const flaggedPairs = new Set<string>();
  for (let i = 0; i < parsed.length; i += 1) {
    if (!parsed[i].date || !parsed[i].place) continue;
    for (let j = i + 1; j < parsed.length; j += 1) {
      if (!parsed[j].date || !parsed[j].place) continue;
      if (parsed[i].date !== parsed[j].date) continue;
      if (parsed[i].place !== parsed[j].place) continue;
      const pairKey = `${i}-${j}`;
      if (flaggedPairs.has(pairKey)) continue;
      flaggedPairs.add(pairKey);
      issues.push(
        issue(
          `navmc10132-w15-shared-incident-${pairKey}`,
          'warn',
          `Item ${letters[i]} and item ${letters[j]} appear to share the same date and place.`,
          'MCM Part V para 1.f.(3), paraphrased',
          'This looks like it could be one incident charged as two separate offenses. MCM ' +
            'Part V para 1.f.(3) says offenses from a single incident are ordinarily ' +
            'considered together, not made the basis for separate punishments. This is ' +
            'advisory only, the date and place are pulled from free text with a simple ' +
            'heuristic, read both summaries yourself before deciding whether to combine them.',
        ),
      );
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// W-16: offense tried in a court deriving its authority from the United States
// ---------------------------------------------------------------------------

/**
 * Requires an adjudication word (convicted, tried, sentenced, found guilty)
 * within a short window of a US-derived court reference (court-martial,
 * federal or district court, a US magistrate). A bare recommendation to
 * pursue court-martial ("Fwd to Bn/Sqn CO recom court-martial", one of the
 * ten prescribed item 21 formats) does not contain an adjudication word, so
 * it will not trigger this, only a claim that the offense was ALREADY
 * adjudicated does.
 */
const US_COURT_ADJUDICATION_RE =
  /\b(?:convicted|sentenced|found guilty|tried)\b(?:[^.]{0,40})\b(?:court[- ]martial|district court|federal court|u\.?s\.? magistrate|magistrate court)\b|\b(?:court[- ]martial|district court|federal court|u\.?s\.? magistrate|magistrate court)\b(?:[^.]{0,40})\b(?:convicted|sentenced|found guilty|tried)\b/i;

/**
 * W-16. Keyword heuristic over the offense summaries and item 21 remarks,
 * warns when the record indicates the offense was tried in a court deriving
 * its authority from the United States. MCM Part V para 1.f.(5) says NJP may
 * not be imposed for such an offense. Warn only, this is text matching, not
 * a determination.
 */
export function checkUsDerivedCourt(formData: FormData): ValidationIssue[] {
  const offenses = arr<Navmc10132Offense>(formData, 'offenses');
  const texts = [
    ...offenses.map((o) => o?.summary ?? ''),
    str(formData, 'remarksComposed'),
  ];
  const hitText = texts.find((t) => t !== '' && US_COURT_ADJUDICATION_RE.test(t));
  if (!hitText) return [];
  return [
    issue(
      'navmc10132-w16-us-derived-court',
      'warn',
      'This record suggests the offense was already tried in a court deriving its authority from the United States.',
      'MCM Part V para 1.f.(5), paraphrased',
      'MCM Part V para 1.f.(5) says NJP may not be imposed for an offense tried by a court ' +
        'deriving its authority from the United States, for example a court-martial or a ' +
        'federal district court. This is a keyword heuristic over free text, not a ' +
        'determination, confirm by hand whether NJP is actually barred here before relying ' +
        'on it.',
    ),
  ];
}

// ---------------------------------------------------------------------------
// Aggregate
// ---------------------------------------------------------------------------

/**
 * Runs every identity-group rule (V-09 through V-12, W-04, W-10, W-13
 * through W-16) and returns their combined issues. Each group function
 * returns an empty array when its rule does not apply, so the aggregate is a
 * plain concatenation.
 */
export function identityIssues(formData: FormData): ValidationIssue[] {
  return [
    ...checkFieldCapacities(formData),
    ...checkAccusedIdentity(formData),
    ...checkUnitEchelon(formData),
    ...checkEdipiFormat(formData),
    ...checkVictimPii(formData),
    ...checkAppealReviewThreshold(formData),
    ...checkRemarkFormats(formData),
    ...checkDuplicateOffenses(formData),
    ...checkIncidentGrouping(formData),
    ...checkUsDerivedCourt(formData),
  ];
}
