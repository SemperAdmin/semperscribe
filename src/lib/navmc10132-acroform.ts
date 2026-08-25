/**
 * NAVMC 10132 (Unit Punishment Book) value-selector table.
 *
 * Turns the app's Navmc10132Data (held inside the loosely typed FormData
 * state object) into the exact AcroForm field values the export engine
 * writes with pdf-lib. This module owns SELECTION and DERIVATION ORDER
 * only. It knows nothing about pdf-lib, dropdown two-step writes, RichText,
 * or read-only unlocking, that is the fill engine's job (see
 * /tmp/ctx/export-integration.md). What it must get right is: which field
 * gets which value, and that the three Phase 2 derivations run BEFORE the
 * table is read, never after.
 *
 * Field names below are copied byte exact from navmc10132-map.json,
 * including the double space inside every article label and the doubled
 * space in names like "8 NJP AUTHORITY NAME TITLE SERVICE" where present
 * in the map. Do not "clean up" a field name, the AcroForm will not
 * resolve it.
 */

import type { FormData } from '@/types';
import {
  bookerStatement,
  coerceDemand,
  renderPunishment,
  Navmc10132PunishmentRenderError,
  resolvePunishment,
  renderSuspension,
  Navmc10132SuspensionRenderError,
  composeRemarks,
} from '@/lib/navmc10132-utils';
import type {
  Navmc10132PunishmentEntry,
  Navmc10132Remark,
  Navmc10132Suspension,
  Navmc10132Vacation,
} from '@/types/navmc';

/** What one AcroForm field accepts: text/dropdown export value, or a
 * checkbox state. `undefined` is never written by the caller, it means
 * "field omitted from the returned record". */
type FieldValue = string | boolean | undefined;

/** The row letters the form actually prints for items 1, 5 and 22. */
const ROW_LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

// ---------------------------------------------------------------------------
// Narrowing accessors.
//
// FormData is `{ documentType: string; [key: string]: any }`. Indexing it
// already types as `any`, which is exactly the trap: an inline cast like
// `(formData.offenses as Navmc10132Offense[])` compiles but proves nothing,
// and casting the WHOLE object like `(formData as Navmc10132Data)` is a
// TS2352 (the two types do not sufficiently overlap, FormData carries
// `documentType` and arbitrary extra keys the model does not, and every
// property loses precision through `any`). So every read below assigns the
// indexed value into an `unknown`-typed binding first (an `any` value can
// always widen to `unknown`, no cast token needed) and narrows from there
// with a runtime check. This also means a stale draft or a bad template
// import degrades to "field omitted" instead of a thrown TypeError.
// ---------------------------------------------------------------------------

function readUnknown(formData: FormData, key: string): unknown {
  const value: unknown = formData[key];
  return value;
}

function readString(formData: FormData, key: string): string | undefined {
  const value = readUnknown(formData, key);
  return typeof value === 'string' ? value : undefined;
}

function readBoolean(formData: FormData, key: string): boolean | undefined {
  const value = readUnknown(formData, key);
  return typeof value === 'boolean' ? value : undefined;
}

function readRows(formData: FormData, key: string): unknown[] {
  const value = readUnknown(formData, key);
  return Array.isArray(value) ? value : [];
}

/** Reads one string property off an array element without ever asserting
 * the element is a shaped row type. `row` stays `unknown` until the exact
 * property is confirmed to be a string. */
function stringField(row: unknown, key: string): string | undefined {
  if (typeof row !== 'object' || row === null) return undefined;
  const value: unknown = (row as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}

/** Item 5 stores the finding as its EXPORT value already ('Guilty' /
 * 'Not Guilty'), never the displayed abbreviation. A stale draft or a
 * hand-edited FormData slice could still carry 'G' or 'NG' from an older
 * shape, so this only ever passes through the two real export strings and
 * drops anything else rather than ever emitting the abbreviation. */
function toFindingExportValue(raw: string | undefined): string | undefined {
  return raw === 'Guilty' || raw === 'Not Guilty' ? raw : undefined;
}

/** Reads `formData.punishments` as Navmc10132PunishmentEntry[]. The array
 * membership is checked at runtime; individual entry shape is trusted to
 * renderPunishment, which is the Phase 2 engine's job to validate, not
 * this table's. The cast goes through the `unknown` already produced by
 * readUnknown, never straight off the `any`-typed property access. */
function readPunishments(formData: FormData): Navmc10132PunishmentEntry[] {
  const value = readUnknown(formData, 'punishments');
  return Array.isArray(value) ? (value as Navmc10132PunishmentEntry[]) : [];
}

function readRemarks(formData: FormData): Navmc10132Remark[] {
  const value = readUnknown(formData, 'remarks');
  return Array.isArray(value) ? (value as Navmc10132Remark[]) : [];
}

/** Reads `formData.suspensions` as Navmc10132Suspension[]. Same runtime-checked
 * pattern as readPunishments and readRemarks above. */
function readSuspensions(formData: FormData): Navmc10132Suspension[] {
  const value = readUnknown(formData, 'suspensions');
  return Array.isArray(value) ? (value as Navmc10132Suspension[]) : [];
}

/** Reads `formData.vacations` as Navmc10132Vacation[]. Same runtime-checked
 * pattern as readPunishments, readRemarks and readSuspensions above.
 * Decision row D-60. */
function readVacations(formData: FormData): Navmc10132Vacation[] {
  const value = readUnknown(formData, 'vacations');
  return Array.isArray(value) ? (value as Navmc10132Vacation[]) : [];
}

// ---------------------------------------------------------------------------
// Item 6 punishment text, with the overflow escape hatch checked FIRST so a
// flagged-overflow row never even reaches renderPunishment.
// ---------------------------------------------------------------------------

/** MCO 5800.16 Vol 14 para 011103's own combination example (160 characters
 * against item 6's 123-character field) is why this escape hatch exists.
 * The literal string below is what the paragraph prescribes writing into
 * item 6 once the full punishment text has overflowed into item 21. */
const PUNISHMENT_OVERFLOW_LITERAL = 'See Supplemental Page';

function computePunishmentImposed(formData: FormData): string | undefined {
  if (readBoolean(formData, 'punishmentOverflowToItem21') === true) {
    return PUNISHMENT_OVERFLOW_LITERAL;
  }
  return rawPunishmentImposed(formData);
}

function rawPunishmentImposed(formData: FormData): string | undefined {
  const punishments = readPunishments(formData);
  if (punishments.length === 0) return undefined;
  // Concurrency is a property of the SET of punishments, not of any one code,
  // because MCM Part V para 5.d governs how punishments combine. It lives on
  // the model as punishmentsConcurrent and is written by PunishmentSection.
  const concurrent = readBoolean(formData, 'punishmentsConcurrent') ?? false;
  // renderPunishment THROWS on an incomplete entry, a forfeiture with no
  // amount for instance. That is normal mid-entry state, not a bug, and the
  // live preview calls this path on a timer. Letting it escape would collapse
  // the whole preview to the fallback notice page while the user is still
  // typing. Item 6 is omitted instead, so every other field keeps filling.
  // Anything that is not a render error is a real defect and still escapes.
  let rendered: { text: string; length: number };
  try {
    rendered = renderPunishment(punishments, { concurrent });
  } catch (err) {
    if (err instanceof Navmc10132PunishmentRenderError) return undefined;
    throw err;
  }
  return rendered.text || undefined;
}

/**
 * Derives item 7 ("SUSPENSION IF ANY") through renderSuspension, the same
 * relationship computePunishmentImposed has to renderPunishment above.
 *
 * renderSuspension THROWS Navmc10132SuspensionRenderError on a dangling
 * punishmentIndex or a suspension missing its period. Both are normal
 * mid-edit state, not a bug, and this runs on the live preview's timer.
 * Letting either escape would collapse the whole preview to the fallback
 * notice page while the user is still typing, so item 7 is omitted instead,
 * the same guard computePunishmentImposed applies to item 6. Any error
 * other than a render error is a real defect and still escapes.
 */
function rawSuspension(
  formData: FormData,
  options?: { withDate?: boolean },
): string | undefined {
  const suspensions = readSuspensions(formData);
  const punishments = readPunishments(formData);
  const impositionDate = options?.withDate === false
    ? undefined
    : readString(formData, 'punishmentDate');

  let rendered: { text: string; length: number };
  try {
    rendered = renderSuspension(suspensions, punishments, { impositionDate });
  } catch (err) {
    if (err instanceof Navmc10132SuspensionRenderError) return undefined;
    throw err;
  }
  return rendered.text || undefined;
}

function computeSuspension(formData: FormData): string | undefined {
  // Item 7 is a SINGLE LINE field and clips rather than wrapping. Once the
  // rendered text passes the field, printing it anyway loses the tail with
  // nothing on the page to show it, so the field carries the continuation
  // literal and the full text moves to item 21. Mirrors item 6 exactly.
  if (readBoolean(formData, 'suspensionOverflowToItem21') === true) {
    return PUNISHMENT_OVERFLOW_LITERAL;
  }
  return rawSuspension(formData);
}

/**
 * The item 21 continuation entries for items 6 and 7.
 *
 * Without these the overflow escape hatch DESTROYS text: item 6 would print
 * "See Supplemental Page" while item 21 stayed empty, so the punishment
 * would exist nowhere on the form. The supplemental page has to actually
 * carry the supplement.
 *
 * The text is rendered WITHOUT its own date prefix, because the item 21 line
 * already opens with the date the page 3 instruction prescribes. Printing
 * both would date the entry twice.
 */
function overflowRemarks(formData: FormData): Navmc10132Remark[] {
  const date = readString(formData, 'punishmentDate') ?? '';
  const carried: Navmc10132Remark[] = [];

  if (readBoolean(formData, 'punishmentOverflowToItem21') === true) {
    const full = rawPunishmentImposed(formData);
    if (full) carried.push({ date, kind: 'item6-overflow', detail: full });
  }

  if (readBoolean(formData, 'suspensionOverflowToItem21') === true) {
    const full = rawSuspension(formData, { withDate: false });
    if (full) carried.push({ date, kind: 'item7-overflow', detail: full });
  }

  return carried;
}

/**
 * The punishment text a vacated suspension's target names, for the
 * vacation remark's "<punishment> susp on <NJP date>" clause.
 *
 * MIRRORS `suspendedPunishmentText` in njp-vacation-handoff.ts rather than
 * importing it: that function is module-local there, and this table's own
 * header restricts it to SELECTION and DERIVATION ORDER over the same
 * runtime-checked accessor pattern already used above, not a dependency on
 * the letter-generation module. renderPunishment THROWS on an incomplete
 * entry, which is normal mid-edit state, so the fallback is the code's own
 * description rather than an empty string — an empty target would leave
 * the derived remark reading "susp on ..." with nothing named as vacated.
 */
function vacationTargetText(formData: FormData, punishmentIndex: number): string {
  const entry = readPunishments(formData)[punishmentIndex];
  if (!entry) return '';
  const code = resolvePunishment(entry.code);
  if (!code) return '';
  try {
    return renderPunishment([entry]).text;
  } catch {
    return code.description;
  }
}

/**
 * Derives the item 21 `suspension-vacated-njp` remark for every EXECUTED
 * vacation record. Decision row D-60: this is what closes the gap between
 * njp-vacation-handoff.ts (which generates the Figure 14-1 notice) and
 * navmc10132-remarks.ts (which carries the remark kind that records the
 * vacation) — a vacation now reaches item 21 without a clerk having to
 * remember to hand-add it.
 *
 * SILENT ON 'pending' AND 'not-vacated', ON PURPOSE. Nothing was vacated in
 * either state: MCO 5800.16 Vol 14 para 011201 requires the accused be
 * given an opportunity to respond before a suspension may be vacated, and
 * Figure 14-1 paragraph 2 offers FULL/PART as the commander's election
 * only after that response, so a commander can also decide not to vacate.
 * A remark reading "... vacated." for a record that vacated nothing would
 * misstate the UPB. This is also why nothing here warns on the ABSENCE of
 * a vacation record: most suspensions are never vacated at all (MCM Part V
 * para 6.a(3), remitted without further action), so a rule that fired on
 * every un-vacated suspension would fire constantly on correct forms.
 *
 * SKIPPED, NOT EMITTED MALFORMED, when the NJP date, the outcome date, the
 * targeted suspension, or the punishment it names is missing or
 * unresolvable. isPrescribedFormat (navmc10132-remarks.ts) requires this
 * remark's line to open with a YYYY-MM-DD date and to contain a "susp on"
 * clause; a derived remark that fails the app's own format check would be
 * worse than none, so an incomplete record is left for the clerk to finish
 * rather than rendered with a hole in it. `navmc10132-v32-` and
 * `navmc10132-v33-` (navmc10132-validators-punishment.ts) block export on
 * the two incompleteness shapes this function would otherwise silently
 * drop.
 *
 * THE REMARK'S OWN DATE IS `outcomeDate`, NEVER `noticeServedDate`. The
 * remark records that a vacation HAPPENED, so it is dated by when the
 * vacating decision was made, not by when the notice that preceded it went
 * out — matching how every other item 21 kind here is dated by its own
 * event (`appeal-denied` by the decision date, not the appeal date).
 */
function vacationRemarks(formData: FormData): Navmc10132Remark[] {
  const njpDate = (readString(formData, 'punishmentDate') ?? '').trim();
  if (njpDate === '') return [];

  const suspensions = readSuspensions(formData);

  return readVacations(formData).flatMap((vacation): Navmc10132Remark[] => {
    if (vacation.status !== 'vacated-full' && vacation.status !== 'vacated-part') return [];

    const outcomeDate = (vacation.outcomeDate ?? '').trim();
    if (outcomeDate === '') return [];

    const suspension = suspensions[vacation.suspensionIndex];
    if (!suspension) return [];

    const target = vacationTargetText(formData, suspension.punishmentIndex);
    if (target === '') return [];

    const base = `${target} susp on ${njpDate}`;
    const vacatedDetail = (vacation.vacatedDetail ?? '').trim();
    const detail =
      vacation.status === 'vacated-part' && vacatedDetail !== ''
        ? `${base}, in part: ${vacatedDetail}`
        : base;

    return [{ date: outcomeDate, kind: 'suspension-vacated-njp', detail }];
  });
}

/**
 * Builds the AcroForm field-name to value table for NAVMC 10132.
 *
 * Order matters here in the same way it matters in the fill engine: the
 * Phase 2 derivations (coerceDemand, bookerStatement, renderPunishment by way
 * of computePunishmentImposed, renderSuspension by way of computeSuspension,
 * composeRemarks) are evaluated as this function runs, BEFORE any caller
 * reads the returned record. A caller that
 * tried to read the raw stored `demand` or `bookerStatement` fields instead
 * of this table's output would reproduce exactly the bug this table exists
 * to prevent, see the `2 DEMAND` and `2 BOOKER` entries below.
 *
 * Undefined or empty-string values are never written to the returned
 * record. That omission is load-bearing for the caller: it is how "this
 * field was never set" stays distinguishable from "this field was set to
 * blank".
 */
export function navmc10132Values(formData: FormData): Record<string, FieldValue> {
  const table: Record<string, FieldValue> = {};

  const set = (name: string, value: FieldValue): void => {
    if (value === undefined || value === '') return;
    table[name] = value;
  };

  // --- Items 17-20: unit and accused identity -------------------------
  const accusedName = readString(formData, 'accusedName');
  const accusedRankGrade = readString(formData, 'accusedRankGrade');
  const accusedEdipi = readString(formData, 'accusedEdipi');

  set('17 UNIT', readString(formData, 'unit'));
  set('18 ACCUSED FULL NAME', accusedName);
  set('19 ACCUSED RANK/GRADE', accusedRankGrade);
  set('20 ACCUSED EDIPI', accusedEdipi);

  // --- Items 23-25: page 2's copy of the accused identity -------------
  // The form fills these with calculate JavaScript keyed off items 18-20
  // (see the map's top-level `calculationOrder`). pdf-lib runs no
  // JavaScript, so without writing 23-25 here directly, page 2 of the UPB
  // ships with no accused name, rank, or EDIPI on it at all, violating
  // MCO 5800.16 Vol 14 para 011103. Same source values as 18-20, written a
  // second time under their own field names.
  set('23 ACCUSED FULL NAME', accusedName);
  set('24 ACCUSED RANK/GRADE', accusedRankGrade);
  set('25 ACCUSED EDIPI', accusedEdipi);

  // --- Item 1 and item 5: up to five offense rows ----------------------
  const offenseRows = readRows(formData, 'offenses');
  ROW_LETTERS.forEach((letter, index) => {
    const offense = offenseRows[index];
    set(`1${letter} ARTICLE`, stringField(offense, 'articleLabel'));
    set(`1${letter} SUMMARY`, stringField(offense, 'summary'));
    set(`1${letter} FINDING`, toFindingExportValue(stringField(offense, 'finding')));
  });

  // --- Item 2: accused election ----------------------------------------
  // `2 DEMAND` and `2 BOOKER` both need the same coerced demand string.
  // Computed once, used by both, so the coupling can never drift between
  // the two fields the way it would if each recomputed it independently.
  const rawDemand = readString(formData, 'demand') ?? '';
  const accusedRefusedToSign = readBoolean(formData, 'accusedRefusedToSign') ?? false;
  const coercedDemand = coerceDemand(rawDemand, accusedRefusedToSign);
  const counselOpportunity = readString(formData, 'counselOpportunity') ?? '';

  // The form's own on-blur script performs this exact coupling: a refusal
  // to sign silently rewrites an "accept" demand into a "refuse" demand
  // before anything is stored. Writing the raw stored `demand` here would
  // desynchronize the printed election from what the accused actually did.
  set('2 DEMAND', coercedDemand);
  set('2 COUNSELOPP', readString(formData, 'counselOpportunity'));
  set('2 ACC REFUSE TO SIGN', readBoolean(formData, 'accusedRefusedToSign'));
  set('2 ACC ELECTION AND RIGHTS DATE_af_date', readString(formData, 'electionDate'));

  // `2 BOOKER` is NEVER the stored `bookerStatement` value. The blank form
  // ships with the ACCEPTANCE sentence already sitting in that field's /V,
  // and the form only ever rewrites it through on-blur JavaScript pdf-lib
  // does not run. Skipping this derivation, or writing the raw stored
  // value, ships a UPB that states the accused accepted NJP even in a
  // refusal case.
  set('2 BOOKER', bookerStatement(coercedDemand, counselOpportunity, accusedRefusedToSign));

  // --- Item 3: CO certification of rights -------------------------------
  set('3 RIGHTS ATTEST DATE_af_date', readString(formData, 'rightsAttestDate'));

  // --- Item 4: unauthorized absence and marks of desertion -------------
  set(
    '4 CURRENT UAS OVER 24 HRS AND MARKS OF DESERTION',
    readString(formData, 'unauthorizedAbsences'),
  );

  // --- Items 6-7: punishment ---------------------------------------------
  set('6 PUNISHMENT IMPOSED', computePunishmentImposed(formData));
  set('6 PUNISHMENT IMPOSITION DATE', readString(formData, 'punishmentDate'));
  // Derived through renderSuspension, the same relationship item 6 has to
  // renderPunishment via computePunishmentImposed above. Reading the raw
  // stored `suspension` string here would let item 7 print a suspension for
  // a punishment item 6 no longer carries, exactly the defect this fix
  // exists to close.
  set('7 SUSPENSION IF ANY', computeSuspension(formData));

  // --- Item 8: NJP authority ---------------------------------------------
  set('8 NJP AUTHORITY NAME TITLE SERVICE', readString(formData, 'njpAuthorityName'));
  set('8A NJP AUTHORITY GRADE', readString(formData, 'njpAuthorityGrade'));
  set('8B NJP AUTHORITY EDIPI', readString(formData, 'njpAuthorityEdipi'));

  // --- Items 10-15: notice and appeal ------------------------------------
  set('10 DATE OF DISPOSITION NOTICE', readString(formData, 'dispositionNoticeDate'));
  set('11 APPEAL ADVISEMENT DATE_af_date', readString(formData, 'appealAdvisementDate'));
  set('12 INTEND APPEAL', readString(formData, 'intendAppeal'));
  set('12 APPEAL INTENT DATE_af_date', readString(formData, 'appealIntentDate'));
  set('13 NOT APPEALED', readBoolean(formData, 'notAppealed'));
  set('13 DATE OF APPEAL IF ANY_af_date', readString(formData, 'appealDate'));
  set('14 APPEAL DECISION', readString(formData, 'appealDecision'));
  set('14 APPEAL DECISION DATE_af_date', readString(formData, 'appealDecisionDate'));
  set(
    '15 DATE OF NOTICE OF APPEAL DECISION_af_date',
    readString(formData, 'appealDecisionNoticeDate'),
  );

  // --- Item 16: final administrative action ------------------------------
  set('16 FINAL ADMIN UD', readString(formData, 'finalAdminUd'));
  set('16 FINAL ADMIN DTD', readString(formData, 'finalAdminDtd'));

  // --- Item 21: remarks ---------------------------------------------------
  const remarks = readRemarks(formData);
  const remarksFreeText = readString(formData, 'remarksFreeText') ?? '';
  // The overflow carriers and the derived vacation remarks go in WITH the
  // clerk's own remarks so composeRemarks sorts the whole set
  // chronologically, as the page 3 instruction requires. See
  // vacationRemarks above for what it derives and why (decision row D-60).
  set(
    '21 REMARKS',
    composeRemarks(
      [...remarks, ...overflowRemarks(formData), ...vacationRemarks(formData)],
      remarksFreeText,
    ),
  );

  // --- Item 22, row A only: victim demographics ---------------------------
  // Rows B through E are DELIBERATELY never written. The printed form's own
  // item 22 instruction gives one status vocabulary, and that vocabulary is
  // exactly what row A's dropdown offers (see NAVMC_10132_VICTIM_STATUS).
  // Rows B-E are non-editable combo boxes carrying a second, undocumented
  // vocabulary that contradicts the instruction (spec defect 3.1). Writing
  // an instruction-vocabulary value into a row B-E field would either fail
  // to match any of that row's closed options or silently misrepresent the
  // victim. Victims 2 through 5 are recorded in item 21 instead, using the
  // instruction's own "Additional Victims" format, which is composeRemarks'
  // job, not this table's. Nothing below may write a `22B`, `22C`, `22D`,
  // or `22E` field name.
  const victimRows = readRows(formData, 'victims');
  const victimA = victimRows[0];
  set('22A VICTIM STATUS', stringField(victimA, 'status'));
  set('22A VICTIM SEX', stringField(victimA, 'sex'));
  set('22A VICTIM RACE', stringField(victimA, 'race'));
  set('22A VICTIM ETHNICITY', stringField(victimA, 'ethnicity'));

  return table;
}

/**
 * Field names the fill engine must temporarily unlock (clear `/Ff` bit 1,
 * the readOnly flag) before writing, then re-lock afterward. All four are
 * readOnly on the blank because the official form populates them only
 * through JavaScript pdf-lib does not execute:
 *
 * - `2 BOOKER`: populated only by the item 2 on-blur script (see
 *   /tmp/ctx/decoded-scripts.txt). Left locked, the field keeps whatever
 *   the blank shipped with, the ACCEPTANCE sentence, regardless of what
 *   this table computed for it.
 * - `23 ACCUSED FULL NAME`, `24 ACCUSED RANK/GRADE`, `25 ACCUSED EDIPI`:
 *   populated only by calculate JavaScript off items 18-20 (see the map's
 *   `calculationOrder`). Left locked, page 2 ships with no accused
 *   identity on it, which is the MCO 5800.16 Vol 14 para 011103 violation
 *   `export-integration.md` calls out.
 */
export const NAVMC_10132_UNLOCK_READ_ONLY: readonly string[] = [
  '2 BOOKER',
  '23 ACCUSED FULL NAME',
  '24 ACCUSED RANK/GRADE',
  '25 ACCUSED EDIPI',
];
