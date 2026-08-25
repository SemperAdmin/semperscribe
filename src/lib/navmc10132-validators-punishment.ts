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
 *
 * `suspensionIndexBoundsIssues`, a V-05 addendum, is not weakened. It checks
 * the structured `suspensions` array's punishmentIndex against `punishments`
 * and blocks outright, the 1:1 guarantee renderSuspension itself enforces by
 * throwing (navmc10132-suspension-render.ts).
 */

import { FormData } from '@/types';
// TYPE-ONLY. letter-validators imports this module at runtime, so a value
// import here would create a module cycle.
import type { ValidationIssue } from '@/lib/letter-validators';
import type { Navmc10132PunishmentEntry, Navmc10132Suspension } from '@/types/navmc';
import {
  fitsInField,
  overflowBy,
  renderPunishment,
  Navmc10132PunishmentRenderError,
  resolvePunishment,
  authoritySatisfies,
  renderSuspension,
  Navmc10132SuspensionRenderError,
} from '@/lib/navmc10132-utils';
import {
  NAVMC_10132_REDUCTION_BAR_FLOOR,
  reducedPayGrade,
  reductionBarred,
  type Navmc10132Service,
} from '@/lib/navmc10132-ranks';
import {
  BASIC_PAY_SOURCE_URL,
  CEILING_REASONS_WORTH_SURFACING,
  forfeitureCeiling,
  payTableStatus,
} from '@/lib/navmc10132-basic-pay';
import { combinationFindings } from '@/lib/navmc10132-combination-limits';
import { suspensionPeriodFindings } from '@/lib/njp-suspension-period';

const ITEM_6_FIELD = '6 PUNISHMENT IMPOSED';

/** Builds one ValidationIssue. Mirrors the 10922 validator contract exactly. */
/**
 * SEVERITY IS 'block', NOT 'fail', FOR ANYTHING THAT MUST STOP AN EXPORT.
 *
 * There are three levels and only one of them gates: getExportBlockers in
 * letter-validators.ts filters on `severity === 'block'`. 'fail' renders as
 * "Non-compliant" in the compliance dialog and lets the export through;
 * 'warn' renders as "Advisory".
 *
 * V-18 through V-22 were written with 'fail' and described as BLOCKING in
 * their own docstrings, in the spec decision table, and in every report.
 * They blocked nothing. Caught 2026-08-25 by looking at the badge in the
 * compliance dialog, which read "Non-compliant" beside issues badged "Blocks
 * export". Their tests passed throughout, because the tests asserted the
 * severity the code emitted rather than the behaviour the rule needed.
 *
 * If you add a rule here that names an unlawful punishment, use 'block' and
 * assert the EXPORT is stopped, not merely that an issue was produced.
 */
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

/** Reads the item 7 suspension entries array, tolerating an unset or non-array field. */
function suspensionEntries(formData: FormData): Navmc10132Suspension[] {
  return Array.isArray(formData.suspensions)
    ? (formData.suspensions as Navmc10132Suspension[])
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
 * V-05 addendum (blocker). A structured item 7 suspension names a
 * punishmentIndex outside the bounds of the punishments array, i.e. it
 * points at a punishment never imposed, or a punishment imposed and later
 * removed after being suspended. This is the exact defect free-text item 7
 * let through, "cant suspend somthing that is not imposed" in the reporting
 * user's own words, so it is checked here as its own rule rather than
 * folded into the free-text `suspensionTermsIssues` above.
 *
 * Runs against the structured `suspensions` array, not the derived
 * `suspension` string, for the same reason `punishmentPresenceIssues` (V-04)
 * reads structure instead of its own derived field. The derived string is
 * prone to staleness, and the app must not trust it as the source of truth.
 */
export function suspensionIndexBoundsIssues(formData: FormData): ValidationIssue[] {
  const punishments = punishmentEntries(formData);
  const suspensions = suspensionEntries(formData);
  const issues: ValidationIssue[] = [];

  suspensions.forEach((suspension, index) => {
    const { punishmentIndex } = suspension;
    const inBounds =
      Number.isInteger(punishmentIndex) &&
      punishmentIndex >= 0 &&
      punishmentIndex < punishments.length;
    if (inBounds) return;

    issues.push(
      issue(
        `navmc10132-v05-suspension-index-${index}`,
        'block',
        `Item 7 suspension entry ${index} names punishmentIndex ${punishmentIndex}, which is ` +
          'not a punishment item 6 carries.',
        'Item 7 instruction',
        'A suspension must name a punishment actually imposed in item 6. Remove this ' +
          'suspension, or point it at a valid index' +
          (punishments.length > 0 ? `, 0 through ${punishments.length - 1}.` : '; item 6 carries no punishments to suspend.'),
      ),
    );
  });

  return issues;
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

/** Item 7's own field, measured in Phase 0. Single line, not multiline. */
const ITEM_7_FIELD = '7 SUSPENSION IF ANY';

/**
 * V-17, blocker. The rendered item 7 suspension text does not fit the
 * "7 SUSPENSION IF ANY" field.
 *
 * Item 7 is a SINGLE LINE field, 538.2pt wide, not multiline. It clips
 * rather than wrapping, so an over-long entry loses text with no visible
 * error. Two suspended punishments already overflow: a reduction and an
 * extra duty each carrying the full automatic-remission clause render to
 * 247 characters against a 534.2pt usable width, over by 320pt.
 *
 * Mirrors V-15 for item 6, including its escape hatch. The form's page 3
 * ITEM 21 instruction prescribes carrying overflow into item 21 with a
 * dated entry, and the same route serves item 7.
 *
 * A render error is NOT this rule's business. renderSuspension throws on a
 * dangling index or a missing period, and the bounds rule reports that. A
 * throw here returns no issue so one defect does not surface twice.
 */
export function suspensionOverflowIssues(formData: FormData): ValidationIssue[] {
  const suspensions = suspensionEntries(formData);
  if (suspensions.length === 0) return [];

  let rendered: string;
  try {
    rendered = renderSuspension(suspensions, punishmentEntries(formData), {
      impositionDate: typeof formData.punishmentDate === 'string' ? formData.punishmentDate : undefined,
    }).text;
  } catch (err) {
    if (err instanceof Navmc10132SuspensionRenderError) return [];
    throw err;
  }

  if (fitsInField(ITEM_7_FIELD, rendered)) return [];
  if (formData.suspensionOverflowToItem21) return [];

  const over = overflowBy(ITEM_7_FIELD, rendered);
  return [
    issue(
      'navmc10132-v17-item7-overflow',
      'block',
      'Rendered item 7 suspension text does not fit the "7 SUSPENSION IF ANY" field.',
      'NAVMC 10132 (REV. 08-2023) instructions, page 3, ITEM 7 and ITEM 21',
      `Rendered text is ${rendered.length} characters, over by ${over}. Item 7 is a ` +
        'single-line field and clips rather than wrapping, so the tail would be lost ' +
        'silently. Two suspended punishments overflow it on their own. Either reduce ' +
        'what is suspended or carry the full text into item 21 using the dated entry ' +
        'format the page 3 instruction prescribes.',
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
 * W-06 (blocker). An entered days or months parameter exceeds the selected
 * code's own ceiling. Cites the code's own `statute` field, since the ceiling
 * is printed in the code description itself and the statute subsection is the
 * source for that number, not a separately maintained constant.
 *
 * Promoted from advisory to blocker. The ceiling is the MCM Part V 5.b limit
 * on the punishment the code names, not a style preference, so exceeding it
 * is unlawful and export must refuse rather than merely note it. The rule ID
 * prefix stays w06 even though the severity is now block, so an existing
 * reference to navmc10132-w06-days or navmc10132-w06-months still resolves.
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
          'block',
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
          'block',
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
  const payGrade = typeof formData.accusedPayGrade === 'string' ? formData.accusedPayGrade : '';
  const service = accusedService(formData);
  // Service-aware since 2026-08-24. This rule tested a single E-6 floor for
  // both services, which refused a lawful reduction of a Navy E-6 and let an
  // unlawful reduction of a Navy E-7 through unwarned. The order names two
  // floors; reductionBarred reads the right one.
  if (!reductionBarred(payGrade, service)) return [];

  const reductionEntries = entries.filter((entry) => {
    const code = resolvePunishment(entry.code);
    return !!code && code.parameters.includes('gradeReducedTo');
  });
  if (reductionEntries.length === 0) return [];

  const floor = NAVMC_10132_REDUCTION_BAR_FLOOR[service];
  const who = service === 'USN' ? 'Sailors' : 'Marines';

  return [
    issue(
      'navmc10132-w08-reduction-e6-plus',
      'warn',
      `A reduction is imposed and the accused is E-${floor} or above.`,
      'MCO 5800.16 Vol 14 para 010302.C',
      `Accused pay grade is "${payGrade}." ${who} in the grade of E-${floor} ` +
        'or above may not be reduced in paygrade. Remove the reduction or confirm the ' +
        'accused pay grade is entered correctly.',
    ),
  ];
}

/** Item 19's service, defaulting to USMC on a NAVMC form. */
function accusedService(formData: FormData): Navmc10132Service {
  return formData.accusedService === 'USN' ? 'USN' : 'USMC';
}

/** Bare enlisted grade number, or null when unreadable. */
function enlistedGradeNumber(payGrade: unknown): number | null {
  if (typeof payGrade !== 'string') return null;
  const match = /^E-?(\d)$/i.exec(payGrade.trim());
  return match ? Number(match[1]) : null;
}

/**
 * V-19 (BLOCKING). Correctional custody imposed on a Marine in pay grade E-4
 * or above without an unsuspended reduction below E-4.
 *
 * JAGMAN 0111.b, verbatim: "Correctional custody. This punishment will not be
 * imposed on persons in paygrade E-4 and above unless an unsuspended reduction
 * below paygrade E-4 is also imposed."
 *
 * CONDITIONAL, NOT ABSOLUTE, and the condition is the part that gets missed.
 * An NCO may receive correctional custody, but only riding along with a
 * reduction that actually takes effect. A SUSPENDED reduction does not satisfy
 * it, because the accused never leaves E-4, which is why the suspension list is
 * consulted here rather than only the punishment list.
 *
 * This gates on the ACCUSED's grade, not the authority's. It is the second half
 * of "which punishments are available," the first being the imposing officer's
 * grade in releaseOnePunishmentsFor.
 */
export function correctionalCustodyGradeIssues(formData: FormData): ValidationIssue[] {
  const entries = punishmentEntries(formData);
  const accusedGrade = enlistedGradeNumber(formData.accusedPayGrade);
  if (accusedGrade === null || accusedGrade < 4) return [];

  const custodyIndexes = entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => {
      const code = resolvePunishment(entry.code);
      return !!code && /CORRECTIONAL CUSTODY/i.test(code.description);
    });
  if (custodyIndexes.length === 0) return [];

  const suspendedIndexes = new Set(
    suspensionEntries(formData).map((suspension) => suspension.punishmentIndex),
  );

  // A qualifying reduction: below E-4, and NOT suspended.
  const qualifies = entries.some((entry, index) => {
    const code = resolvePunishment(entry.code);
    if (!code || !code.parameters.includes('gradeReducedTo')) return false;
    if (suspendedIndexes.has(index)) return false;
    const target = enlistedGradeNumber(reducedPayGrade(entry.gradeReducedTo ?? ''));
    return target !== null && target < 4;
  });
  if (qualifies) return [];

  const suspendedReduction = entries.some((entry, index) => {
    const code = resolvePunishment(entry.code);
    return !!code && code.parameters.includes('gradeReducedTo') && suspendedIndexes.has(index);
  });

  return [
    issue(
      'navmc10132-v19-correctional-custody-grade',
      'block',
      suspendedReduction
        ? `Correctional custody is imposed on an E-${accusedGrade} and the accompanying reduction is SUSPENDED.`
        : `Correctional custody is imposed on an E-${accusedGrade} with no reduction below E-4.`,
      'JAGMAN 0111.b',
      'Correctional custody will not be imposed on persons in paygrade E-4 and above unless an ' +
        'unsuspended reduction below paygrade E-4 is also imposed. A suspended reduction does ' +
        'not satisfy this, because the accused never leaves E-4. Remove the correctional ' +
        'custody, or impose an unsuspended reduction below E-4.',
    ),
  ];
}

/**
 * V-20 (BLOCKING). A forfeiture exceeds the statutory ceiling for the grade it
 * is based on.
 *
 * TWO CONDITIONS BEFORE THIS EVER FIRES, both deliberate. The app must hold the
 * pay table in force on the punishment date (payTableStatus), and it must be
 * able to compute a ceiling from the recorded grade, length of service, and sea
 * or hardship duty pay. Miss either and this rule stays silent rather than
 * blocking on a number it cannot stand behind. A stale table blocking a lawful
 * forfeiture would be worse than no check.
 *
 * The grade used is `forfeitureBasisGrade` where one is recorded, which V-18
 * has already forced to equal the reduction target. Only where no reduction is
 * imposed does it fall back to item 19.
 */
export function forfeitureCeilingIssues(formData: FormData): ValidationIssue[] {
  const entries = punishmentEntries(formData);

  const status = payTableStatus(
    typeof formData.punishmentDate === 'string' ? formData.punishmentDate : '',
  );

  const basisGrade =
    (typeof formData.forfeitureBasisGrade === 'string' && formData.forfeitureBasisGrade.trim()) ||
    (typeof formData.accusedPayGrade === 'string' ? formData.accusedPayGrade : '');

  const result = forfeitureCeiling({
    status,
    payGrade: basisGrade,
    yearsOfService:
      typeof formData.accusedYearsOfService === 'string' ? formData.accusedYearsOfService : '',
    seaHardshipDutyPay:
      typeof formData.accusedSeaHardshipDutyPay === 'string'
        ? formData.accusedSeaHardshipDutyPay
        : '',
  });

  // NOT ALL SILENCE IS EQUAL. A superseded table, an unset grade, an unset
  // length of service, and a legitimately blank table cell are ordinary
  // states of a half-filled form, and blocking on them would be noise. An
  // UNREADABLE entry is a data error, and passing over it silently is how a
  // mistyped pay grade used to switch this gate off with no warning at all.
  if (result.kind === 'unavailable') {
    if (!CEILING_REASONS_WORTH_SURFACING.includes(result.reason)) return [];
    return [
      issue(
        `navmc10132-v20-ceiling-unreadable-${result.reason}`,
        'block',
        'The forfeiture ceiling cannot be computed because an input is unreadable.',
        'JAGMAN 0111.i; MCO 5800.16 Vol 14 para 010901',
        `${result.detail} Until it is readable the app cannot check the forfeiture against its ` +
          'statutory ceiling, so the check is not merely skipped, it is blocked.',
      ),
    ];
  }

  const ceiling = result.ceiling;
  const issues: ValidationIssue[] = [];

  entries.forEach((entry, index) => {
    const code = resolvePunishment(entry.code);
    if (!code) return;

    if (code.parameters.includes('dollars')) {
      const amount = Number((entry.dollars ?? '').trim());
      if (Number.isFinite(amount) && amount > ceiling.sevenDaysPay) {
        issues.push(
          issue(
            `navmc10132-v20-forfeiture-over-ceiling-${index}`,
            'block',
            `${code.code} forfeits $${amount} but the ceiling at ${ceiling.payGrade} is $${ceiling.sevenDaysPay}.`,
            '10 U.S.C. 815(b)(2)(C); JAGMAN 0111.i; DoD FMR Vol 7A Ch 1',
            `Seven days' pay at ${ceiling.payGrade} is $${ceiling.sevenDaysPay}, from monthly pay ` +
              `subject to forfeiture of $${ceiling.monthlySubjectToForfeiture.toFixed(2)} at one ` +
              `thirtieth per day. Rate source: ${BASIC_PAY_SOURCE_URL}. If the accused draws sea ` +
              'or hardship duty pay, enter it beside item 19 and this ceiling rises.',
          ),
        );
      }
    }

    if (code.parameters.includes('dollarsPerMonth')) {
      const amount = Number((entry.dollarsPerMonth ?? '').trim());
      if (Number.isFinite(amount) && amount > ceiling.halfMonthPay) {
        issues.push(
          issue(
            `navmc10132-v20-forfeiture-over-ceiling-${index}`,
            'block',
            `${code.code} forfeits $${amount} per month but the ceiling at ${ceiling.payGrade} is $${ceiling.halfMonthPay}.`,
            '10 U.S.C. 815(b)(2)(H)(iii); JAGMAN 0111.i',
            `One-half of one month's pay at ${ceiling.payGrade} is $${ceiling.halfMonthPay}, from ` +
              `monthly pay subject to forfeiture of $${ceiling.monthlySubjectToForfeiture.toFixed(2)}. ` +
              `Rate source: ${BASIC_PAY_SOURCE_URL}. If the accused draws sea or hardship duty ` +
              'pay, enter it beside item 19 and this ceiling rises.',
          ),
        );
      }
    }
  });

  return issues;
}

/**
 * V-21 (BLOCKING). The set of punishments in item 6 is not a lawful
 * combination.
 *
 * Delegates every rule to navmc10132-combination-limits.ts, which owns MCM
 * Part V para 5.d and the per-case aggregate ceilings of 5.b. This function
 * is only the bridge from findings to ValidationIssues, so the rules stay
 * testable without the validator's plumbing.
 *
 * WHY BLOCKING RATHER THAN ADVISORY. Every finding here describes a
 * punishment the commander has no authority to impose, which is the same
 * class as V-06 and V-19 and not the same class as the W-series advisories.
 * The app also states these exact rules on the A-1-d rights advisement, so
 * passing a set that contradicts what the accused was told is the one outcome
 * this rule exists to prevent.
 */
export function punishmentCombinationIssues(formData: FormData): ValidationIssue[] {
  const findings = combinationFindings({
    entries: punishmentEntries(formData),
    authorityPayGrade:
      typeof formData.njpAuthorityPayGrade === 'string' ? formData.njpAuthorityPayGrade : '',
    concurrent: formData.punishmentsConcurrent === true,
  });

  return findings.map((finding) =>
    issue(`navmc10132-v21-${finding.id}`, 'block', finding.rule, finding.citation, finding.detail),
  );
}

/**
 * V-22 (BLOCKING). An item 7 suspension runs longer than MCM Part V para
 * 6.a(2) allows.
 *
 * "Suspension of a punishment may not be for a period longer than 6 months
 * from the date of the suspension."
 *
 * Item 7 collected a period in months or days with NO ceiling of any kind
 * until 2026-08-25, so a twelve-month suspension recorded cleanly and
 * exported onto a permanent record. That is an unlawful suspension, the same
 * class as V-19 and V-21 rather than an advisory.
 *
 * The rule is computed as a DATE, not a day count, because the order says
 * months: a suspension imposed on 31 August runs to 28 February. See
 * njp-suspension-period.ts for the arithmetic and for the EAS caveat this
 * app cannot check.
 */
export function suspensionPeriodIssues(formData: FormData): ValidationIssue[] {
  return suspensionPeriodFindings(formData).map((finding) =>
    issue(`navmc10132-v22-${finding.id}`, 'block', finding.rule, finding.citation, finding.detail),
  );
}

/**
 * V-18 (BLOCKING). Item 6 carries both a reduction and a forfeiture, and the
 * forfeiture is not recorded as computed on the reduced grade.
 *
 * MCM Part V para 5.c(8), verbatim: "If the punishment includes both
 * reduction, whether or not suspended, and forfeiture of pay, the forfeiture
 * must be based on the grade to which reduced."
 *
 * WHY THIS IS A GATE AND NOT A WARNING. It is the most common pay error in
 * NJP, it produces an overcollection from the Marine's pay, and the words
 * "whether or not suspended" mean the usual intuition (a suspended reduction
 * did not happen, so pay him at the old grade) is exactly backwards.
 *
 * WHAT THIS CHECK CAN AND CANNOT VERIFY. It cannot check the arithmetic. The
 * app holds no basic-pay table, so it does not know what a month's pay is at
 * either grade and never claims to. What it CAN verify is the basis the clerk
 * recorded: `forfeitureBasisGrade` must equal the pay grade the reduction
 * targets. That turns an invisible assumption into a recorded, checkable one.
 * Do not upgrade the message to imply the dollar figure was validated.
 */
export function forfeitureReducedGradeIssues(formData: FormData): ValidationIssue[] {
  const entries = punishmentEntries(formData);

  const reduction = entries.find((entry) => {
    const code = resolvePunishment(entry.code);
    return !!code && code.parameters.includes('gradeReducedTo');
  });
  if (!reduction) return [];

  const forfeitures = entries.filter((entry) => {
    const code = resolvePunishment(entry.code);
    if (!code) return false;
    return code.parameters.includes('dollars') || code.parameters.includes('dollarsPerMonth');
  });
  if (forfeitures.length === 0) return [];

  const target = reducedPayGrade(reduction.gradeReducedTo ?? '');
  if (target === '') {
    return [
      issue(
        'navmc10132-v18-forfeiture-basis-unknown',
        'block',
        'A reduction and a forfeiture are both imposed, but the reduction names no target grade.',
        'MCM Part V para 5.c(8)',
        'The forfeiture must be based on the grade to which reduced, so the reduction target ' +
          'has to be set before the forfeiture basis can be checked. Select the grade reduced to ' +
          'in item 6.',
      ),
    ];
  }

  const recorded =
    typeof formData.forfeitureBasisGrade === 'string'
      ? formData.forfeitureBasisGrade.trim().replace(/-/g, '').toUpperCase()
      : '';

  if (recorded === target) return [];

  return [
    issue(
      'navmc10132-v18-forfeiture-basis-grade',
      'block',
      recorded === ''
        ? 'A reduction and a forfeiture are both imposed, and the forfeiture basis grade is not recorded.'
        : `The forfeiture is recorded as computed on ${recorded}, not on the reduced grade ${target}.`,
      'MCM Part V para 5.c(8)',
      `The reduction targets ${target}, so the forfeiture must be based on ${target} pay, even ` +
        'if the reduction is suspended. Set the forfeiture basis grade in item 6 and recompute ' +
        'the dollar amount from the pay table at that grade. The app checks the basis you ' +
        'record, not the arithmetic.',
    ),
  ];
}

/**
 * Aggregate export. Runs every punishment-side rule in table order, blockers
 * first (V-04, V-05, V-14, V-15, V-16), then the advisory and blocker rules
 * reading the individual codes (W-05 through W-08). W-06 is a blocker
 * despite sitting among the W-numbered rules, see its own JSDoc.
 */
export function punishmentIssues(formData: FormData): ValidationIssue[] {
  return [
    ...punishmentPresenceIssues(formData),
    ...suspensionTermsIssues(formData),
    ...suspensionIndexBoundsIssues(formData),
    ...suspensionOverflowIssues(formData),
    ...punishmentAuthorizationIssues(formData),
    ...punishmentFieldCapacityIssues(formData),
    ...appealDecisionIncreaseIssues(formData),
    ...punishmentAuthorityGradeIssues(formData),
    ...punishmentParameterCeilingIssues(formData),
    ...forfeitureWholeDollarIssues(formData),
    ...reductionPayGradeIssues(formData),
    ...forfeitureReducedGradeIssues(formData),
    ...correctionalCustodyGradeIssues(formData),
    ...forfeitureCeilingIssues(formData),
    ...punishmentCombinationIssues(formData),
    ...suspensionPeriodIssues(formData),
  ];
}
