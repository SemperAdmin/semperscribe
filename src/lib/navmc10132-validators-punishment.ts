/**
 * NAVMC 10132 item 6/7/14 punishment validators.
 *
 * Covers the punishment-side blockers and warnings from docs/NAVMC_10132_SPEC.md
 * section 6: V-04, V-05 (plus its suspensionIndexBoundsIssues addendum), V-14,
 * V-15, V-16, V-17, V-18, V-19, V-20, V-21, V-22, W-05, W-06, W-07, W-08, W-17.
 * KEEP THIS LIST ACCURATE: it undercounted V-17 through V-22 and W-17 for a
 * time, which is how a file can carry a rule nobody reading only the header
 * would know to look for. All other rules in section 6 (offense/finding
 * rules, date ordering, capacity rules outside item 6, accused identity,
 * unit, EDIPI) live in sibling modules.
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
 * either. W-20 sits beside W-17 because it shares W-17's conditional-date
 * source (njp-suspension-period.ts), applied to a vacation's notice date
 * instead of the suspension's own end date.
 */
export function punishmentIssues(formData: FormData): ValidationIssue[] {
  return [
    ...punishmentPresenceIssues(formData),
    ...suspensionTermsIssues(formData),
    ...suspensionIndexBoundsIssues(formData),
    ...suspensionDuplicateTargetIssues(formData),
    ...vacationPartialDetailIssues(formData),
    ...vacationSuspensionIndexBoundsIssues(formData),
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
  ];
}
