/**
 * The post-action chain that follows a commander's decision to vacate a
 * suspended punishment. MCO 5800.16 Vol 14 para 011202. Decision row D-55.
 *
 * MCO 5800.16 Vol 14 (18 MAY 2021) para 011202, quoted verbatim:
 *
 *   "The unit commander will generate the vacation letter, Figure 14-1,
 *   which notifies the Marine of the commander's decision to vacate the
 *   punishment in whole or in part. The unit administrators will update
 *   block 16 on the original UPB with the vacated punishment information
 *   from the commander's letter and forward a copy of the vacation letter
 *   and a copy of the updated UPB to the IPAC/Administration Section for
 *   unit diary reporting. Upon completion of the unit diary reporting, the
 *   unit administrators will provide a copy of the completed UPB with the
 *   Unit Diary number and date of the action taken to the unit. The
 *   IPAC/Administration Section will scan the corrected UPB to the ESR/OMPF
 *   in accordance with established procedures. The unit must validate that
 *   the copy in the ESR/OMPF matches the original UPB on file in the UPB
 *   binder."
 *
 * SOURCE VERIFIED TWO WAYS. The paragraph was read from the 18 MAY 2021
 * edition posted at marines.mil, and again from the 08 AUG 2018 edition
 * posted there, and the two agree word for word except that the 2018 text
 * does not name Figure 14-1. The 2021 wording is the one quoted, matching
 * the edition in this spec's source list.
 *
 * THE FIRST DRAFT OF THIS MODULE GOT THE CENTRAL PHRASE BACKWARDS, and the
 * correction is the reason the quote above is now mandatory reading before
 * anyone edits this file. Decision row D-55 resolved "vacated punishment
 * information" to the unit diary NUMBER AND DATE of the vacation action.
 * The paragraph says the opposite: that information comes "from the
 * commander's letter", and the Unit Diary number appears one sentence
 * LATER, after unit diary reporting has been completed. A commander's
 * letter carries no unit diary number, because none exists yet when the
 * letter is written. D-55's reading is reversed in the spec.
 *
 * WHICH EXPOSES A MISMATCH BETWEEN THE ORDER AND THE FORM, and it is a real
 * one rather than a wording quibble. Block 16 on the NAVMC 10132 is exactly
 * two fields, `16 FINAL ADMIN UD` and `16 FINAL ADMIN DTD`, a unit diary
 * number and a date. The order directs that block be updated with the
 * vacated punishment information from the commander's letter. The form has
 * nowhere to put that: no field in block 16 accepts a description of what
 * was vacated, and the two fields it does have hold a number that does not
 * exist yet. The place on this form that CAN carry it is item 21, which is
 * where `vacationRemarks` (navmc10132-acroform.ts, decision row D-60)
 * already writes the structured `suspension-vacated-njp` line. So the app's
 * existing behaviour is closer to what 011202 is reaching for than block 16
 * can be, and the gap belongs to the form. Seventh finding for CMC (JA).
 *
 * THE LOCK COLLISION, which the verbatim text makes sharper rather than
 * softer. Two of the six steps below write THE ORIGINAL UPB: step 2 updates
 * block 16 on it, and step 4 completes it with the Unit Diary number. The
 * form's own `16 FINAL ADMIN INIT` signature carries `/Action /All`, so
 * signing it locks every field permanently, and that signature is pass 7,
 * the close-out of the original NJP. A vacation arrives months later. What
 * 011202 requires, the form makes impossible in place. No setting in this
 * app or in Acrobat lawfully removes the lock, because defeating it would
 * invalidate the signature it protects. Reported to the clerk as a named
 * obstacle with the lawful ways through. Sixth finding for CMC (JA).
 *
 * ON THE FIRST SENTENCE, AND WHY IT DOES NOT REOPEN D-50. The paragraph
 * describes Figure 14-1 as notifying the Marine of the commander's
 * "decision" to vacate, while para 011201 requires the accused be notified
 * and given an opportunity to respond BEFORE the suspension may be vacated.
 * One letter cannot both precede and follow the decision, which is exactly
 * the ambiguity D-50 records. Stephen ruled it: ONE letter, served once, as
 * the notice of intent, and 011202 describes the downstream handling of
 * that same letter. This module follows that ruling and does not relitigate
 * it. Step 1 below is worded as the paragraph words it.
 *
 * WHY A CHECKLIST AND NOT A GENERATED DOCUMENT, the same reasoning as
 * njp-appeal-package.ts: almost none of this is a document this app could
 * write. It is routing and verification, and the failure mode is OMISSION.
 * A vacation that never reaches the OMPF is a punishment the permanent
 * record does not show, and nobody finds out until the next promotion
 * board.
 *
 * THE LAST STEP IS A DUTY, NOT A FORMALITY. "The unit must validate" is the
 * only mandatory-voice sentence in the paragraph, and it is the only step
 * that can catch an error made in any of the other five. It is also the one
 * most likely to be skipped, because by then the work feels finished.
 *
 * WHAT THE APP CAN AND CANNOT SEE. Only step 4 leaves a trace in this app:
 * the Unit Diary number and date land in `finalAdminUd` and `finalAdminDtd`.
 * Everything else is paper moving between a unit and its IPAC. The one
 * derivation this module makes is that a vacation post-dates the NJP it
 * vacates, so a block 16 entry dated BEFORE the vacation outcome cannot be
 * an entry for that vacation. That is provable, not inferred.
 *
 * ONE PACKAGE PER EXECUTED VACATION. D-60 allows more than one vacation
 * record on a UPB, each targeting its own suspension, and each carries its
 * own 011202 chain. A `pending` or `not-vacated` record gets NO package at
 * all: the commander has not decided, or decided not to vacate, so there is
 * no letter and nothing to route.
 */

import type { FormData } from '@/types';
import type { Navmc10132Vacation } from '@/types/navmc';
import { parseIsoDate } from '@/lib/navmc10132-date';

/** Three of the four words `AppealItemState` uses in njp-appeal-package.ts,
 * deliberately the same three, so a clerk who has read one checklist does
 * not have to learn a second set of states for the other. 'not-applicable'
 * is the one that is missing, and its absence is meaningful: every sentence
 * of 011202 applies to every executed vacation without exception. There is
 * no conditional step here the way 011107 conditions the Record of Service
 * on the accused being a corporal or below. If a step is ever found to be
 * conditional, add the state back rather than marking it satisfied. */
export type PostActionItemState = 'satisfied' | 'unsatisfied' | 'unverifiable';

/** Which of the six sentences of 011202 an item belongs to, in the
 * paragraph's own order. */
export type PostActionStep = 1 | 2 | 3 | 4 | 5 | 6;

export interface PostActionItem {
  id: string;
  step: PostActionStep;
  /** What the paragraph directs, in its own terms. */
  requirement: string;
  state: PostActionItemState;
  /** Why it is in that state, and for anything unverifiable, what to check. */
  detail: string;
}

export interface VacationPostActionPackage {
  kind: 'vacation-post-action';
  /** Position of this vacation in `formData.vacations`. */
  vacationIndex: number;
  /** The suspension this vacation targeted, `Navmc10132Vacation.suspensionIndex`. */
  suspensionIndex: number;
  /** Whether the vacation was full or partial, carried through for display. */
  status: 'vacated-full' | 'vacated-part';
  items: PostActionItem[];
  /** Count of steps the app cannot see. Never hidden from the caller. */
  unverifiableCount: number;
  /** Steps actively failing, as distinct from unverifiable. */
  unsatisfiedCount: number;
  /**
   * The `16 FINAL ADMIN INIT` lock against steps 2 and 4, stated in full.
   * Present on every package, because the collision does not depend on the
   * state of this record: it is structural. See the header.
   */
  blockSixteenLockCollision: string;
  /**
   * The mismatch between what 011202 directs into block 16 and what block
   * 16 can hold. Also structural, also on every package. See the header.
   */
  blockSixteenCannotHoldIt: string;
}

const LOCK_COLLISION =
  'STEPS 2 AND 4 MAY BE IMPOSSIBLE IN PLACE. Both write the ORIGINAL UPB, and the ' +
  'NAVMC 10132 signature field `16 FINAL ADMIN INIT` carries /Action /All, so signing ' +
  'it locks every field on the form permanently. That signature closes out the original ' +
  'NJP. This vacation came later. If the original has been signed at block 16, Adobe ' +
  'will not permit either write, and no setting in this app or in Acrobat lawfully ' +
  'removes the lock: defeating it would invalidate the signature it protects. The two ' +
  'lawful ways through are to record the vacation on a separate continuation or ' +
  'corrected copy routed with the original, or to ask the IPAC/Administration Section ' +
  'how the servicing office wants a post-signature block 16 correction submitted. Ask ' +
  'before improvising: the answer is local. The form and MCO 5800.16 Vol 14 para 011202 ' +
  'contradict each other here, and this is reported to CMC (JA).';

const BLOCK_16_CANNOT_HOLD_IT =
  'BLOCK 16 HAS NOWHERE TO PUT WHAT STEP 2 ASKS FOR. Para 011202 directs block 16 to be ' +
  "updated with the vacated punishment information FROM THE COMMANDER'S LETTER. " +
  'Block 16 on this form is exactly two fields, a unit diary number and a date. Neither ' +
  'accepts a description of what was vacated, and the unit diary number does not exist ' +
  'yet when the letter is written: the order introduces it one sentence later, after ' +
  'unit diary reporting. On this form the vacated punishment information goes to item ' +
  '21, where this app already writes it as a structured remark. Record it there, and ' +
  'treat block 16 as the unit diary entry it actually is. Reported to CMC (JA).';

function str(formData: FormData, key: string): string {
  const value: unknown = formData[key];
  return typeof value === 'string' ? value.trim() : '';
}

/** `formData.vacations` as Navmc10132Vacation[], the same runtime-checked
 * pattern navmc10132-acroform.ts and njp-appeal-package.ts use: an `unknown`
 * binding narrowed by Array.isArray, never a cast off the `any`-typed index. */
function readVacations(formData: FormData): Navmc10132Vacation[] {
  const value: unknown = formData.vacations;
  return Array.isArray(value) ? (value as Navmc10132Vacation[]) : [];
}

/**
 * What block 16 currently holds, relative to one vacation's outcome date.
 *
 *   - `'empty'`: neither field carries anything.
 *   - `'predates'`: `finalAdminDtd` parses and falls BEFORE this vacation
 *     was decided. The entry in block 16 cannot be this vacation's, so the
 *     unit diary reporting for it provably has not come back.
 *   - `'current'`: `finalAdminDtd` parses and falls on or after the outcome
 *     date. A vacation post-dates the NJP it vacates by design, so an entry
 *     dated after the vacation was decided cannot be the original NJP's
 *     close-out entry. It is this vacation's, or a later action's.
 *   - `'unreadable'`: something is in block 16 but the date does not parse,
 *     or the vacation carries no outcome date, so there is nothing to
 *     compare and the module says so instead of guessing.
 */
type BlockSixteenState = 'empty' | 'predates' | 'current' | 'unreadable';

function blockSixteenState(formData: FormData, vacation: Navmc10132Vacation): BlockSixteenState {
  const ud = str(formData, 'finalAdminUd');
  const dtd = str(formData, 'finalAdminDtd');
  if (ud === '' && dtd === '') return 'empty';

  const outcome = parseIsoDate(vacation.outcomeDate);
  const entry = parseIsoDate(dtd);
  if (outcome === null || entry === null) return 'unreadable';

  return entry.getTime() < outcome.getTime() ? 'predates' : 'current';
}

/**
 * Step 4, the only sentence of 011202 that leaves a trace in this app.
 *
 * "Upon completion of the unit diary reporting, the unit administrators
 * will provide a copy of the completed UPB with the Unit Diary number and
 * date of the action taken to the unit." Those two values are block 16,
 * `finalAdminUd` and `finalAdminDtd`.
 */
function unitDiaryReturned(formData: FormData, vacation: Navmc10132Vacation): PostActionItem {
  const state = blockSixteenState(formData, vacation);
  const ud = str(formData, 'finalAdminUd');
  const dtd = str(formData, 'finalAdminDtd');

  const detail: Record<BlockSixteenState, string> = {
    empty:
      'Block 16 carries no unit diary number and no date, so the unit diary reporting for ' +
      'this vacation has not come back, or has not been recorded here.',
    predates:
      `Block 16 is dated ${dtd}, which is before this vacation was decided on ` +
      `${vacation.outcomeDate}. That entry belongs to an earlier action, so nothing has ` +
      'come back for this vacation.',
    current:
      `Block 16 carries ${ud === '' ? 'a date but no unit diary number, so the reporting is not complete' : `unit diary ${ud}`}` +
      `${dtd === '' ? '' : `, dated ${dtd}`}, on or after this vacation was decided. A ` +
      'vacation post-dates the NJP it vacates, so this entry cannot be the original ' +
      'close-out. The app cannot confirm it belongs to THIS vacation rather than to a ' +
      'later action. Check it against the vacation letter.',
    unreadable:
      'Block 16 carries something, but there is no readable pair of dates to compare: ' +
      `block 16 shows ${dtd === '' ? 'no date' : `"${dtd}"`} and this vacation shows ` +
      `${vacation.outcomeDate === undefined || vacation.outcomeDate === '' ? 'no outcome date' : `"${vacation.outcomeDate}"`}. ` +
      'Read block 16 against the vacation letter by hand.',
  };

  return {
    id: 'unit-diary-returned',
    step: 4,
    requirement:
      'Upon completion of the unit diary reporting, the unit administrators provide the ' +
      'unit with a copy of the completed UPB carrying the Unit Diary number and the date ' +
      'of the action taken.',
    state:
      state === 'current' ? 'satisfied' : state === 'unreadable' ? 'unverifiable' : 'unsatisfied',
    detail: detail[state],
  };
}

function chainItems(formData: FormData, vacation: Navmc10132Vacation): PostActionItem[] {
  const inWholeOrPart = vacation.status === 'vacated-full' ? 'in whole' : 'in part';

  return [
    {
      id: 'commander-generates-letter',
      step: 1,
      requirement:
        'The unit commander generates the vacation letter, Figure 14-1, notifying the ' +
        "Marine of the commander's decision to vacate the punishment in whole or in part.",
      state: 'unverifiable',
      detail:
        `This record says the punishment was vacated ${inWholeOrPart}. This app builds ` +
        'Figure 14-1 (njp-vacation-handoff.ts), but it cannot see whether the letter was ' +
        'signed and served. Per decision row D-50 there is ONE letter, served once as the ' +
        'notice of intent; this step is its downstream handling, not a second document.',
    },
    {
      id: 'block-16-updated',
      step: 2,
      requirement:
        'The unit administrators update block 16 on the ORIGINAL UPB with the vacated ' +
        "punishment information from the commander's letter.",
      state: 'unverifiable',
      detail:
        'Not checkable on this form, and not for want of trying: block 16 is a unit diary ' +
        'number and a date, and neither holds a description of what was vacated. See the ' +
        'blockSixteenCannotHoldIt note on this package. What this app does record is the ' +
        'item 21 remark, which is where the vacated punishment information belongs here.',
    },
    {
      id: 'forward-copies-to-ipac',
      step: 3,
      requirement:
        'Forward a COPY of the vacation letter and a COPY of the updated UPB to the ' +
        'IPAC/Administration Section for unit diary reporting.',
      state: 'unverifiable',
      detail:
        'A physical routing step the app cannot observe. Note that the order says copies: ' +
        'the original UPB stays in the binder, which is what step 6 validates against. ' +
        'Figure 14-1 already carries IPAC on its Copy to line ' +
        '(njp-vacation-handoff.ts, VACATION_COPY_TO), so the distribution of the letter is ' +
        'built in. The copy of the UPB going with it is not.',
    },
    unitDiaryReturned(formData, vacation),
    {
      id: 'ipac-scans-esr-ompf',
      step: 5,
      requirement:
        'The IPAC/Administration Section scans the corrected UPB to the ESR/OMPF in ' +
        'accordance with established procedures.',
      state: 'unverifiable',
      detail:
        'Happens entirely outside this app. This is the step whose omission is invisible ' +
        'at the unit: a vacation that never reaches the OMPF is a punishment the permanent ' +
        'record does not show.',
    },
    {
      id: 'unit-validates-scan',
      step: 6,
      requirement:
        'The unit MUST validate that the copy in the ESR/OMPF matches the original UPB on ' +
        'file in the UPB binder.',
      state: 'unverifiable',
      detail:
        'A verification duty, not a filing step, and the only one in the chain that can ' +
        'catch an error made in any of the other five. It is also the only sentence in ' +
        'para 011202 written in mandatory voice. Compare the scanned copy against the ' +
        'binder original field by field, and block 16 in particular: the unit diary ' +
        'number, its date, and that the punishment shown vacated is the one the commander ' +
        'actually vacated.',
    },
  ];
}

/** True only for a vacation that actually vacated something. */
function isExecuted(v: Navmc10132Vacation): boolean {
  return v.status === 'vacated-full' || v.status === 'vacated-part';
}

/**
 * The 011202 post-action chain for every executed vacation on this UPB, in
 * `formData.vacations` order.
 *
 * Returns an EMPTY ARRAY when no vacation was executed, which is the
 * ordinary case: most suspensions are never vacated at all, they run out
 * and remit under MCM Part V para 6.a(3). A `pending` record has no chain
 * because the commander has not decided, so 011202's first sentence has not
 * happened; a `not-vacated` record has no chain because nothing was
 * vacated. Neither is an error and neither produces an entry here.
 */
export function vacationPostActions(formData: FormData): VacationPostActionPackage[] {
  return readVacations(formData)
    .map((vacation, vacationIndex) => ({ vacation, vacationIndex }))
    .filter(({ vacation }) => isExecuted(vacation))
    .map(({ vacation, vacationIndex }) => {
      const items = chainItems(formData, vacation);
      return {
        kind: 'vacation-post-action' as const,
        vacationIndex,
        suspensionIndex: vacation.suspensionIndex,
        status: vacation.status as 'vacated-full' | 'vacated-part',
        items,
        unverifiableCount: items.filter((i) => i.state === 'unverifiable').length,
        unsatisfiedCount: items.filter((i) => i.state === 'unsatisfied').length,
        blockSixteenLockCollision: LOCK_COLLISION,
        blockSixteenCannotHoldIt: BLOCK_16_CANNOT_HOLD_IT,
      };
    });
}
