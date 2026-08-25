/**
 * The post-action chain that follows an executed vacation of suspended
 * punishment. MCO 5800.16 Vol 14 para 011202. Decision row D-55.
 *
 * SOURCE TEXT NOT QUOTED HERE, AND THAT IS A DELIBERATE, VISIBLE DEBT.
 * `njp-appeal-package.ts` quotes para 011107 verbatim in its own header,
 * because a checklist that cites a paragraph has to be checkable against
 * the words of that paragraph. The verbatim text of 011202 is NOT in this
 * codebase and was not in hand when this module was written: the order was
 * read from a PDF that is no longer available to the author, and the five
 * steps below come from decision row D-55, which was written while that PDF
 * WAS open. That record is reliable but it is a summary, not the paragraph.
 *
 * SO NOTHING IN THIS FILE IS PRESENTED AS A QUOTATION. Every `requirement`
 * string below is worded as this codebase's own restatement of a step, and
 * no string here sits inside quotation marks attributed to the order. The
 * one phrase carried across from the paragraph itself, "vacated punishment
 * information", is marked as such at its own use. BEFORE THIS SHIPS TO A
 * USER: open MCO 5800.16 Vol 14 para 011202, add the verbatim text to this
 * header the way 011107 appears in njp-appeal-package.ts, and check each of
 * the five steps against it. Two things in particular need confirming
 * against the words, because both are inferences this module depends on:
 * that the five steps are in the order given below, and that step 1's
 * "vacated punishment information" is the unit diary NUMBER AND DATE of the
 * vacation action rather than a description of the punishment vacated.
 *
 * WHAT THE CHAIN IS. After a commander actually vacates a suspended
 * punishment, five things happen, and none of them are modelled anywhere
 * else in this app:
 *
 *   1. Administrators update block 16 on the ORIGINAL UPB.
 *   2. The Figure 14-1 letter and the updated UPB go to IPAC.
 *   3. IPAC returns the completed UPB carrying the unit diary number and date.
 *   4. IPAC scans the corrected UPB to the ESR and the OMPF.
 *   5. The unit VALIDATES the scanned copy against the binder original.
 *
 * WHY A CHECKLIST AND NOT A GENERATED DOCUMENT, the same reasoning as
 * njp-appeal-package.ts: almost none of this is a document this app could
 * write. It is routing and verification, and the failure mode is OMISSION.
 * A vacation that never reaches the OMPF is a punishment the record does
 * not show, and nobody finds out until the Marine's next promotion board.
 *
 * STEP 5 IS A DUTY, NOT A FORMALITY. The unit compares what IPAC scanned
 * against what the unit holds. It is the only step in the chain that can
 * catch an error made in any of the other four, and it is the step most
 * likely to be skipped, because by then the work feels finished.
 *
 * THE LOCK COLLISION, and it is the reason this module reports one thing it
 * cannot fix. The form's own `16 FINAL ADMIN INIT` signature field carries
 * `/Action /All`, so signing it locks the ENTIRE document, every field,
 * permanently. That signature is pass 7, the close-out of the original NJP.
 * A vacation happens months later, and step 1 orders block 16 UPDATED on
 * that same original UPB. The form's lock design and the order's procedure
 * contradict each other outright: what 011202 requires, the form makes
 * impossible in place. This is not a defect this app can work around,
 * because the lock is applied by Adobe against a real signature and any
 * "fix" that defeated it would invalidate that signature. It is reported to
 * the clerk as a named obstacle with the two lawful ways through, and it is
 * the sixth finding in the CMC (JA) defect report.
 *
 * WHAT THE APP CAN AND CANNOT SEE. Block 16 is `finalAdminUd` and
 * `finalAdminDtd`, two fields, and BOTH the unit's step-1 update and IPAC's
 * step-3 return land in them. The app therefore sees one final state, never
 * the sequence that produced it, and step 3 says so rather than inventing a
 * distinction the data cannot support. What the app CAN do is compare
 * `finalAdminDtd` against the vacation's own outcome date: a block 16 entry
 * dated BEFORE the vacation was decided cannot be an entry for that
 * vacation, so step 1 is provably not done. That is a derivation, not a
 * guess, and it is the only one this module makes.
 *
 * ONE PACKAGE PER EXECUTED VACATION. D-60 allows more than one vacation
 * record on a UPB, each targeting its own suspension, and each one carries
 * its own 011202 chain. A `pending` or `not-vacated` record gets NO package
 * at all: nothing was vacated, so there is nothing to route.
 */

import type { FormData } from '@/types';
import type { Navmc10132Vacation } from '@/types/navmc';
import { parseIsoDate } from '@/lib/navmc10132-date';

/** Three of the four words `AppealItemState` uses in njp-appeal-package.ts,
 * deliberately the same three, so a clerk who has read one checklist does
 * not have to learn a second set of states for the other. 'not-applicable'
 * is the one that is missing, and its absence is meaningful: every step in
 * the 011202 chain applies to every executed vacation without exception.
 * There is no conditional step here the way 011107 conditions the Record of
 * Service on the accused being a corporal or below. If a step is ever found
 * to be conditional, add the state back rather than marking it satisfied. */
export type PostActionItemState = 'satisfied' | 'unsatisfied' | 'unverifiable';

/** Which of the five 011202 steps an item belongs to. */
export type PostActionStep = 1 | 2 | 3 | 4 | 5;

export interface PostActionItem {
  id: string;
  step: PostActionStep;
  /** This codebase's restatement of the step. NOT a quotation, see header. */
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
   * The `16 FINAL ADMIN INIT` lock against step 1, stated in full. Present
   * on every package, because the collision does not depend on the state of
   * this particular record: it is structural. See the header.
   */
  blockSixteenLockCollision: string;
}

const LOCK_COLLISION =
  'STEP 1 MAY BE IMPOSSIBLE IN PLACE. The NAVMC 10132 signature field ' +
  '`16 FINAL ADMIN INIT` carries /Action /All, so signing it locks every field on the ' +
  'form permanently. That signature closes out the original NJP. This vacation came ' +
  'later, and step 1 requires block 16 on that same original UPB to be updated. If the ' +
  'original has been signed at block 16, Adobe will not permit the update, and no ' +
  'setting in this app or in Acrobat lawfully removes the lock: defeating it would ' +
  'invalidate the signature it protects. The two lawful ways through are to record the ' +
  'vacation on a separate continuation or corrected copy routed with the original, or ' +
  'to ask IPAC how the servicing office wants a post-signature block 16 correction ' +
  'submitted. Ask before improvising: the answer is local. The form and MCO 5800.16 ' +
  'Vol 14 para 011202 contradict each other here, and this is reported to CMC (JA).';

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
 * Four outcomes, and the middle two are the whole reason this is a function
 * rather than an emptiness check:
 *
 *   - `'empty'`: neither field carries anything.
 *   - `'predates'`: `finalAdminDtd` parses and falls BEFORE this vacation
 *     was decided. The entry in block 16 cannot be this vacation's, so the
 *     step-1 update provably has not happened.
 *   - `'current'`: `finalAdminDtd` parses and falls on or after the outcome
 *     date. A vacation post-dates the NJP it vacates by design, so an entry
 *     dated after the vacation was decided cannot be the original NJP's
 *     close-out entry. It is this vacation's, or a later action's.
 *   - `'unreadable'`: something is in block 16 but the date does not parse,
 *     or the vacation carries no outcome date to compare against, so there
 *     is nothing to compare and the module says so instead of guessing.
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

function stepOne(formData: FormData, vacation: Navmc10132Vacation): PostActionItem {
  const state = blockSixteenState(formData, vacation);
  const ud = str(formData, 'finalAdminUd');
  const dtd = str(formData, 'finalAdminDtd');

  const detail: Record<BlockSixteenState, string> = {
    empty:
      'Block 16 carries no unit diary number and no date, so nothing has been recorded ' +
      'there for this vacation or for anything else.',
    predates:
      `Block 16 is dated ${dtd}, which is before this vacation was decided on ` +
      `${vacation.outcomeDate}. That entry belongs to an earlier action, so block 16 has ` +
      'not been updated for this vacation.',
    current:
      `Block 16 carries ${ud === '' ? 'a date but no unit diary number' : `unit diary ${ud}`}` +
      `${dtd === '' ? '' : `, dated ${dtd}`}, on or after this vacation was decided. A ` +
      'vacation post-dates the NJP it vacates, so this entry cannot be the original ' +
      "close-out. The app cannot confirm it belongs to THIS vacation rather than to a " +
      'later action. Check it against the vacation letter.',
    unreadable:
      'Block 16 carries something, but there is no readable pair of dates to compare: ' +
      `block 16 shows ${dtd === '' ? 'no date' : `"${dtd}"`} and this vacation shows ` +
      `${vacation.outcomeDate === undefined || vacation.outcomeDate === '' ? 'no outcome date' : `"${vacation.outcomeDate}"`}. ` +
      'Read block 16 against the vacation letter by hand.',
  };

  return {
    id: 'block-16-updated',
    step: 1,
    requirement:
      'Administrators update block 16 on the ORIGINAL UPB with the vacated punishment ' +
      'information. Per D-55, "vacated punishment information" is the unit diary number ' +
      'and date of the VACATION action, not a description of the punishment vacated.',
    state: state === 'current' ? 'satisfied' : state === 'unreadable' ? 'unverifiable' : 'unsatisfied',
    detail: detail[state],
  };
}

function chainItems(formData: FormData, vacation: Navmc10132Vacation): PostActionItem[] {
  return [
    stepOne(formData, vacation),
    {
      id: 'forward-to-ipac',
      step: 2,
      requirement: 'Forward the Figure 14-1 letter and the updated UPB to IPAC.',
      state: 'unverifiable',
      detail:
        'A physical routing step the app cannot observe. Figure 14-1 already carries IPAC ' +
        'on its Copy to line (njp-vacation-handoff.ts, VACATION_COPY_TO), so the ' +
        'distribution of the letter is built in. The UPB going with it is not.',
    },
    {
      id: 'ipac-returns-ud',
      step: 3,
      requirement:
        'IPAC returns the completed UPB carrying the unit diary number and date.',
      state: 'unverifiable',
      detail:
        'Not separately observable. Both this step and step 1 write the same two fields, ' +
        'finalAdminUd and finalAdminDtd, so the app sees one final state and never the ' +
        'sequence that produced it. Step 1 reports what block 16 currently holds. What ' +
        'this step adds is that the unit diary NUMBER is assigned by IPAC, not by the ' +
        'unit: if block 16 carries a date but no number, IPAC has not returned it yet.',
    },
    {
      id: 'ipac-scans-esr-ompf',
      step: 4,
      requirement: 'IPAC scans the corrected UPB to the ESR and the OMPF.',
      state: 'unverifiable',
      detail:
        'Happens entirely outside this app. This is the step whose omission is invisible ' +
        'at the unit: a vacation that never reaches the OMPF is a punishment the ' +
        'permanent record does not show.',
    },
    {
      id: 'unit-validates-scan',
      step: 5,
      requirement:
        'The unit VALIDATES the scanned copy against the binder original.',
      state: 'unverifiable',
      detail:
        'A verification duty, not a filing step, and the only one in the chain that can ' +
        'catch an error made in any of the other four. Compare the scanned copy against ' +
        'the binder original field by field, and block 16 in particular: the unit diary ' +
        'number, its date, and that the vacated punishment is the one the commander ' +
        'actually vacated.',
    },
  ];
}

/** True only for a vacation that actually vacated something. */
function isExecuted(v: Navmc10132Vacation): v is Navmc10132Vacation & {
  status: 'vacated-full' | 'vacated-part';
} {
  return v.status === 'vacated-full' || v.status === 'vacated-part';
}

/**
 * The 011202 post-action chain for every executed vacation on this UPB, in
 * `formData.vacations` order.
 *
 * Returns an EMPTY ARRAY when no vacation was executed, which is the
 * ordinary case: most suspensions are never vacated at all, they run out
 * and remit under MCM Part V para 6.a(3). A `pending` record has no chain
 * because the commander has not decided; a `not-vacated` record has no
 * chain because nothing was vacated. Neither is an error and neither
 * produces an entry here.
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
      };
    });
}
