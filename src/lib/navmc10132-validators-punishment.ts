/**
 * NAVMC 10132 item 6/7/14 punishment validators.
 *
 * Covers the punishment-side blockers and warnings from docs/NAVMC_10132_SPEC.md
 * section 6: V-04, V-05, V-14, V-15, V-16, W-05, W-06, W-07, W-08. All other
 * rules in that section (offense/finding rules, date ordering, capacity rules
 * outside item 6, accused identity, unit, EDIPI) live in sibling modules.
 *
 * Two rules here are deliberately weaker than their table description because
 * the underlying data cannot support the stronger claim. See the JSDoc on
 * `suspensionTermsIssues` (V-05) and `appealDecisionIncreaseIssues` (V-16) for
 * the reasoning. Both choices are documented at the call site rather than left
 * implicit, per the standing rule that every issue must carry a citation the
 * app can actually stand behind.
 */

import { FormData } from '@/types';
// TYPE-ONLY. letter-validators imports this module at runtime, so a value
// import here would create a module cycle.
import type { ValidationIssue } from '@/lib/letter-validators';
import type { Navmc10132PunishmentEntry } from '@/types/navmc';
import {
  fitsInField,
  overflowBy,
  renderPunishment,
  Navmc10132PunishmentRenderError,
  resolvePunishment,
  authoritySatisfies,
} from '@/lib/navmc10132-utils';

const ITEM_6_FIELD = '6 PUNISHMENT IMPOSED';

/** Builds one ValidationIssue. Mirrors the 10922 validator contract exactly. */
function issue(
  id: string,
  severity: ValidationIssue['severity'],
  rule: string,
  citation: string,
  detail: string,
): ValidationIssue {
  return { id, severity, rule, citation, detail };
}

/** Reads the punishment entries array, tolerating an unset or non-array field. */
function punishmentEntries(formData: FormData): Navmc10132PunishmentEntry[] {
  return Array.isArray(formData.punishments)
    ? (formData.punishments as Navmc10132PunishmentEntry[])
    : [];
}

/**
 * Parses a numeric form field that is stored as a string. Returns null for
 * empty, missing, or non-numeric input rather than 0, so callers can tell
 * "not entered" apart from "entered as zero" and skip the comparison.
 */
function parseNumericField(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parses a bare enlisted pay grade such as 'E5' or 'E-6'. Returns null for a
 * missing, officer, or unparseable grade so W-08 can no-op rather than guess.
 */
function parseEnlistedGrade(payGrade: unknown): number | null {
  if (typeof payGrade !== 'string') return null;
  const match = /^E-?(\d{1,2})$/i.exec(payGrade.trim());
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

/**
 * V-04 (blocker). Item 6 punishment is non-empty.
 *
 * Checked against the structured `punishments` array rather than the derived
 * `punishmentImposed` string, for the same reason V-13 recomputes from
 * structure: the derived field can be stale and the app must not trust it as
 * the source of truth. An accused with no punishment entries means item 6
 * would render empty.
 *
 * Cites MCO 5800.16 Vol 14 para 011110.C, not the deleted para 011105.F.
 * MARADMIN 427/23 deleted 011105.A through .R, so 011105.F is dead and must
 * never be cited here even though it is the paragraph that historically held
 * the item 6 worked examples.
 */
export function punishmentPresenceIssues(formData: FormData): ValidationIssue[] {
  const entries = punishmentEntries(formData);
  if (entries.length > 0) return [];
  return [
    issue(
      'navmc10132-v04-punishment-empty',
      'block',
      'Item 6 punishment imposed is empty. No punishment means no NJP has occurred.',
      'MCO 5800.16 Vol 14 para 011110.C',
      'Select at least one punishment code, or if no punishment is being imposed, ' +
        'this UPB has not memorialized an NJP and per para 011110.C is not maintained ' +
        'in the UPB binder. The form item 6 instruction is to destroy the form in that case.',
    ),
  ];
}

/**
 * V-05 (blocker for the empty case, advisory for the short case).
 *
 * Item 7 must be either the literal word NONE, or a specific suspension that
 * per the item 7 instruction states the punishment suspended, the length of
 * the suspension, and the terms for automatic remission. An empty item 7 is
 * unambiguous and is refused outright.
 *
 * DECISION on shortness: a short non-NONE entry does not, by itself, prove
 * the three required elements are missing. "Susp 30d" is short and probably
 * incomplete, but the app has no structured suspension model to compare
 * against, only free text, so a length check cannot tell "terse but complete"
 * from "incomplete." A false block on a legitimate short-but-complete entry
 * would stop export of a valid form, which is worse than a missed catch here.
 * Shortness therefore WARNS rather than blocks. The threshold, 20 characters,
 * is picked to fire on entries that plainly cannot contain a punishment
 * clause, a duration, and a remission clause (three components meaningfully
 * expressed run well past 20 characters in every MCO worked example), while
 * staying quiet on anything with enough room to plausibly hold all three.
 */
export function suspensionTermsIssues(formData: FormData): ValidationIssue[] {
  const raw = typeof formData.suspension === 'string' ? formData.suspension : '';
  const trimmed = raw.trim();
  const SHORT_SUSPENSION_THRESHOLD = 20;

  if (trimmed === '') {
    return [
      issue(
        'navmc10132-v05-suspension-empty',
        'block',
        'Item 7 suspension is empty. It must be NONE or a specific suspension with terms.',
        'Item 7 instruction',
        'Enter the literal word NONE if no punishment is suspended, or state the ' +
          'punishment suspended, its length, and the terms for automatic remission.',
      ),
    ];
  }

  if (/^none$/i.test(trimmed)) return [];

  if (trimmed.length < SHORT_SUSPENSION_THRESHOLD) {
    return [
      issue(
        'navmc10132-v05-suspension-short',
        'warn',
        'Item 7 suspension entry looks too short to state a punishment, a length, ' +
          'and remission terms.',
        'Item 7 instruction',
        `Item 7 reads "${trimmed}" (${trimmed.length} characters). Confirm it states ` +
          'which punishment is suspended, for how long, and the terms under which it ' +
          'is automatically remitted if not sooner vacated. This is advisory, not a ' +
          'block, because the app cannot parse free text well enough to prove the ' +
          'entry is incomplete rather than merely terse.',
      ),
    ];
  }

  return [];
}

/**
 * V-14 (blocker). Every selected punishment code must be authorized for
 * release one, which is enlisted only. N01 to N03 are officer punishments
 * under 10 U.S.C. 815(b)(1) and N05 is withheld pending spec decision D-10.
 * Both classes carry `releaseOneAvailable: false` and a human-readable
 * `unavailableReason` on the table entry, which this rule surfaces verbatim.
 */
export function punishmentAuthorizationIssues(formData: FormData): ValidationIssue[] {
  const entries = punishmentEntries(formData);
  const issues: ValidationIssue[] = [];

  entries.forEach((entry, index) => {
    const code = resolvePunishment(entry.code);
    if (!code) return; // unresolvable code is not this rule's concern
    if (code.releaseOneAvailable) return;

    issues.push(
      issue(
        `navmc10132-v14-unauthorized-${entry.code}-${index}`,
        'block',
        `Punishment code ${entry.code} (${code.description}) is not authorized in release one.`,
        '10 U.S.C. 815(b)(1)',
        code.unavailableReason ?? `${entry.code} is not available for this accused's status.`,
      ),
    );
  });

  return issues;
}

/**
 * V-15 (blocker unless the user routed the overflow to item 21).
 *
 * Renders the full item 6 string from the structured punishment entries and
 * checks it against the measured capacity of the "6 PUNISHMENT IMPOSED"
 * field. When `punishmentOverflowToItem21` is true the user has affirmatively
 * chosen the See Supplemental Page route, so an overflow is expected and not
 * an error, it only needs item 21 to actually carry the full text (a
 * different rule's job, not this one).
 *
 * A render failure (Navmc10132PunishmentRenderError, e.g. an unresolvable
 * code) is not this rule's concern either, V-14 and upstream code selection
 * own that, so it is left to propagate rather than silently swallowed as a
 * passing capacity check.
 */
export function punishmentFieldCapacityIssues(formData: FormData): ValidationIssue[] {
  const entries = punishmentEntries(formData);
  if (entries.length === 0) return [];

  let rendered: string;
  try {
    // renderPunishment returns { text, length }. Only the text is compared
    // against the field width here.
    rendered = renderPunishment(entries).text;
  } catch (err) {
    if (err instanceof Navmc10132PunishmentRenderError) return [];
    throw err;
  }

  if (fitsInField(ITEM_6_FIELD, rendered)) return [];
  if (formData.punishmentOverflowToItem21) return [];

  const over = overflowBy(ITEM_6_FIELD, rendered);
  return [
    issue(
      'navmc10132-v15-item6-overflow',
      'block',
      'Rendered item 6 punishment text does not fit the "6 PUNISHMENT IMPOSED" field.',
      'Section 2.2 (field capacity)',
      `Rendered text is ${rendered.length} characters against a 123-character field ` +
        `(over by ${over}). The MCO's own combination example, restriction plus extra ` +
        'duty running concurrently, renders to 160 characters and does not fit either. ' +
        'Either shorten the combination or check "See Supplemental Page" and carry the ' +
        'full text in item 21.',
    ),
  ];
}

/** Keywords suggestive of an increase in the appeal decision free text. */
const APPEAL_INCREASE_KEYWORDS = [
  'increase',
  'increased',
  'increasing',
  'more severe',
  'greater punishment',
  'additional punishment',
  'enhanced',
  'aggravate',
];

/**
 * V-16, downgraded from blocker to advisory. Once NJP is imposed it may not
 * be increased on appeal (MCM Part V para 1.f.(2), paraphrased, not quoted,
 * per the standing rule against quoting the 2019 MCM verbatim until the 2024
 * edition is checked).
 *
 * DECISION: `appealDecision` is free text (item 14 has no structured model of
 * what the reviewing authority did to the punishment), so there is no
 * structured comparison this function can run against the item 6 punishment
 * set. The task's own framing is that a fabricated comparison is worse than
 * no comparison. What is implemented is a keyword heuristic: if the free text
 * contains language that plainly suggests an increase, warn and ask a human
 * to confirm. Silence is otherwise correct, most appeal decisions (affirmed,
 * disapproved, mitigated, remitted, suspended) do not increase anything and
 * this function says nothing about them.
 *
 * SEVERITY: 'warn', not 'block'. A keyword match proves nothing on its own,
 * "punishment was not increased" contains the word "increased" and would
 * false-positive, so this cannot gate export. Because the underlying claim
 * is unprovable from the data available, this is the one rule in this module
 * where the severity in the table (block) is deliberately not honored: the
 * task instruction to set severity to match what can actually be proven
 * overrides the table for V-16 specifically.
 */
export function appealDecisionIncreaseIssues(formData: FormData): ValidationIssue[] {
  const text = typeof formData.appealDecision === 'string' ? formData.appealDecision : '';
  if (text.trim() === '') return [];

  const lower = text.toLowerCase();
  const hit = APPEAL_INCREASE_KEYWORDS.find((kw) => lower.includes(kw));
  if (!hit) return [];

  return [
    issue(
      'navmc10132-v16-appeal-possible-increase',
      'warn',
      'Item 14 appeal decision text contains language suggestive of an increased punishment.',
      'MCM Part V para 1.f.(2) (paraphrase)',
      `Item 14 contains "${hit}." Once nonjudicial punishment is imposed it may not be ` +
        'increased, on appeal or otherwise. Item 14 is free text and the app cannot ' +
        'structurally compare it against the item 6 punishment set, so confirm by hand ' +
        'that no punishment recorded in item 6 was increased on appeal.',
    ),
  ];
}

/**
 * W-05 (advisory). A selected code requires field-grade (or higher) authority
 * and item 8A's pay grade does not establish that.
 *
 * `authoritySatisfies` returns three distinct outcomes and all three are
 * handled distinctly:
 *  - true: authority is satisfied, no issue.
 *  - false: item 8A is below the code's required grade, warn.
 *  - 'unknown': item 8A is unset, unparseable, or the code requires GCMCA
 *    authority, which is a billet, not a grade, and cannot be read off 8A.
 *    This is neither a pass nor a fail, it gets its own advisory message
 *    saying the app cannot answer the question, distinct from the other two.
 */
export function punishmentAuthorityGradeIssues(formData: FormData): ValidationIssue[] {
  const entries = punishmentEntries(formData);
  const authorityGrade =
    typeof formData.njpAuthorityPayGrade === 'string' ? formData.njpAuthorityPayGrade : '';
  const issues: ValidationIssue[] = [];

  entries.forEach((entry, index) => {
    const code = resolvePunishment(entry.code);
    if (!code) return;
    if (code.requiredAuthority === 'any') return;

    const result = authoritySatisfies(code.requiredAuthority, authorityGrade);

    if (result === true) return;

    if (result === 'unknown') {
      issues.push(
        issue(
          `navmc10132-w05-authority-unknown-${entry.code}-${index}`,
          'warn',
          `Cannot determine whether item 8A authorizes punishment code ${entry.code}.`,
          '10 U.S.C. 815(b)(2)(H), MCO 5800.16 Vol 14 para 010303',
          `Item 8A pay grade is "${authorityGrade || '(unset)'}." Either the grade is ` +
            `not entered, or ${entry.code} requires GCMCA authority, which is a billet ` +
            'question the app cannot answer from a pay grade alone. Confirm by hand ' +
            'that the NJP authority actually holds the required authority.',
        ),
      );
      return;
    }

    // result === false
    issues.push(
      issue(
        `navmc10132-w05-authority-insufficient-${entry.code}-${index}`,
        'warn',
        `Punishment code ${entry.code} requires field-grade authority and item 8A does not satisfy it.`,
        '10 U.S.C. 815(b)(2)(H), MCO 5800.16 Vol 14 para 010303',
        `Item 8A pay grade is "${authorityGrade}," below the grade required for ` +
          `${entry.code} (${code.description}). Confirm the NJP authority or drop the code.`,
      ),
    );
  });

  return issues;
}

/**
 * W-06 (advisory). An entered days or months parameter exceeds the selected
 * code's own ceiling. Cites the code's own `statute` field, since the ceiling
 * is printed in the code description itself and the statute subsection is the
 * source for that number, not a separately maintained constant.
 *
 * Scope is deliberately limited to `days` against `maxDays` and `months`
 * against `maxMonths`, matching the task's stated scope. `dollars` against
 * `maxDaysPay` is not a comparable pair, one is a dollar amount and the other
 * a day count, so it is intentionally not checked here.
 */
export function punishmentParameterCeilingIssues(formData: FormData): ValidationIssue[] {
  const entries = punishmentEntries(formData);
  const issues: ValidationIssue[] = [];

  entries.forEach((entry, index) => {
    const code = resolvePunishment(entry.code);
    if (!code) return;

    const days = parseNumericField(entry.days);
    if (code.maxDays !== undefined && days !== null && days > code.maxDays) {
      issues.push(
        issue(
          `navmc10132-w06-days-${entry.code}-${index}`,
          'warn',
          `Punishment code ${entry.code} entered days (${days}) exceeds its own ceiling of ${code.maxDays}.`,
          code.statute,
          `${code.description}. Reduce the days entered for ${entry.code} to ${code.maxDays} or fewer.`,
        ),
      );
    }

    const months = parseNumericField(entry.months);
    if (code.maxMonths !== undefined && months !== null && months > code.maxMonths) {
      issues.push(
        issue(
          `navmc10132-w06-months-${entry.code}-${index}`,
          'warn',
          `Punishment code ${entry.code} entered months (${months}) exceeds its own ceiling of ${code.maxMonths}.`,
          code.statute,
          `${code.description}. Reduce the months entered for ${entry.code} to ${code.maxMonths} or fewer.`,
        ),
      );
    }
  });

  return issues;
}

/**
 * Returns true when a dollar-amount string is not a whole dollar figure,
 * i.e. it parses but carries a nonzero fractional part.
 */
function hasFractionalDollars(value: unknown): boolean {
  const n = parseNumericField(value);
  if (n === null) return false;
  return !Number.isInteger(n);
}

/**
 * W-07 (advisory). A forfeiture amount is not expressed in whole dollars.
 * Applies to both `dollars` and `dollarsPerMonth`, the two forfeiture
 * parameters the punishment table defines.
 */
export function forfeitureWholeDollarIssues(formData: FormData): ValidationIssue[] {
  const entries = punishmentEntries(formData);
  const issues: ValidationIssue[] = [];

  entries.forEach((entry, index) => {
    if (hasFractionalDollars(entry.dollars)) {
      issues.push(
        issue(
          `navmc10132-w07-dollars-${entry.code}-${index}`,
          'warn',
          `Punishment code ${entry.code} forfeiture is not a whole dollar amount.`,
          'MCO 5800.16 Vol 14 para 010901',
          `Item 6 forfeitures under ${entry.code} must be expressed in whole dollars. ` +
            `Entered value: ${entry.dollars}.`,
        ),
      );
    }
    if (hasFractionalDollars(entry.dollarsPerMonth)) {
      issues.push(
        issue(
          `navmc10132-w07-dollarsPerMonth-${entry.code}-${index}`,
          'warn',
          `Punishment code ${entry.code} monthly forfeiture is not a whole dollar amount.`,
          'MCO 5800.16 Vol 14 para 010901',
          `Item 6 forfeitures under ${entry.code} must be expressed in whole dollars. ` +
            `Entered value: ${entry.dollarsPerMonth}.`,
        ),
      );
    }
  });

  return issues;
}

/**
 * W-08 (advisory). A reduction is imposed and the accused is E-6 or above.
 * Marines in the grade of E-6 or above may not be reduced in paygrade.
 *
 * A punishment entry counts as "a reduction" when its resolved code has
 * `gradeReducedTo` among its parameters, N08 in the current table, rather
 * than hardcoding the code string, so a future reduction-shaped code is
 * covered automatically.
 *
 * `accusedPayGrade` is read as a bare grade such as 'E5'. A missing or
 * unparseable grade means this rule does not apply, it does not warn on a
 * grade the app cannot read, since that would be a claim it cannot support.
 */
export function reductionPayGradeIssues(formData: FormData): ValidationIssue[] {
  const entries = punishmentEntries(formData);
  const grade = parseEnlistedGrade(formData.accusedPayGrade);
  if (grade === null) return [];
  if (grade < 6) return [];

  const reductionEntries = entries.filter((entry) => {
    const code = resolvePunishment(entry.code);
    return !!code && code.parameters.includes('gradeReducedTo');
  });
  if (reductionEntries.length === 0) return [];

  return [
    issue(
      'navmc10132-w08-reduction-e6-plus',
      'warn',
      'A reduction is imposed and the accused is E-6 or above.',
      'MCO 5800.16 Vol 14 para 010302.C',
      `Accused pay grade is "${formData.accusedPayGrade}." Marines in the grade of E-6 ` +
        'or above may not be reduced in paygrade. Remove the reduction or confirm the ' +
        'accused pay grade is entered correctly.',
    ),
  ];
}

/**
 * Aggregate export. Runs every punishment-side rule in table order, blockers
 * first (V-04, V-05, V-14, V-15, V-16), then warnings (W-05 through W-08).
 */
export function punishmentIssues(formData: FormData): ValidationIssue[] {
  return [
    ...punishmentPresenceIssues(formData),
    ...suspensionTermsIssues(formData),
    ...punishmentAuthorizationIssues(formData),
    ...punishmentFieldCapacityIssues(formData),
    ...appealDecisionIncreaseIssues(formData),
    ...punishmentAuthorityGradeIssues(formData),
    ...punishmentParameterCeilingIssues(formData),
    ...forfeitureWholeDollarIssues(formData),
    ...reductionPayGradeIssues(formData),
  ];
}
