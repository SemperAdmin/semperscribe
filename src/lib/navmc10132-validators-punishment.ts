/**
 * NAVMC 10132 item 6/7/14 punishment validators.
 *
 * Covers the punishment-side blockers and warnings from docs/NAVMC_10132_SPEC.md
 * section 6: V-04, V-05 (plus its suspensionIndexBoundsIssues addendum), V-14,
 * V-15, V-16, V-17, V-18, V-19, V-20, V-21, V-22, V-29, V-30, W-05, W-06,
 * W-07, W-08, W-17, W-18. KEEP THIS LIST ACCURATE: it undercounted V-17
 * through V-22 and W-17 for a time, which is how a file can carry a rule
 * nobody reading only the header would know to look for. All other rules
 * in section 6 (offense/finding rules, date ordering, capacity rules
 * outside item 6, accused identity, unit, EDIPI) live in sibling modules.
 *
 * Also carries V-31 (`suspensionDuplicateTargetIssues`), which is NOT one of
 * the section 6 rows above: it has no docs/NAVMC_10132_SPEC.md paragraph
 * behind it at all. It exists on the subject-matter expert's determination
 * that only one suspension may attach to one punishment, dated 2026-08-25.
 * See its own JSDoc for the full reasoning and why the citation names the
 * determination rather than a regulation.
 *
 * Also carries V-32, V-33, and W-20 (`vacationPartialDetailIssues`,
 * `vacationSuspensionIndexBoundsIssues`, `vacationNoticeAfterRemissionIssues`),
 * the export-side rules over the vacation records added for decision row
 * D-60. Like V-31, none of the three has a docs/NAVMC_10132_SPEC.md section
 * 6 row: V-32 and V-33 are app-side record-integrity checks over a data
 * model this codebase itself defines, not a rule an outside source states,
 * and W-20 is deliberately 'warn', not 'block' — see its own JSDoc for why
 * the same conditional-date reasoning as W-17 applies. See each function's
 * own JSDoc for its citation, or the deliberate lack of one.
 *
 * Also carries W-18 (`vacationRightsAdvisementIssues`), decision row D-54:
 * JAGMAN 0118.d's Article 31 rights advisement, which must precede the
 * Figure 14-1 notice of intent (the notice IS the commander's ask, per
 * 0118.d's own wording). This IS a section 6 spec row (see docs/NAVMC_10132_SPEC.md's
 * W-18) but, like W-17 and W-20, deliberately stays 'warn': see the
 * function's own JSDoc for why, and for the two distinct sub-conditions it
 * checks against the `article31RightsReadDate` field D-54 added to
 * `Navmc10132Vacation`.
 *
 * Also carries W-19 (`vacationOrderDeadlineIssues`), decision row D-52:
 * JAGMAN 0118.d's ten-working-day limit on issuing the vacating order,
 * measured from `noticeServedDate` to `outcomeDate`. Stays 'warn' for the
 * same reason as W-18 immediately above (history, not drafting: the app
 * cannot un-issue a late order). Reads `noticeServedDate` as the
 * commencement date JAGMAN 0118.d means SOLELY because of the owner's
 * 2026-08-25 determination recorded on the function's own JSDoc, not
 * because any published paragraph equates the two; see that JSDoc before
 * touching this assumption. Also documents, in the same JSDoc, why a plain
 * weekday count (this codebase has no federal-holiday table) is presented
 * with its limitation named rather than as an authoritative working-day
 * count.
 *
 * Also carries V-34 (`vacationRemarkMissingIssues`), found while closing
 * W-18 above: an executed vacation record (`status` `'vacated-full'` or
 * `'vacated-part'`) for which `vacationRemarks` (navmc10132-acroform.ts)
 * produced no item 21 remark, for ANY reason, not one enumerated list of
 * reasons. Like V-31 through V-33, no docs/NAVMC_10132_SPEC.md section 6
 * row: it is an app-side consistency check between two artifacts this
 * codebase itself produces (a vacation record and the exported remarks),
 * not a rule an outside source states. UNLIKE W-18 and W-20, this one
 * BLOCKS: see its own JSDoc for why the reasoning that keeps those two at
 * 'warn' does not apply here. Reads `vacationRemarkOutcomes`
 * (navmc10132-acroform.ts) rather than re-deriving any part of what that
 * function already decides; see both JSDocs for why that import, not a
 * copy, is the point.
 *
 * Also carries V-29 and its W-21 companion (`vacationOffenceWindowIssues`,
 * `vacationOffenceAfterRemissionIssues`), decision row D-49: whether a
 * vacation's triggering offence date falls inside the suspension window
 * MCO 011201 and JAGMAN 0118.d both describe. THIS PAIR IS DELIBERATELY
 * ASYMMETRIC. V-29 blocks only on the certain lower bound (an offence
 * cannot precede the suspension it is offered to justify); W-21 warns,
 * never blocks, on the same conditional upper bound W-17 and W-20 already
 * treat as advisory, for the identical reason. See V-29's own JSDoc for
 * the full argument.
 *
 * Also carries V-30 and its W-22 companion (`vacatingAuthorityInsufficientIssues`,
 * `vacatingAuthorityUnknownIssues`), decision row D-56: whether the
 * commander recorded as vacating a suspension, via the new
 * `vacatingAuthorityGrade` field, is competent for the kind and amount
 * vacated. Mirrors `punishmentAuthorityGradeIssues` (W-05)'s block/warn
 * split over `authoritySatisfies`'s three outcomes, applied to the
 * vacating authority instead of item 8A's imposing authority. BOTH ARE
 * SILENT ON A `'vacated-part'` RECORD: `vacatedDetail` is free text this
 * app cannot turn into a legal figure, so neither rule may treat the whole
 * punishment's requirement as a stand-in for a partial vacation's. See
 * V-30's own JSDoc for the full argument.
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
import type {
  Navmc10132PunishmentEntry,
  Navmc10132Suspension,
  Navmc10132Vacation,
} from '@/types/navmc';
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
import {
  suspensionPeriodFindings,
  suspensionsWithComputedEnd,
  SUSPENSION_ASSUMPTIONS,
} from '@/lib/njp-suspension-period';
// parseIsoDate, not a bare `new Date(iso)` call: see that module's own
// header for the UTC-parses-a-bare-date-string trap it exists to avoid.
// vacationOrderDeadlineIssues (W-19) below is the caller.
import { parseIsoDate } from '@/lib/navmc10132-date';
// Value import, not type-only: navmc10132-acroform.ts imports only
// '@/types', '@/types/navmc' and navmc10132-utils.ts (itself import-free),
// none of which reach back into this module or into letter-validators.ts,
// so this edge does not create the module cycle the letter-validators
// type-only import above guards against. V-34 below reads
// `vacationRemarkOutcomes` rather than re-deriving any part of what it
// checks; see V-34's own JSDoc for why.
import { vacationRemarkOutcomes } from '@/lib/navmc10132-acroform';

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

/** Reads the vacation records array (decision row D-60), tolerating an
 * unset or non-array field. */
function vacationEntries(formData: FormData): Navmc10132Vacation[] {
  return Array.isArray(formData.vacations)
    ? (formData.vacations as Navmc10132Vacation[])
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
 * V-31 (blocker). Two or more item 7 suspension entries name the same item 6
 * `punishmentIndex`, the same punishment suspended twice over.
 *
 * NOT A REGULATORY CITATION, AND DELIBERATELY SO. Neither the MCM, the
 * JAGMAN, nor MCO 5800.16 Vol 14 states a one-suspension-per-punishment
 * rule anywhere a search by this app's authors or by a second agent could
 * find. This rule exists on Stephen's determination as the subject-matter
 * expert, dated 2026-08-25, not on a published paragraph. The citation
 * field says so plainly rather than borrowing MCM Part V 5.c(8), the
 * JAGMAN, or the MCO as if one of them said this, because none of them
 * does, and a citation that overstates its own authority is the exact
 * failure this app exists to prevent. Alongside the determination there is
 * a structural fact worth stating: the NAVMC 10132 prints exactly ONE item
 * 7 field, so even a command that meant to record two independent
 * suspensions against one item 6 punishment has no place on the form to
 * write the second one distinctly. If a published paragraph stating this
 * rule ever turns up, replace the citation below with it; until then, cite
 * the determination.
 *
 * SILENT on an out-of-bounds or unreadable punishmentIndex: that is
 * `suspensionIndexBoundsIssues` (V-05 addendum)'s job. Two rules both
 * complaining about one bad index field trains people to tune out one of
 * them, so this rule only ever looks at indices V-05 has already accepted
 * as in-bounds.
 *
 * THE ID IS KEYED ON THE DUPLICATE ENTRY'S OWN POSITION in `suspensions`,
 * i.e. the array index this function itself iterates on to find it, NEVER
 * on `punishmentIndex`. `punishmentIndex` is exactly the value this rule
 * finds shared by two or more entries, so keying the id on it would hand
 * every issue this rule emits for one shared punishmentIndex the SAME id.
 * That is the identical failure already fixed on `suspensionPeriodFindings`
 * (V-22, njp-suspension-period.ts) and `suspensionInterruptionAssumptionIssues`
 * (W-17, above): this codebase renders validation lists with
 * `key={issue.id}` (ComplianceDialog.tsx, PackageDialog.tsx), so a
 * duplicate id does not just read oddly in a log, it makes React silently
 * drop one of the two issues off the screen.
 */
export function suspensionDuplicateTargetIssues(formData: FormData): ValidationIssue[] {
  const punishments = punishmentEntries(formData);
  const suspensions = suspensionEntries(formData);

  // Group each suspension's own array position by the punishmentIndex it
  // targets, considering only entries suspensionIndexBoundsIssues (V-05)
  // would accept as in-bounds. An out-of-bounds or unreadable
  // punishmentIndex is left entirely alone here; that field is V-05's to
  // flag, not this rule's.
  const positionsByTarget = new Map<number, number[]>();
  suspensions.forEach((suspension, index) => {
    const { punishmentIndex } = suspension;
    const inBounds =
      Number.isInteger(punishmentIndex) &&
      punishmentIndex >= 0 &&
      punishmentIndex < punishments.length;
    if (!inBounds) return;

    const positions = positionsByTarget.get(punishmentIndex);
    if (positions) positions.push(index);
    else positionsByTarget.set(punishmentIndex, [index]);
  });

  const issues: ValidationIssue[] = [];
  positionsByTarget.forEach((positions, punishmentIndex) => {
    if (positions.length < 2) return;

    const punishment = punishments[punishmentIndex];
    const named = resolvePunishment(punishment.code)?.shortName ?? punishment.code;
    const otherPositions = (position: number) =>
      positions.filter((p) => p !== position).join(', ');

    positions.forEach((position) => {
      issues.push(
        issue(
          `navmc10132-v31-${position}`,
          'block',
          `Item 7 suspension entry ${position} suspends the same item 6 punishment ` +
            `(${named}, index ${punishmentIndex}) as entry ${otherPositions(position)}.`,
          'Command determination (Stephen), 2026-08-25. Not a published MCO or JAGMAN ' +
            'paragraph. The NAVMC 10132 carries one item 7 field per punishment',
          `Only one suspension may attach to one item 6 punishment. Item 7 entries ` +
            `${positions.join(' and ')} both target the ${named} punishment at item 6 ` +
            `index ${punishmentIndex}. Keep exactly one of these suspensions and remove ` +
            'the rest, or, if a different punishment was actually meant, repoint the ' +
            'extra entry at that punishment instead.',
        ),
      );
    });
  });

  return issues;
}

/**
 * V-32 (blocker). A vacation record's outcome is `'vacated-part'` but does
 * not say what part was actually vacated. Decision row D-60.
 *
 * NOT A REGULATORY CITATION, for the same reason V-31 above is not one:
 * neither the MCM, the JAGMAN, nor MCO 5800.16 Vol 14 prescribes a
 * machine-checkable format for the vacation RECORD itself, only for the
 * Figure 14-1 notice that precedes it. Figure 14-1 paragraph 2 offers
 * "FULL/PART" as the commander's election; recording PART while naming
 * nothing vacated is an incomplete record on its face. It also breaks the
 * derivation this record exists to feed: `vacationRemarks`
 * (navmc10132-acroform.ts) composes the item 21 remark from exactly this
 * detail, so a partial vacation with nothing named renders as an
 * undifferentiated "vacated" line, silently overstating what actually
 * happened to the suspended punishment.
 *
 * THE ID IS KEYED ON THE VACATION'S OWN POSITION in `vacations`, never on
 * `suspensionIndex`. Nothing in the model forbids two vacation records
 * from naming the same suspensionIndex (this rule does not check for that,
 * and nothing else in this file does either), so keying on suspensionIndex
 * risks the identical duplicate-id defect V-31's own JSDoc describes, the
 * one that made ComplianceDialog.tsx and PackageDialog.tsx silently drop
 * an issue off the screen (`key={issue.id}`).
 */
export function vacationPartialDetailIssues(formData: FormData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  vacationEntries(formData).forEach((vacation, index) => {
    if (vacation.status !== 'vacated-part') return;
    if ((vacation.vacatedDetail ?? '').trim() !== '') return;

    issues.push(
      issue(
        `navmc10132-v32-vacation-partial-no-detail-${index}`,
        'block',
        `Vacation record ${index} is marked vacated in part but does not say what part.`,
        'MCO 5800.16 Vol 14 Figure 14-1 para 2 ("FULL/PART")',
        'A partial vacation must record what was actually vacated so item 21 can state it ' +
          'and so the part of the suspended punishment that survives can still be tracked. ' +
          'Enter what was vacated, or change the outcome to vacated in full if the entire ' +
          'suspended punishment was vacated.',
      ),
    );
  });

  return issues;
}

/**
 * V-33 (blocker). A vacation record names a `suspensionIndex` item 7 does
 * not carry. Decision row D-60.
 *
 * Mirrors `suspensionIndexBoundsIssues` (the V-05 addendum, above) one
 * level up: that rule checks a suspension's `punishmentIndex` against item
 * 6; this checks a vacation's `suspensionIndex` against item 7. A vacation
 * with a dangling `suspensionIndex` has nothing to vacate and nothing for
 * `vacationRemarks` (navmc10132-acroform.ts) to render truthfully, the
 * same reasoning the V-05 addendum's own JSDoc gives for blocking rather
 * than warning on this class of error.
 *
 * `suspensionIndex`, NEVER `punishmentIndex`: see `Navmc10132Vacation`'s
 * own JSDoc (src/types/navmc.ts) and `SuspensionPeriod`'s in
 * njp-suspension-period.ts for why only a suspension's own array position
 * identifies it unambiguously.
 *
 * SILENT on a vacation record whose suspensionIndex is in bounds but whose
 * target is itself malformed (an out-of-bounds punishmentIndex, say): that
 * is `suspensionIndexBoundsIssues`'s (V-05) finding on the suspension
 * entry, not this rule's on the vacation entry that points at it.
 */
export function vacationSuspensionIndexBoundsIssues(formData: FormData): ValidationIssue[] {
  const suspensions = suspensionEntries(formData);
  const issues: ValidationIssue[] = [];

  vacationEntries(formData).forEach((vacation, index) => {
    const { suspensionIndex } = vacation;
    const inBounds =
      Number.isInteger(suspensionIndex) &&
      suspensionIndex >= 0 &&
      suspensionIndex < suspensions.length;
    if (inBounds) return;

    issues.push(
      issue(
        `navmc10132-v33-vacation-suspension-index-${index}`,
        'block',
        `Vacation record ${index} names suspensionIndex ${suspensionIndex}, which is not a ` +
          'suspension item 7 carries.',
        'Item 7 / item 21 consistency (decision row D-60)',
        'A vacation record must name a suspension actually recorded in item 7. Remove this ' +
          'vacation record, or point it at a valid index' +
          (suspensions.length > 0
            ? `, 0 through ${suspensions.length - 1}.`
            : '; item 7 carries no suspensions to vacate.'),
      ),
    );
  });

  return issues;
}

/**
 * V-34 (BLOCKING). A vacation record's `status` is `'vacated-full'` or
 * `'vacated-part'`, i.e. it asserts a vacation actually happened, but item
 * 21 carries no remark for it. The exported UPB is a permanent record that
 * a vacation occurred while the exported document says nothing about it.
 *
 * FOUND CLOSING D-54 / W-18, in `vacationRemarks` (navmc10132-acroform.ts,
 * shipped under decision row D-60 earlier the same day). That function has
 * FOUR distinct places it can return nothing for an executed record: the
 * item 6 punishment date is blank (which suppresses every vacation remark
 * on the form at once), the outcome date is blank, the targeted suspension
 * does not exist, or the punishment that suspension names cannot be
 * rendered. Only the third of the four had a rule (V-33, above). The other
 * three were reachable and unguarded.
 *
 * WHY THIS IS ONE RULE, NOT FOUR. Enumerating the four causes as four
 * separate checks would mean this rule re-implements, in a second place,
 * exactly the branching `deriveVacationRemark` (navmc10132-acroform.ts)
 * already implements, and the two would have to be kept in lockstep by
 * hand forever. That is precisely how the gap this rule closes was created
 * in the first place: three of the four branches were added to the
 * derivation without anyone adding a matching rule for them. Checking the
 * OUTCOME instead, "did the derivation actually produce a remark for this
 * record," cannot fall behind the derivation it guards, because it reads
 * the derivation's own result (`vacationRemarkOutcomes`) rather than a copy
 * of its logic. A fifth guard added to `deriveVacationRemark` tomorrow is
 * caught by this rule automatically, with no corresponding edit required
 * here.
 *
 * `vacationRemarkOutcomes` IS THE SHARED DERIVATION, IMPORTED, NOT COPIED.
 * See its own JSDoc (navmc10132-acroform.ts) for why re-deriving any part
 * of "would a remark be produced" here, instead of importing the answer,
 * would reintroduce the identical drift risk this rule exists to close.
 * `outcome.gapReason` is a best-effort explanation of WHICH input was
 * missing, built by that module walking the same checks in the same order
 * for message purposes only; it is never what this rule's severity decision
 * is based on, so a `gapReason` that has not been updated for some future
 * fifth branch degrades to a generic closing line rather than causing this
 * rule to miss the gap.
 *
 * WHY 'block' AND NOT 'warn', UNLIKE W-18 AND W-20 JUST ABOVE. Those two
 * warn because the app cannot observe an unrecorded real-world fact (a
 * rights reading, an interruption) and refusing export cannot fix history
 * either way. This is different in kind: the record ITSELF states a
 * vacation happened (`status` says so) and the export ITSELF is what fails
 * to say so, a contradiction between two artifacts this app produces
 * together, not a gap in what the app can observe about the world. That is
 * squarely within what the app can prove and fix, so it blocks.
 *
 * THE ID IS KEYED ON EACH VACATION'S OWN POSITION in `vacations`, matching
 * V-32, V-33 and W-20 above, for the identical `key={issue.id}` reason
 * their own JSDocs give.
 */
export function vacationRemarkMissingIssues(formData: FormData): ValidationIssue[] {
  const outcomes = vacationRemarkOutcomes(formData);
  const issues: ValidationIssue[] = [];

  vacationEntries(formData).forEach((vacation, index) => {
    const outcome = outcomes[index];
    if (!outcome || outcome.remark) return; // no gap, or nothing this rule cares about
    if (outcome.gapReason === null) return; // 'pending' or 'not-vacated': correctly produced nothing

    issues.push(
      issue(
        `navmc10132-v34-vacation-remark-missing-${index}`,
        'block',
        `Vacation record ${index} is recorded as ${vacation.status}, but item 21 carries no ` +
          'remark stating so.',
        'NAVMC 10132 (REV. 08-2023) instructions, page 3, ITEM 21; decision row D-60',
        `This record says a vacation occurred, so the exported UPB must say so too, and it ` +
          `currently would not: ${outcome.gapReason}. Fix that and item 21 will carry the ` +
          'vacation remark automatically; nothing else needs to change by hand.',
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
 * W-17 (ADVISORY, NOT A BLOCKER — read this before touching the severity).
 *
 * docs/NAVMC_10132_SPEC.md's own row for W-17 describes the computed
 * suspension end date as "a floor, not a fixed date." That wording is
 * WRONG, not just loose. A floor only ever moves the real date later. MCM
 * Part V para 6.a(2)'s second clause — expiration of the current enlistment
 * "automatically terminates the period of suspension" — can make the real
 * date EARLIER than computed, and JAGMAN 0118.c's two interruptions can
 * make it LATER. The number njp-suspension-period.ts computes
 * (`endsOnIfUninterrupted`) is neither a floor nor a ceiling: it is the date
 * that holds only if none of three unmodeled conditions occurred. See the
 * module docstring on njp-suspension-period.ts for the full argument. This
 * rule implements the CORRECT statement, not the spec row's, and names all
 * three conditions with their citations and directions rather than
 * repeating "floor."
 *
 * WHY 'warn' AND NOT 'block' OR 'fail'. The app has no field for
 * unauthorized absence, no field for a vacation proceeding already
 * underway, and no EAS field. It cannot observe whether any of the three
 * occurred, so it cannot prove the computed date is wrong — only that it
 * rests on assumptions the app cannot check. That is exactly what 'warn'
 * (Advisory) means under the severity contract at the top of this file.
 * Do not upgrade this to 'block' or 'fail': doing so would stop, or
 * mis-badge as non-compliant, an export the app has no basis to refuse.
 *
 * FIRES ONCE PER SUSPENSION WITH A COMPUTED END DATE, silent when item 7
 * carries none. A suspension whose period is unreadable (see
 * `suspensionsWithComputedEnd`) has no date for this warning to qualify, so
 * it is left to whatever rule already flags the unreadable entry
 * (`suspensionTermsIssues`, V-05) rather than duplicated here.
 *
 * THE ID IS KEYED ON suspensionIndex, NOT punishmentIndex. Nothing forbids
 * two item-7 suspensions from naming the same punishmentIndex, so keying the
 * id on punishmentIndex would let two suspensions against one punishment
 * emit the SAME id here. That is not a cosmetic risk: this codebase renders
 * validation lists with `key={issue.id}`, so a duplicate id can drop one of
 * the two issues off the screen rather than merely reading oddly in a log.
 * suspensionIndex is each suspension's own position in the array and is
 * unique by construction. See the identical fix on `suspensionPeriodFindings`
 * (V-22) in njp-suspension-period.ts.
 */
export function suspensionInterruptionAssumptionIssues(formData: FormData): ValidationIssue[] {
  return suspensionsWithComputedEnd(formData).map((period) => {
    const assumptionLines = SUSPENSION_ASSUMPTIONS.map(
      (a) => `${a.effect} (${a.citation})`,
    ).join(' ');
    return issue(
      `navmc10132-w17-${period.suspensionIndex}`,
      'warn',
      `The computed end date for the suspension of ${period.code || 'the item 6 punishment'} ` +
        `(${period.endsOnIfUninterrupted}) is conditional, not fixed: three conditions this app ` +
        'cannot see can move the real date earlier or later.',
      'JAGMAN (JAGINST 5800.7G CH-2) para 0118.c; MCM Part V para 6.a(2)',
      `Item 7's suspension of ${period.code || 'the item 6 punishment'} computes to end on ` +
        `${period.endsOnIfUninterrupted} if nothing interrupts or terminates it first. ` +
        `${assumptionLines} Confirm none of these occurred before treating ` +
        `${period.endsOnIfUninterrupted} as the actual date the punishment was remitted or a ` +
        'vacation deadline expired.',
    );
  });
}

/**
 * W-20 (ADVISORY, NOT A BLOCKER — read W-17's reasoning above before
 * touching the severity; the same argument applies here). Decision row
 * D-60.
 *
 * `endsOnIfUninterrupted` (njp-suspension-period.ts) is a conditional
 * date, not a certain one: two JAGMAN 0118.c interruptions can push the
 * real remission date LATER, and MCM Part V para 6.a(2)'s
 * enlistment-expiration clause can pull it EARLIER, and this app has a
 * field for none of the three. A Figure 14-1 notice served after the
 * computed date MIGHT be acting on a punishment MCM 6.a(3) already remitted
 * "without further action" — or might not, if an interruption the app
 * cannot see kept the suspension alive past that date. BLOCKING here would
 * stop a lawful notice on a number the app cannot stand behind, exactly
 * the failure D-51 in docs/NAVMC_10132_SPEC.md exists to prevent. Read
 * that row, and W-17's JSDoc above, before changing this severity.
 *
 * COMPARES `noticeServedDate`, NOT `outcomeDate`. The notice-served date is
 * the fact this record actually carries about WHEN Figure 14-1 went out;
 * `outcomeDate` is when the commander later decided, always on or after
 * the notice. If the notice itself went out after the computed remission
 * date, everything downstream of it inherits the same problem, so checking
 * the earliest fact catches it soonest — and this rule never emits on a
 * `'pending'` record for exactly that reason, since a still-pending
 * vacation has no `outcomeDate` to compound the warning with.
 *
 * NOT the JAGMAN 0118.d ten-working-day order deadline (spec row W-19,
 * unbuilt): that deadline runs from "commencement of the vacation
 * proceedings," a date `Navmc10132Vacation` deliberately does not claim
 * `noticeServedDate` to be (see its own JSDoc). This rule is the D-36/D-51
 * remission-floor deadline only.
 *
 * SILENT when the vacation names an out-of-bounds suspensionIndex (V-33's
 * job, not this rule's) or when njp-suspension-period.ts cannot compute an
 * end date at all (`suspensionsWithComputedEnd` already excludes those).
 */
export function vacationNoticeAfterRemissionIssues(formData: FormData): ValidationIssue[] {
  const byIndex = new Map(
    suspensionsWithComputedEnd(formData).map((period) => [period.suspensionIndex, period]),
  );

  return vacationEntries(formData).flatMap((vacation, index) => {
    const period = byIndex.get(vacation.suspensionIndex);
    if (!period) return [];

    const noticeServedDate = (vacation.noticeServedDate ?? '').trim();
    if (noticeServedDate === '' || noticeServedDate <= period.endsOnIfUninterrupted) return [];

    return [
      issue(
        `navmc10132-w20-vacation-notice-after-remission-${index}`,
        'warn',
        `Vacation record ${index}'s notice was served on ${noticeServedDate}, after the ` +
          `computed suspension end date of ${period.endsOnIfUninterrupted}.`,
        'MCM Part V para 6.a(3); JAGMAN (JAGINST 5800.7G CH-2) para 0118.c; MCM Part V para 6.a(2)',
        `Unless interrupted or terminated first, the suspension of ` +
          `${period.code || 'the item 6 punishment'} is remitted without further action on ` +
          `${period.endsOnIfUninterrupted}, and a notice served after that date acts on a ` +
          'punishment that may no longer exist. This computed date is conditional, not ' +
          'certain: unauthorized absence, a prior vacation proceeding already underway, or an ' +
          'earlier expiration of the current enlistment can each change the real date. Confirm ' +
          'which applies before treating this notice as untimely.',
      ),
    ];
  });
}

/**
 * W-18 (ADVISORY, NOT A BLOCKER — read this before touching the severity).
 * Decision row D-54.
 *
 * JAGMAN (JAGINST 5800.7G CH-2) para 0118.d, verbatim: "If the reason for
 * vacation involves additional misconduct, Article 31, UCMJ, rights must be
 * read to the accused before the commander asks if the accused wishes to
 * make a statement on his or her own behalf." MCO 5800.16 Vol 14 para
 * 011201 requires a UCMJ offense as the basis for ANY vacation, so under
 * the MCO this fires in effectively every Marine Corps vacation. But D-49
 * records a real conflict: JAGMAN 0118.d itself permits vacation on "a
 * violation of the conditions of suspension," which need not be misconduct
 * at all, and the app was deliberately ruled to gate only on the
 * suspension DATE WINDOW, never on the nature of the basis, because it
 * cannot tell the two apart from the data it holds. Both messages below
 * therefore say "if this vacation is based on misconduct," naming the
 * condition, rather than asserting it as fact.
 *
 * WHY 'warn' AND NOT 'block'. Two independent reasons, either sufficient on
 * its own:
 *   1. UNPROVABLE PREMISE. Per D-49 above, the app cannot know whether
 *      0118.d's misconduct trigger even applies to a given vacation. A
 *      blocker fires on a premise the app cannot establish, which is the
 *      same reasoning W-17 gives for its own severity (see that JSDoc).
 *   2. HISTORY, NOT DRAFTING. Even where 0118.d plainly applies, this
 *      record is memorializing something that ALREADY HAPPENED (or did
 *      not) before the clerk ever opens the app. Blocking export would
 *      trap a clerk from truthfully recording a rights reading that came
 *      too late, or that never got recorded, and refusing the export
 *      cannot retroactively fix the sequence or un-read the rights either
 *      way. Compare W-19 in docs/NAVMC_10132_SPEC.md (the JAGMAN 0118.d
 *      ten-working-day order deadline), advisory for the identical reason:
 *      "the app has no ability to un-issue a late order and a block would
 *      trap a clerk recording history truthfully."
 *
 * TWO SUB-RULES, BOTH APPLIED PER VACATION RECORD, AT MOST ONE FIRING PER
 * RECORD (the second is only checked once the first has already cleared):
 *
 *   - rights-not-recorded: `article31RightsReadDate` is unset. This is the
 *     rule that makes the warning ACTIONABLE rather than the permanent,
 *     unacknowledgeable noise the task record for this decision explicitly
 *     rejects: enter the date, and this stops firing for that record. It
 *     necessarily fires on most vacation records that predate this field
 *     (including every fixture in tests/navmc10132-vacation.test.ts), which
 *     is correct, not a bug: those records genuinely have not recorded the
 *     fact yet.
 *   - rights-after-notice: `article31RightsReadDate` IS recorded, but on or
 *     after `noticeServedDate`. Figure 14-1, the notice of intent to
 *     vacate, is the document that invites the accused's response, so
 *     SERVING IT IS "the commander asks if the accused wishes to make a
 *     statement" in 0118.d's own words. A reading recorded on or after that
 *     date is the wrong order regardless of the misconduct question, which
 *     is why this sub-rule's message does not hedge on that condition the
 *     way rights-not-recorded's does. Strictly later-or-equal, not merely
 *     later: 0118.d requires the reading to come BEFORE the notice, so a
 *     same-day recording with no way to establish which came first inside
 *     the day is not evidence of the correct order and is treated the same
 *     as recording it after.
 *
 * NEVER `commencementDate` OR ANY 0118.c/0118.d "commencement of
 * proceedings" DATE, because `Navmc10132Vacation` carries none. This rule
 * compares against `noticeServedDate` only, per that field's own JSDoc
 * warning against treating it as the commencement date. The ten-working-day
 * order deadline (spec row W-19, decision row D-52) is a SEPARATE rule,
 * `vacationOrderDeadlineIssues` below, and out of this rule's scope. That
 * rule DOES read `noticeServedDate` as the commencement date, but only
 * because Stephen ruled the two the same date on 2026-08-25; see that
 * function's own JSDoc for why this rule must not make the same
 * assumption on its own authority.
 *
 * SILENT ON A VACATION WITH AN OUT-OF-BOUNDS `suspensionIndex`. That is
 * V-33's finding on the record's target, not this rule's concern; this rule
 * only ever reads the vacation record's own two date fields.
 *
 * THE ID IS KEYED ON EACH VACATION'S OWN POSITION in `vacations`, matching
 * V-32, V-33 and W-20 above, for the identical `key={issue.id}` reason their
 * own JSDocs give.
 */
export function vacationRightsAdvisementIssues(formData: FormData): ValidationIssue[] {
  return vacationEntries(formData).flatMap((vacation, index) => {
    const rightsReadDate = (vacation.article31RightsReadDate ?? '').trim();

    if (rightsReadDate === '') {
      return [
        issue(
          `navmc10132-w18-rights-not-recorded-${index}`,
          'warn',
          `Vacation record ${index} does not record when Article 31, UCMJ rights were read.`,
          'JAGMAN (JAGINST 5800.7G CH-2) para 0118.d',
          'If this vacation is based on misconduct, Article 31 rights must be read to the ' +
            'accused before the commander asks whether the accused wishes to make a ' +
            'statement, and serving the Figure 14-1 notice of intent is that ask. The app ' +
            'cannot determine from the data it holds whether this vacation is in fact based ' +
            'on misconduct or on a bare violation of the conditions of suspension, which ' +
            'JAGMAN 0118.d also allows without a rights reading. Enter the date rights were ' +
            'read, or confirm the basis does not involve misconduct.',
        ),
      ];
    }

    const noticeServedDate = (vacation.noticeServedDate ?? '').trim();
    if (noticeServedDate === '' || rightsReadDate < noticeServedDate) return [];

    return [
      issue(
        `navmc10132-w18-rights-after-notice-${index}`,
        'warn',
        `Vacation record ${index} records Article 31 rights read on ${rightsReadDate}, on or ` +
          `after the notice was served on ${noticeServedDate}.`,
        'JAGMAN (JAGINST 5800.7G CH-2) para 0118.d',
        'JAGMAN 0118.d requires Article 31 rights to be read before the commander asks ' +
          'whether the accused wishes to make a statement, and serving the Figure 14-1 ' +
          'notice of intent is that ask. This record shows the rights reading on the same ' +
          'day as or after the notice, which is the wrong order. Confirm the actual sequence ' +
          'and correct this date if the rights reading in fact came first.',
      ),
    ];
  });
}

/** The 10-working-day limit JAGMAN 0118.d sets for the vacating order. */
const VACATION_ORDER_WORKING_DAY_LIMIT = 10;

/**
 * Counts Monday-through-Friday calendar days strictly after `startIso`
 * through `endIso` inclusive. `startIso` itself is day zero and is never
 * counted, matching the ordinary forward-looking reading of "within N days
 * of X". Returns 0, not an error, when `endIso` is on or before `startIso`.
 * Returns null when either date fails strict ISO parsing.
 *
 * THIS COUNTS WEEKDAYS, NOT WORKING DAYS, AND CALLERS MUST NOT CONFUSE THE
 * TWO. No federal-holiday table exists anywhere in this codebase (checked
 * 2026-08-25), so a holiday that lands on a weekday inside the span is
 * still counted here as if it were a working day, though it is not. The
 * result can therefore only ever be greater than or equal to the true
 * number of working days in the span, never less: this function OVERCOUNTS
 * working days, it never undercounts them. See `vacationOrderDeadlineIssues`
 * (W-19) below, the only caller, for why that direction of error is the one
 * this rule can act on honestly and why the raw result must never be
 * presented to a user as a working-day count on its own.
 */
function countWeekdaysAfter(startIso: string, endIso: string): number | null {
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  if (start === null || end === null) return null;
  if (end <= start) return 0;

  let count = 0;
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
  while (cursor <= end) {
    const dayOfWeek = cursor.getDay(); // 0 Sun ... 6 Sat, local calendar.
    if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

/**
 * W-19 (ADVISORY, NOT A BLOCKER, read this before touching the severity).
 * Decision row D-52.
 *
 * JAGMAN (JAGINST 5800.7G CH-2) para 0118.d, verbatim: "The order vacating
 * a suspension must be issued within 10 working days of the commencement
 * of the vacation proceedings."
 *
 * THE TWO DATES THIS RULE NEEDS, AND WHERE EACH ONE COMES FROM.
 *
 *   - "The order vacating a suspension is issued" is the commander's own
 *     decision, which `Navmc10132Vacation.outcomeDate` already records: the
 *     date `status` was decided.
 *   - "the commencement of the vacation proceedings" has no field of its
 *     own on this record. STEPHEN RULED, 2026-08-25, that commencement of
 *     the vacation proceedings and `noticeServedDate` ARE THE SAME DATE.
 *     THIS RESOLVES AN AMBIGUITY LEFT DELIBERATELY OPEN WHEN D-60 SHIPPED:
 *     `noticeServedDate`'s own JSDoc (src/types/navmc.ts) states plainly
 *     that no source in this codebase equates "commencement of proceedings"
 *     with the date Figure 14-1 was served, and that a future rule needing
 *     the commencement date "must state that assumption explicitly at its
 *     own call site; it must not read this field and treat it as already
 *     having done so." THIS IS THAT CALL SITE, and this paragraph is that
 *     statement: this rule reads `noticeServedDate` as the commencement
 *     date SOLELY because of the owner's determination recorded here, not
 *     because JAGMAN, the MCO, or any other published paragraph says so. A
 *     published paragraph equating the two, if one ever turns up, should
 *     replace this citation with it, the same posture V-31 takes toward its
 *     own SME-determined rule.
 *
 * THE OVERCOUNT PROBLEM, AND WHY THIS RULE STILL FIRES RATHER THAN GOING
 * SILENT. No working-day or federal-holiday helper exists anywhere in this
 * codebase. Counting Monday-through-Friday weekdays (`countWeekdaysAfter`
 * above) is the only date arithmetic available without one, and it
 * OVERCOUNTS working days whenever a federal holiday falls on a weekday
 * inside the span: that day is not a working day, but the weekday count
 * still includes it. So a weekday count over the 10-day limit does not, by
 * itself, prove the order was late; a holiday inside the window could fully
 * explain the excess and the order could in fact be timely.
 *
 * THIS RULE MUST NOT PRESENT THAT WEEKDAY COUNT AS AN AUTHORITATIVE
 * WORKING-DAY COUNT. This codebase's standing principle, stated by name on
 * a test in njp-suspension-period.ts ("an unreadable or empty period yields
 * null, never a false accusation from missing data"), is not only about
 * missing data: a computed number that can accuse a compliant commander of
 * being late on the strength of an approximation it cannot verify is the
 * same failure by another route. Two ways to honor that principle were
 * available: NAME THE LIMITATION IN THE MESSAGE, or REFUSE TO FIRE wherever
 * a holiday could explain the excess entirely. This rule takes the first.
 * The second would require guessing how many federal holidays could
 * plausibly fall inside a given span, and this codebase has no table and no
 * citation to support any such guess; inventing a threshold for that would
 * substitute one unfounded number for another, which is worse, not better,
 * than the number it replaces. Naming the limitation costs nothing the app
 * does not already know, and matches the established pattern for every
 * other conditional computed date in this codebase (W-17, W-20, W-21:
 * compute the number, name every unmodeled condition that could move it,
 * never suppress it and never assert it as certain). So this rule ALWAYS
 * COMPUTES the weekday count when both dates are readable, and its message
 * says PLAINLY, every time it fires, that the count excludes weekends only,
 * that the app holds no federal holiday table, and that a holiday inside
 * the window could mean the order was in fact timely.
 *
 * WHY 'warn' AND NOT 'block', per this rule's own spec row: the app has no
 * ability to un-issue a late order, and a block would trap a clerk
 * recording history truthfully. Same posture as `vacationRightsAdvisementIssues`
 * (W-18) immediately above, which cites this exact reasoning back at this
 * rule by name.
 *
 * EVALUATED ONLY WHEN BOTH DATES EXIST AND AN ORDER WAS ACTUALLY ISSUED.
 * JAGMAN 0118.d's ten-day clock is stated about "the order VACATING a
 * suspension", so this rule fires only for `status` `'vacated-full'` or
 * `'vacated-part'` — the two outcomes that mean an order vacating the
 * suspension actually issued. A `pending` record has no `outcomeDate`:
 * nothing has been decided yet, so there is no issued order to measure and
 * this rule stays silent, the same "unset while status is pending" contract
 * `outcomeDate` itself documents. A `not-vacated` record DOES carry an
 * `outcomeDate` (the date the commander decided, per that field's own
 * JSDoc), but the commander's decision there was NOT to vacate: there is no
 * "order vacating a suspension" to have been late, and firing this rule on
 * that record would accuse a commander of a late order over a decision that
 * was never an order to vacate at all, exactly the false accusation this
 * rule exists to avoid elsewhere. Every function in this module is pure and
 * none of them read the current time, so an open-ended wait, a pending
 * vacation already past ten working days with no decision yet, is not and
 * cannot be measured here; that is a UI concern (if any), never this
 * rule's.
 *
 * SILENT WHEN NOTHING HAS ELAPSED. `countWeekdaysAfter` returns 0 when
 * `outcomeDate` is on or before `noticeServedDate`, which can never exceed
 * the 10-day limit, so this rule never fires on that ordering. It asserts
 * nothing about whether that ordering is itself sound; that is a different
 * concern this rule does not check.
 *
 * THE ID IS KEYED ON EACH VACATION'S OWN POSITION in `vacations`, matching
 * every other vacation-record rule above, for the identical `key={issue.id}`
 * reason their own JSDocs give.
 */
export function vacationOrderDeadlineIssues(formData: FormData): ValidationIssue[] {
  return vacationEntries(formData).flatMap((vacation, index) => {
    if (vacation.status !== 'vacated-full' && vacation.status !== 'vacated-part') return [];

    const noticeServedDate = (vacation.noticeServedDate ?? '').trim();
    const outcomeDate = (vacation.outcomeDate ?? '').trim();
    if (noticeServedDate === '' || outcomeDate === '') return [];

    const weekdaysElapsed = countWeekdaysAfter(noticeServedDate, outcomeDate);
    if (weekdaysElapsed === null || weekdaysElapsed <= VACATION_ORDER_WORKING_DAY_LIMIT) return [];

    return [
      issue(
        `navmc10132-w19-vacation-order-late-${index}`,
        'warn',
        `Vacation record ${index}'s order issued ${weekdaysElapsed} weekdays after the notice ` +
          `was served on ${noticeServedDate}, more than the ${VACATION_ORDER_WORKING_DAY_LIMIT} ` +
          `working-day limit JAGMAN 0118.d allows.`,
        'JAGMAN (JAGINST 5800.7G CH-2) para 0118.d',
        'JAGMAN 0118.d requires the order vacating a suspension to issue within ' +
          `${VACATION_ORDER_WORKING_DAY_LIMIT} working days of the commencement of the ` +
          'vacation proceedings, which this app treats as the date the Figure 14-1 notice ' +
          'was served, per the owner\'s determination that the two dates are the same. This ' +
          'count excludes weekends only. The app holds no federal holiday table, so it cannot ' +
          'exclude holidays from the count, and a holiday inside this window would make the ' +
          'true number of working days lower than shown. This is not a confirmed violation. ' +
          'Confirm whether a federal holiday fell between the notice and the order before ' +
          'treating it as late.',
      ),
    ];
  });
}

/**
 * V-29 (blocker on the certain lower bound only). The offense or violation
 * that triggers a vacation must have been committed on or after the item 6
 * punishment date, i.e. during the period of suspension it is offered to
 * justify. Decision row D-49.
 *
 * MCO 5800.16 Vol 14 para 011201, verbatim: "Vacation of suspension may
 * only be based on an offense under the UCMJ committed during the period
 * of suspension." JAGMAN (JAGINST 5800.7G CH-2) para 0118.d words the SAME
 * window more broadly: it permits vacation on "a violation of the
 * conditions of suspension," which need not be a UCMJ offense at all. Both
 * sources word the WINDOW identically; they disagree only on the NATURE of
 * what may trigger a vacation inside it. Per D-49's ruling, this rule
 * tests the DATE WINDOW ONLY and never the nature of the basis: gating on
 * the narrower MCO test would block a lawful JAGMAN vacation this codebase
 * cannot tell apart from an unlawful one, since `offenceDate` records only
 * a date and `vacatedDetail` is free text this app does not parse.
 *
 * THE WINDOW HAS TWO ENDS, AND THEY ARE NOT EQUALLY CERTAIN — this is why
 * the rule below is asymmetric, and the asymmetry is deliberate, not an
 * oversight:
 *
 *   - The START, the item 6 `punishmentDate`, is fixed. Nothing in the MCM
 *     or the JAGMAN moves it: an offense committed on or before the
 *     punishment was imposed cannot possibly have occurred "during" a
 *     suspension that had not yet begun. That is provable from data this
 *     app holds, so a violation of it BLOCKS.
 *   - The END, `endsOnIfUninterrupted` (njp-suspension-period.ts), is a
 *     CONDITIONAL date, not a fixed one. See that module's own docstring
 *     and W-17's JSDoc above for the full argument: JAGMAN 0118.c
 *     interruptions can push the real end LATER, and MCM Part V para
 *     6.a(2)'s enlistment-expiry clause can pull it EARLIER, and this app
 *     has a field for none of the three. An offense dated after the
 *     computed end MIGHT still fall inside the real, tolled period.
 *     BLOCKING on that number would refuse a lawful vacation on a date the
 *     app cannot stand behind, the identical reasoning W-17 and W-20
 *     already apply to this exact computed date. That boundary is instead
 *     `vacationOffenceAfterRemissionIssues` (W-21) immediately below,
 *     advisory rather than blocking.
 *
 * SILENT, NOT BLOCKING OR WARNING, in every case below, each either owned
 * by another rule or simply lacking a fact to test:
 *   - `offenceDate` unset: nothing recorded yet to test. Ordinary state for
 *     a record predating this field, same posture as
 *     `article31RightsReadDate` before W-18.
 *   - `suspensionIndex` out of bounds: V-33's finding on the record's
 *     target, not this rule's. Two rules complaining about one bad index
 *     trains people to tune out one of them.
 *   - the targeted suspension's period cannot be computed at all (an
 *     unreadable item 7 period, or an unreadable `punishmentDate`):
 *     `suspensionsWithComputedEnd` already excludes those, and
 *     `suspensionTermsIssues` (V-05) or its addendum already has, or will
 *     have, something to say about item 7 in that state.
 *
 * THE ID IS KEYED ON THE VACATION'S OWN POSITION in `vacations`, matching
 * V-32 through V-34 and W-18 above, for the identical `key={issue.id}`
 * reason their own JSDocs give.
 */
export function vacationOffenceWindowIssues(formData: FormData): ValidationIssue[] {
  const byIndex = new Map(
    suspensionsWithComputedEnd(formData).map((period) => [period.suspensionIndex, period]),
  );
  const punishmentDate =
    (typeof formData.punishmentDate === 'string' ? formData.punishmentDate : '').trim();
  const issues: ValidationIssue[] = [];

  vacationEntries(formData).forEach((vacation, index) => {
    const period = byIndex.get(vacation.suspensionIndex);
    if (!period) return; // out of bounds (V-33) or period unreadable (V-05)

    const offenceDate = (vacation.offenceDate ?? '').trim();
    if (offenceDate === '' || punishmentDate === '') return; // nothing recorded yet to test

    if (offenceDate <= punishmentDate) {
      issues.push(
        issue(
          `navmc10132-v29-vacation-offence-before-suspension-${index}`,
          'block',
          `Vacation record ${index}'s triggering offence is dated ${offenceDate}, on or before ` +
            `the item 6 punishment date of ${punishmentDate}.`,
          'MCO 5800.16 Vol 14 para 011201; JAGMAN (JAGINST 5800.7G CH-2) para 0118.d',
          'Vacation may only be based on conduct committed during the period of suspension, ' +
            `which begins on the item 6 punishment date. An offence dated ${offenceDate}, on ` +
            `or before ${punishmentDate}, cannot have occurred during a suspension that had ` +
            'not yet begun. Correct the offence date, or confirm this vacation record ' +
            'targets the right suspension.',
        ),
      );
    }
  });

  return issues;
}

/**
 * W-21 (ADVISORY, NOT A BLOCKER — read V-29's JSDoc above before touching
 * the severity; the same asymmetric-window argument applies here, and W-17
 * and W-20 make the identical case for the identical computed date).
 *
 * `endsOnIfUninterrupted` is conditional, not certain: JAGMAN 0118.c
 * interruptions can push the real suspension end LATER, and MCM Part V
 * para 6.a(2)'s enlistment-expiry clause can pull it EARLIER, and this app
 * has a field for none of the three. V-29 above already blocks on the one
 * boundary this app CAN stand behind — an offence cannot precede the
 * suspension's own start. This rule covers the boundary the app CANNOT
 * stand behind: an offence dated after the computed remission date MIGHT
 * still have occurred during the real, tolled suspension period, and
 * blocking on it would refuse a lawful vacation on a number the app cannot
 * prove, exactly the failure D-51 exists to prevent.
 *
 * SILENT under the identical conditions V-29 is silent under: an unset
 * `offenceDate`, an out-of-bounds `suspensionIndex` (V-33's job), or an
 * unreadable suspension period (`suspensionsWithComputedEnd` already
 * excludes those).
 *
 * THE ID IS KEYED ON THE VACATION'S OWN POSITION, matching V-29 and its
 * siblings above.
 */
export function vacationOffenceAfterRemissionIssues(formData: FormData): ValidationIssue[] {
  const byIndex = new Map(
    suspensionsWithComputedEnd(formData).map((period) => [period.suspensionIndex, period]),
  );

  return vacationEntries(formData).flatMap((vacation, index) => {
    const period = byIndex.get(vacation.suspensionIndex);
    if (!period) return [];

    const offenceDate = (vacation.offenceDate ?? '').trim();
    if (offenceDate === '' || offenceDate <= period.endsOnIfUninterrupted) return [];

    return [
      issue(
        `navmc10132-w21-vacation-offence-after-remission-${index}`,
        'warn',
        `Vacation record ${index}'s triggering offence is dated ${offenceDate}, after the ` +
          `computed suspension end date of ${period.endsOnIfUninterrupted}.`,
        'MCM Part V para 6.a(2)-(3); JAGMAN (JAGINST 5800.7G CH-2) para 0118.c',
        `Unless interrupted or terminated first, the suspension of ` +
          `${period.code || 'the item 6 punishment'} is remitted without further action on ` +
          `${period.endsOnIfUninterrupted}, and conduct committed after that date would fall ` +
          'outside the suspension period it is offered to justify vacating. This computed ' +
          'date is conditional, not certain: unauthorized absence, a vacation proceeding ' +
          'already underway, or an earlier expiration of the current enlistment can each ' +
          'change the real end date. Confirm which applies before treating this offence as ' +
          'outside the suspension.',
      ),
    ];
  });
}

/**
 * V-30 (blocker for a FULL vacation only). The vacating authority must be
 * competent for the kind and amount of punishment actually vacated.
 * Decision row D-56.
 *
 * MCO 5800.16 Vol 14 para 011201, verbatim: "A suspended NJP may be
 * vacated by any commander authorized to impose upon the accused
 * punishment of the kind and amount to be vacated." Two consequences,
 * both from D-56's own reasoning:
 *
 * FIRST: the vacating commander is NOT necessarily the imposing
 * commander, so item 8A (`njpAuthorityGrade` / `njpAuthorityPayGrade`) is
 * the WRONG source. This rule reads `vacatingAuthorityGrade`, recorded on
 * the vacation record itself, and never item 8A. JAGMAN (JAGINST 5800.7G
 * CH-2) para 0118.a defines "successor in command" by reference to U.S.
 * Navy Regulation 1026 and expressly does not limit it to the next
 * succeeding officer, which is why this is a free-text grade recorded per
 * vacation rather than a pick from a chain of command this app can derive.
 *
 * SECOND: "kind and amount" is a COMPUTABLE predicate. This rule reuses
 * the identical `authoritySatisfies` check `punishmentAuthorityGradeIssues`
 * (W-05) already runs against item 8A and the code's own
 * `requiredAuthority`, applied here to the vacating authority instead of
 * the imposing one.
 *
 * THE BOUNDARY THIS RULE DOES NOT CROSS, AND MUST NOT BE MADE TO CROSS.
 * "The kind and amount TO BE VACATED" is not always the whole punishment.
 * For a `'vacated-part'` record, `vacatedDetail` names what was actually
 * vacated as FREE TEXT, and this codebase has no parser that turns free
 * text into a legal figure or a punishment code — nothing here or
 * elsewhere may add one as a shortcut. So this rule can check a FULL
 * vacation against the suspended punishment's OWN requirement, because a
 * full vacation names the whole thing unambiguously through
 * `suspensionIndex`, and it CANNOT check a PARTIAL vacation at all:
 * checking the whole punishment's requirement as a stand-in for a
 * fraction of it would refuse a lawful partial vacation by a commander
 * competent for the part actually vacated but not for the whole. THIS
 * RULE IS THEREFORE SILENT ON `status === 'vacated-part'`, deliberately,
 * not an oversight, and no future edit should "improve" this by checking
 * the whole punishment there as a proxy.
 *
 * SEVERITY SPLIT ON `authoritySatisfies`'s THREE OUTCOMES, mirroring W-05
 * exactly:
 *   - true: the recorded grade meets the code's required authority. No
 *     issue.
 *   - false: the recorded grade is PROVABLY below the code's required
 *     authority. BLOCK — a commander with no authority to impose a
 *     punishment vacating it anyway is exactly what MCO 011201's sentence
 *     exists to prevent, and this is something the app CAN prove.
 *   - 'unknown': `vacatingAuthorityGrade` is unset, unparseable, or the
 *     code requires GCMCA authority, a billet question unanswerable from a
 *     pay grade alone. This rule does NOT fire for 'unknown' — see
 *     `vacatingAuthorityUnknownIssues` (W-22) immediately below, which
 *     surfaces it as an advisory instead of leaving it silent, so an
 *     unrecorded grade cannot pass this check by omission.
 *
 * SILENT on an out-of-bounds `suspensionIndex` (V-33's job), a suspension
 * whose `punishmentIndex` is out of bounds (the V-05 addendum's job), or
 * an unresolvable punishment code (V-14 and upstream code selection own
 * that).
 *
 * THE ID IS KEYED ON THE VACATION'S OWN POSITION, matching its siblings
 * above.
 */
export function vacatingAuthorityInsufficientIssues(formData: FormData): ValidationIssue[] {
  const suspensions = suspensionEntries(formData);
  const punishments = punishmentEntries(formData);
  const issues: ValidationIssue[] = [];

  vacationEntries(formData).forEach((vacation, index) => {
    if (vacation.status !== 'vacated-full') return; // V-30's own boundary; see JSDoc

    const suspension = suspensions[vacation.suspensionIndex];
    if (!suspension) return; // V-33's job

    const punishment = punishments[suspension.punishmentIndex];
    if (!punishment) return; // suspensionIndexBoundsIssues' (V-05 addendum) job

    const code = resolvePunishment(punishment.code);
    if (!code) return; // V-14 and upstream code selection own an unresolvable code
    if (code.requiredAuthority === 'any') return;

    const grade = (vacation.vacatingAuthorityGrade ?? '').trim();
    const result = authoritySatisfies(code.requiredAuthority, grade);
    if (result !== false) return;

    issues.push(
      issue(
        `navmc10132-v30-vacation-authority-insufficient-${index}`,
        'block',
        `Vacation record ${index} vacates ${punishment.code} in full, which requires ` +
          'field-grade authority, and the recorded vacating authority does not satisfy it.',
        'MCO 5800.16 Vol 14 para 011201; 10 U.S.C. 815(b)(2)(H); MCO 5800.16 Vol 14 para 010303',
        `The vacating authority grade recorded for this vacation is "${grade}," below the ` +
          `grade required to impose ${punishment.code} (${code.description}). A suspended ` +
          'punishment may only be vacated by a commander authorized to impose punishment of ' +
          'the same kind and amount. Confirm the vacating authority\'s actual grade, or route ' +
          'this vacation to a commander who holds the required authority.',
      ),
    );
  });

  return issues;
}

/**
 * W-22 (ADVISORY, NOT A BLOCKER). A FULL vacation's `vacatingAuthorityGrade`
 * cannot establish whether the vacating authority is competent for the
 * kind and amount vacated: it is unset, unparseable, or the punishment
 * requires GCMCA authority, a billet question `authoritySatisfies` cannot
 * answer from a pay grade alone. Mirrors `punishmentAuthorityGradeIssues`
 * (W-05)'s identical 'unknown' branch, applied to the vacating authority
 * instead of the imposing one. Decision row D-56.
 *
 * WHY 'warn' AND NOT SILENCE. `vacatingAuthorityGrade` is a NEW field with
 * no printed line on the form and no existing writer, so unset is the
 * ordinary state for most records today, the same posture
 * `article31RightsReadDate` had before W-18 gave it one. Leaving this
 * wholly silent would let a full vacation with an unrecorded, unverifiable
 * vacating authority pass every check this codebase runs, silently, which
 * is worse than naming the gap. This warning is what makes the field
 * actionable: enter a grade `authoritySatisfies` can read, and this stops
 * firing (or V-30 blocks instead, if the grade turns out insufficient).
 *
 * SILENT on a `status === 'vacated-part'` record for the identical reason
 * V-30 is silent there: the app cannot compute a requirement for a
 * fraction of a punishment named only in free text, so it cannot say the
 * requirement is merely "unknown" either — there is no requirement this
 * rule can state in the first place. See V-30's own JSDoc for the full
 * argument; it applies here without modification.
 */
export function vacatingAuthorityUnknownIssues(formData: FormData): ValidationIssue[] {
  const suspensions = suspensionEntries(formData);
  const punishments = punishmentEntries(formData);
  const issues: ValidationIssue[] = [];

  vacationEntries(formData).forEach((vacation, index) => {
    if (vacation.status !== 'vacated-full') return; // matches V-30's own boundary

    const suspension = suspensions[vacation.suspensionIndex];
    if (!suspension) return;

    const punishment = punishments[suspension.punishmentIndex];
    if (!punishment) return;

    const code = resolvePunishment(punishment.code);
    if (!code) return;
    if (code.requiredAuthority === 'any') return;

    const grade = (vacation.vacatingAuthorityGrade ?? '').trim();
    const result = authoritySatisfies(code.requiredAuthority, grade);
    if (result !== 'unknown') return;

    issues.push(
      issue(
        `navmc10132-w22-vacation-authority-unknown-${index}`,
        'warn',
        `Cannot determine whether the vacating authority for vacation record ${index} is ` +
          `competent to vacate ${punishment.code} in full.`,
        'MCO 5800.16 Vol 14 para 011201; 10 U.S.C. 815(b)(2)(H)',
        `Either the vacating authority grade is not recorded, or ${punishment.code} requires ` +
          'GCMCA authority, a billet question the app cannot answer from a pay grade alone. ' +
          `Confirm by hand that the commander vacating this punishment actually holds ` +
          `authority to impose ${punishment.code} (${code.description}).`,
      ),
    );
  });

  return issues;
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
 * first (V-04, V-05, V-31, V-14, V-15, V-16), then the advisory and blocker
 * rules reading the individual codes (W-05 through W-08). W-06 is a blocker
 * despite sitting among the W-numbered rules, see its own JSDoc. V-31 sits
 * beside V-05 because it is the same suspensions array, not because it
 * shares V-05's spec paragraph — it has none, see its own JSDoc. V-32 and
 * V-33 sit beside V-31 for the identical reason, one level up: they read
 * the vacations array added for decision row D-60, not a spec paragraph
 * either. V-34 sits immediately beside V-32 and V-33, blockers first, for
 * the same reason: it is the third rule checking that array's own
 * consistency, found while closing W-18. W-20 sits beside W-17 because it
 * shares W-17's conditional-date source (njp-suspension-period.ts),
 * applied to a vacation's notice date instead of the suspension's own end
 * date. W-18 sits last, beside W-20, because it reads the same vacations
 * array over a different pair of dates (decision row D-54). V-29, W-21,
 * V-30 and W-22 sit last of all: V-29/W-21 read the vacations array
 * against `offenceDate` and the same conditional end date W-17/W-20
 * already read (decision row D-49), and V-30/W-22 read it against
 * `vacatingAuthorityGrade` and the punishment's own required authority
 * (decision row D-56). W-19 (`vacationOrderDeadlineIssues`, decision row
 * D-52) sits last of all, immediately after W-18: it reads the same
 * `vacations` array over `noticeServedDate` and `outcomeDate`, and per the
 * owner's 2026-08-25 ruling documented on that function, treats the former
 * as the commencement date JAGMAN 0118.d's ten-working-day clock runs from.
 */
export function punishmentIssues(formData: FormData): ValidationIssue[] {
  return [
    ...punishmentPresenceIssues(formData),
    ...suspensionTermsIssues(formData),
    ...suspensionIndexBoundsIssues(formData),
    ...suspensionDuplicateTargetIssues(formData),
    ...vacationPartialDetailIssues(formData),
    ...vacationSuspensionIndexBoundsIssues(formData),
    ...vacationRemarkMissingIssues(formData),
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
    ...suspensionInterruptionAssumptionIssues(formData),
    ...vacationNoticeAfterRemissionIssues(formData),
    ...vacationRightsAdvisementIssues(formData),
    ...vacationOrderDeadlineIssues(formData),
    ...vacationOffenceWindowIssues(formData),
    ...vacationOffenceAfterRemissionIssues(formData),
    ...vacatingAuthorityInsufficientIssues(formData),
    ...vacatingAuthorityUnknownIssues(formData),
  ];
}
