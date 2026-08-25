import type { Navmc10132Service } from '@/lib/navmc10132-ranks';
import { ParagraphData } from './index';

export interface Navmc10274Data {
  actionNo: string;
  ssic: string;
  date: string;
  from: string;
  orgStation: string;
  to: string;
  via: string;
  subject: string;
  reference: string;
  enclosure: string;
  supplementalInfo: string;
  supplementalInfoParagraphs?: ParagraphData[];
  copyTo: string;
  signature?: string;
  classification?: string;
  // Metadata for internal use
  isDraft?: boolean;
}

export interface Navmc11811Data {
  name: string;
  edipi: string;
  remarksLeft?: string;
  remarksRight?: string;
  // Fallback for single remarks string if needed, but prefer left/right split
  remarks?: string;
}

export interface BoxBoundary {
  left: number;
  top: number;
  width: number;
  height: number;
}

export const NAVMC_10274_FIELDS: (keyof Navmc10274Data)[] = [
  "actionNo",
  "ssic",
  "date",
  "from",
  "orgStation",
  "to",
  "via",
  "subject",
  "reference",
  "enclosure",
  "supplementalInfo",
  "copyTo",
];

// --- NAVMC 10922 (7-21) Dependency Application ---
// Rule source: docs/NAVMC_10922_SPEC.md. Positional fill map:
// tools/aa-forms/navmc10922-map.json. Phase scope (spec decision 9):
// spouse and children only - secondary dependent values are excluded
// from the relationship vocabulary until that engine is built.

/**
 * Phase 1 relationship vocabulary. Primary dependents only.
 * Secondary dependents (ward, incapacitated child over 21, student
 * 21-22, parents, in loco parentis) are a later phase - adding them
 * here without the DD Form 137 routing would let users file claims
 * with missing mandatory attachments.
 */
export const NAVMC_10922_RELATIONSHIPS = [
  'SPOUSE',
  'SON',
  'DAUGHTER',
  'STEPSON',
  'STEPDAUGHTER',
  'ADOPTED SON',
  'ADOPTED DAUGHTER',
  'CHILD BORN OUT OF WEDLOCK',
] as const;
export type Navmc10922Relationship = (typeof NAVMC_10922_RELATIONSHIPS)[number];

/** Section 2 grid row. The form has exactly 6 - capacity is a form fact. */
export interface Navmc10922Dependent {
  name: string;
  address: string;
  relationship: '' | Navmc10922Relationship;
  /** ISO date internally; rendered M/D/YY at emit per template picture. */
  dateOfBirth: string;
  /** ISO. FMR May 2025 Table 26-1 rule 5 - date the dependent is
   *  acquired; for a previously approved dependent, the DATE OF
   *  APPROVAL per the printed column header. */
  allowanceClaimedFrom: string;
  /** App-side flag driving the Section 3 custodian requirement. */
  livesOutsideHousehold?: boolean;
  /** App-side. TRUE = this dependent was approved on an earlier
   *  NAVMC 10922 - the discriminator between START (none flagged) and
   *  GAIN (record exists). The printed artifact is the approval date
   *  in allowanceClaimedFrom; this flag is never emitted. */
  previouslyApproved?: boolean;
}

/** Section 4 dissolution row. The form has exactly 4. */
export interface Navmc10922Dissolution {
  formerMarriageOf: '' | 'self' | 'spouse';
  spouseName: string;
  /** ISO. Must precede the present marriage date (spec section 9 error 2). */
  dateOfDissolution: string;
  placeOfDissolution: string;
  reason: '' | 'death' | 'annulment' | 'divorce';
  /** App-side. TRUE = divorce granted by a foreign nation - a doubtful
   *  case the CO cannot approve; drives the Ch 1 para 4.b evidence set
   *  and CMC (MFP-1) routing. More reliable than the place-text
   *  heuristic, which stays as a prompt to set this flag. */
  foreignDivorce?: boolean;
}

/** Section 3 - the form provides exactly one custodian row. */
export interface Navmc10922Custodian {
  depNo: string;
  name: string;
  relationship: string;
  address: string;
}

export interface Navmc10922Data {
  // Header block
  /** START is unbindable in the XFA datasets - it exports via the
   *  flattened path only (spec decision 1). */
  reason: '' | 'start' | 'gain' | 'loss';
  dateOfApplication: string; // ISO; rendered MMM D, YYYY per picture clause
  /** App-side. Drives the 30-day substantiation warning
   *  (MCO 1751.3 Ch 1 para 1.f - clock runs from the life event). */
  lifeEventDate: string;
  /** App-side. 'auto' derives START/GAIN from previouslyApproved rows
   *  (any flagged = GAIN, none = START); 'manual' honors the user's
   *  explicit selection. LOSS is always a manual choice. */
  reasonMode?: 'auto' | 'manual';
  /** App-side LOSS panel - the lost dependent has NO Section 2 row
   *  (the roster lists REMAINING dependents; cancelled-manual Figs
   *  1-10/1-11/1-15 convention). These compose the Section 7 loss
   *  narrative and the documents checklist. */
  lostDependentName?: string;
  lostDependentRelationship?: string;
  lostEventType?: '' | 'divorce' | 'annulment' | 'death' | 'other';
  lostEffectiveDate?: string;

  // Section 1 - identification
  nameOfMarine: string;
  edipi: string;
  grade: string;
  typeOfService: '' | 'usmc' | 'usmcr';
  organizationStation: string;
  unitRuc: string;
  ecc: string;
  dateEnlistmentOrAd: string;
  dateLastDischarge: string;
  futureAddressEta: string;

  // Section 2 - dependents (max 6)
  dependents: Navmc10922Dependent[];

  // Section 3 - custodian (single row on the form)
  custodian: Navmc10922Custodian;

  // Section 4 - marital and support/paternity
  marriageDate: string;
  marriagePlace: string;
  marriageSpouseName: string;
  /** App-side, not printed. Drives evidence and approval routing:
   *  US ceremonial and foreign are command-approvable (Ch 1 paras
   *  3.f/3.g); proxy/telephone and common-law route to CMC (MFP-1)
   *  (paras 3.a/3.b). Proxy marriages are increasingly common. */
  marriageType?: '' | 'ceremonial-us' | 'foreign' | 'proxy-telephone' | 'common-law' | 'indian-tribal';
  memberPrevMarried: '' | 'yes' | 'no';
  memberPrevMarriedTimes: string;
  spousePrevMarried: '' | 'yes' | 'no';
  spousePrevMarriedTimes: string;
  dissolutions: Navmc10922Dissolution[];
  courtOrderInEffect: '' | 'yes' | 'no';
  courtOrderDatePlace: string;

  // Section 5 - natural parent of child in Armed Forces
  naturalParentArmedForces: '' | 'yes' | 'no';
  naturalParentInfo: string;

  // Section 6 - spouse in Armed Forces
  spouseArmedForces: '' | 'yes' | 'no';
  spouseEdipi: string;
  spouseGrade: string;
  spouseTypeOfService: '' | 'regular' | 'reserve';
  spouseBranch: string;
  spouseServiceDates: string;
  spouseBaq: '' | 'with' | 'without';

  // Section 7 - certification (EDIPI and grade repeat from Section 1
  // at emit time; the sworn date belongs to the attesting officer)
  documentsViewed: string;
  swornDay: string;
  swornMonth: string;
  swornYear2Digit: string;
  /** App-side, never printed. The form has no typed attesting-officer
   *  name field (signature widget only), so self-attestation detection
   *  requires this (spec decision 8, MCO 1751.3 CH-1 para 3.a). */
  attestingOfficerName: string;

  // Section 8 approving-authority blocks are intentionally absent:
  // the app never populates them (spec section 5). Indices 86-92
  // emit empty.
}

export const NAVMC_10922_EMPTY_DEPENDENT: Navmc10922Dependent = {
  name: '',
  address: '',
  relationship: '',
  dateOfBirth: '',
  allowanceClaimedFrom: '',
};

export const NAVMC_10922_EMPTY_DISSOLUTION: Navmc10922Dissolution = {
  formerMarriageOf: '',
  spouseName: '',
  dateOfDissolution: '',
  placeOfDissolution: '',
  reason: '',
};

export function createEmptyNavmc10922Data(): Navmc10922Data {
  return {
    reason: '',
    dateOfApplication: '',
    lifeEventDate: '',
    nameOfMarine: '',
    edipi: '',
    grade: '',
    typeOfService: '',
    organizationStation: '',
    unitRuc: '',
    ecc: '',
    dateEnlistmentOrAd: '',
    dateLastDischarge: '',
    futureAddressEta: '',
    dependents: Array.from({ length: 6 }, () => ({ ...NAVMC_10922_EMPTY_DEPENDENT })),
    custodian: { depNo: '', name: '', relationship: '', address: '' },
    marriageDate: '',
    marriagePlace: '',
    marriageSpouseName: '',
    memberPrevMarried: '',
    memberPrevMarriedTimes: '',
    spousePrevMarried: '',
    spousePrevMarriedTimes: '',
    dissolutions: Array.from({ length: 4 }, () => ({ ...NAVMC_10922_EMPTY_DISSOLUTION })),
    courtOrderInEffect: '',
    courtOrderDatePlace: '',
    naturalParentArmedForces: '',
    naturalParentInfo: '',
    spouseArmedForces: '',
    spouseEdipi: '',
    spouseGrade: '',
    spouseTypeOfService: '',
    spouseBranch: '',
    spouseServiceDates: '',
    spouseBaq: '',
    documentsViewed: '',
    swornDay: '',
    swornMonth: '',
    swornYear2Digit: '',
    attestingOfficerName: '',
  };
}

// ---------------------------------------------------------------------------
// NAVMC 10132 (Unit Punishment Book)
// Rule source: docs/NAVMC_10132_SPEC.md. Unlike 10274/118(11)/10922 this form
// is a plain AcroForm addressed by field NAME, so the model is semantic and the
// name-to-selector table lives in navmc10132-acroform.ts.
// ---------------------------------------------------------------------------

/**
 * Item 2 demand options. These are the /Opt EXPORT values, byte-exact.
 * The dropdown has NO blank entry on the official form.
 */
export const NAVMC_10132_DEMAND = {
  ACCEPT:
    'I do not demand trial and will accept non-judicial punishment, subject to my right of appeal.',
  REFUSE: 'I demand trial and refuse non-judicial punishment.',
  VESSEL: 'I cannot demand trial because I am attached to or embarked upon a vessel.',
} as const;

export type Navmc10132Demand = '' | (typeof NAVMC_10132_DEMAND)[keyof typeof NAVMC_10132_DEMAND];

/** Item 12. Export values, byte-exact. */
export const NAVMC_10132_APPEAL_INTENT = {
  WILL_NOT: 'I do not intend to appeal.',
  WILL: 'I do intend to appeal.',
  REFUSED: 'the accused refuses to sign.',
} as const;

export type Navmc10132AppealIntent =
  | ''
  | (typeof NAVMC_10132_APPEAL_INTENT)[keyof typeof NAVMC_10132_APPEAL_INTENT];

/**
 * Item 22 victim status. This is the vocabulary printed in the form's own
 * instructions, which is the /Opt list on row A ONLY. Rows B through E carry a
 * different, undocumented vocabulary and are non-editable combos, so the app
 * writes row A to the form and routes victims 2 through 5 into item 21 using
 * the instruction's own "Additional Victims" format. Spec defect 3.1.
 */
export const NAVMC_10132_VICTIM_STATUS = [
  'Military',
  'Military (spouse)',
  'Civilian (spouse)',
  'Civilian (dependent)',
  'Civilian (DON employee)',
  'Civilian (other)',
  'Other',
  'Unknown',
] as const;

export const NAVMC_10132_VICTIM_SEX = ['Male', 'Female', 'Unknown'] as const;

export const NAVMC_10132_VICTIM_RACE = [
  'American Indian or Alaskan Native',
  'Asian',
  'Black or African American',
  'Native Hawaiian or Other Pacific Islander',
  'White',
  'Other',
  'Unknown',
] as const;

export const NAVMC_10132_VICTIM_ETHNICITY = [
  'Hispanic or Latino',
  'Not Hispanic or Latino',
  'Unknown',
] as const;

/** The ten remark formats prescribed by the item 21 instruction, plus free text. */
export type Navmc10132RemarkKind =
  | 'additional-offenses'
  | 'forwarded'
  | 'suspension-vacated-njp'
  | 'appeal-stayed-restriction'
  | 'appeal-stayed-extra-duties'
  | 'appeal-denied'
  | 'appeal-granted'
  | 'suspension-vacated-appeal'
  | 'set-aside'
  | 'additional-victims'
  // Overflow carriers. Items 6 and 7 are SINGLE LINE fields and clip rather
  // than wrapping, so a long entry loses its tail with nothing on the page
  // to show it. When that happens the printed field reads "See Supplemental
  // Page" and the full text lands here, which is the route the form's own
  // page 3 ITEM 21 instruction prescribes for continuation.
  | 'item6-overflow'
  | 'item7-overflow';

/** One of the five item 1 offense rows, carrying its item 5 finding. */
export interface Navmc10132Offense {
  /**
   * /Opt export value of the `1x ARTICLE` dropdown, byte-exact including the
   * double space after the article number. Empty means the row is unused.
   */
  articleLabel: string;
  /**
   * Resolved from articleLabel through navmc10132-articles.ts. Not printed on
   * the form; carried for the unit diary handoff.
   */
  mctfsCode?: string;
  /** Item 1 summary. Roughly 84 characters, clips silently. */
  summary: string;
  /**
   * Item 5. EXPORT values only. The form DISPLAYS "G" and "NG" but stores the
   * long strings, and its own item-6 script tests for "Guilty". Spec defect 3.3.
   */
  finding: '' | 'Guilty' | 'Not Guilty';
}

/** One of the five item 22 victim rows. */
export interface Navmc10132Victim {
  status: '' | (typeof NAVMC_10132_VICTIM_STATUS)[number];
  sex: '' | (typeof NAVMC_10132_VICTIM_SEX)[number];
  race: '' | (typeof NAVMC_10132_VICTIM_RACE)[number];
  ethnicity: '' | (typeof NAVMC_10132_VICTIM_ETHNICITY)[number];
}

/** A selected punishment code plus the parameters that code requires. */
export interface Navmc10132PunishmentEntry {
  /** N01 through N17. See navmc10132-punishments.ts. */
  code: string;
  days?: string;
  limits?: string;
  suspendedFromDuty?: boolean;
  dollars?: string;
  dollarsPerMonth?: string;
  months?: string;
  gradeReducedTo?: string;
  oralOrWritten?: '' | 'orally' | 'in writing';
}

/** One suspended punishment. Item 7. */
export interface Navmc10132Suspension {
  /**
   * Index into Navmc10132Data.punishments. A suspension is 1:1 with an
   * imposed punishment, because a punishment never imposed cannot be
   * suspended. Storing the index rather than a copy of the punishment
   * keeps the two from drifting when item 6 is edited.
   */
  punishmentIndex: number;
  /** Suspension period in months. Most suspensions are stated in months. */
  months?: string;
  /** Suspension period in days, where a command states it that way. */
  days?: string;
}

/**
 * The outcome of one Figure 14-1 notice. NOT a boolean.
 *
 * MCO 5800.16 Vol 14 Figure 14-1 paragraph 2 reads "It is my intent to
 * vacate your previously suspended punishment in: FULL/PART", and para
 * 011201 requires the accused be given an opportunity to respond BEFORE
 * the suspension may be vacated. That opportunity has to have an
 * "unresolved yet" state (`pending`) and can end in a decision NOT to
 * vacate (`not-vacated`) as well as in the two elections the figure itself
 * offers. Collapsing this to "vacated / not vacated" would misrepresent a
 * notice still awaiting the accused's response as either a vacation that
 * has not happened or one that has, when in truth nothing has been decided.
 */
export type Navmc10132VacationStatus = 'pending' | 'vacated-full' | 'vacated-part' | 'not-vacated';

/**
 * One vacation record against a suspended punishment. Decision row D-60.
 *
 * WHY THIS EXISTS. `njp-vacation-handoff.ts` generates the Figure 14-1
 * notice; `navmc10132-remarks.ts` carries the `suspension-vacated-njp`
 * remark kind that records a vacation on item 21. Nothing connected the
 * two, so a vacation reached the UPB only if a clerk remembered to
 * hand-add the remark. This record is the missing link: it is what
 * `vacationRemarks` (navmc10132-acroform.ts) derives the item 21 remark
 * from, so the remark no longer depends on anyone remembering it.
 *
 * WHY IT IS NOT "did this suspension get vacated: yes/no". Most
 * suspensions are never vacated at all; they run out and remit under MCM
 * Part V para 6.a(3). A model that only recorded yes/no would have no way
 * to distinguish "never noticed" from "noticed, and still pending" from
 * "noticed, and the commander decided not to vacate" — three different
 * facts the app must not conflate, since only the derivation reading this
 * record (not the mere existence of a suspension) can tell whether
 * anything was actually vacated. See `Navmc10132VacationStatus`.
 *
 * TARGETS A SUSPENSION BY `suspensionIndex`, NEVER `punishmentIndex`. V-31
 * (navmc10132-validators-punishment.ts) now blocks export on two item 7
 * suspensions naming the same punishmentIndex, so a suspension's own
 * position in `Navmc10132Data.suspensions` is what identifies it
 * unambiguously; `punishmentIndex` identifies a punishment, not a
 * suspension of it. See the identical note on `SuspensionPeriod` in
 * njp-suspension-period.ts.
 */
export interface Navmc10132Vacation {
  /**
   * This vacation's target: the index of the suspension in
   * `Navmc10132Data.suspensions` (equivalently, `SuspensionPeriod.suspensionIndex`
   * from njp-suspension-period.ts) that Figure 14-1 was served against.
   */
  suspensionIndex: number;
  /**
   * ISO. The date the Figure 14-1 notice was SERVED on the accused.
   *
   * THIS IS NOT "the commencement of the vacation proceedings" from JAGMAN
   * 0118.c/0118.d, and is deliberately never named or documented as such.
   * JAGMAN 0118.c interrupts a suspension's running period on
   * "commencement of proceedings to vacate", and 0118.d requires the
   * vacating order within ten working days of "the commencement of the
   * vacation proceedings" — but no source in this codebase equates
   * "commencement of proceedings" with "the date the notice was served",
   * and it would be easy but wrong to assume Figure 14-1 going out IS the
   * commencement date. This field records only the fact it is named for.
   * A future rule that needs "commencement of proceedings" must state that
   * assumption explicitly at its own call site; it must not read this
   * field and treat it as already having done so.
   */
  noticeServedDate: string;
  /** See `Navmc10132VacationStatus`. */
  status: Navmc10132VacationStatus;
  /**
   * ISO. The date `status` was decided, i.e. the date the commander acted
   * on the accused's response (or non-response) to the notice. Unset while
   * `status` is `'pending'`, since nothing has been decided yet to date.
   */
  outcomeDate?: string;
  /**
   * What was actually vacated. REQUIRED, in substance, when `status` is
   * `'vacated-part'` — "in part" with nothing named is an incomplete
   * record, and `navmc10132-v32-` (navmc10132-validators-punishment.ts)
   * blocks export on a partial vacation missing this. Unused, and ignored
   * by the derivation, for the other three statuses: a full vacation
   * already names the whole suspended punishment through `suspensionIndex`,
   * and neither `pending` nor `not-vacated` vacated anything to describe.
   */
  vacatedDetail?: string;
  /**
   * ISO. The date Article 31, UCMJ rights were read to the accused for THIS
   * vacation action. Decision row D-54.
   *
   * NOT A FIGURE 14-1 FIELD. JAGMAN (JAGINST 5800.7G CH-2) para 0118.d
   * requires the reading but Figure 14-1 prints no line for it and this
   * codebase never adds content a source figure does not carry (see D-48).
   * The fact still has to live somewhere or the app cannot check the one
   * thing 0118.d actually orders checked: SEQUENCE. So it lives here, on
   * the record of the vacation action itself, app-side and unprinted, the
   * same posture as `accusedYearsOfService` and `forfeitureBasisGrade`
   * above.
   *
   * WHY THIS FIELD MAKES W-18 ACTIONABLE RATHER THAN PERMANENT NOISE. Before
   * D-60, a rights-advisement warning with nothing to record against and no
   * way to clear it was rejected outright as training clerks to ignore
   * warnings. This field is the acknowledgment: enter the date rights were
   * read, and `navmc10132-w18-rights-not-recorded-*`
   * (navmc10132-validators-punishment.ts) stops firing for this record. A
   * second, distinct rule then checks what this field actually says: 0118.d
   * requires the reading BEFORE the commander asks whether the accused
   * wishes to make a statement, and Figure 14-1, the notice of intent, IS
   * that ask, so `navmc10132-w18-rights-after-notice-*` compares this date
   * against `noticeServedDate` and warns when rights were read on or after
   * it rather than before.
   *
   * WHY BOTH SIDES OF THIS ARE 'warn', NEVER 'block'. Per D-49 the app
   * gates only on the suspension DATE WINDOW; it has no way to know whether
   * a given vacation's basis is misconduct (JAGMAN 0118.d's trigger) or a
   * bare condition-of-suspension violation that JAGMAN 0118.d does not
   * reach at all. Both W-18 sub-rules therefore name the condition rather
   * than assert it. And even where 0118.d plainly applies, the app is
   * recording HISTORY: blocking export on a wrong-order or unrecorded
   * reading would trap a clerk from memorializing what already happened,
   * and refusing the export cannot un-read the rights either way. See W-19
   * in docs/NAVMC_10132_SPEC.md for the identical reasoning applied to the
   * ten-working-day order deadline.
   *
   * Unset is the ordinary state for most existing records, including every
   * fixture in tests/navmc10132-vacation.test.ts predating this field; nothing
   * here treats an unset value as anything other than "not yet recorded."
   */
  article31RightsReadDate?: string;
  /**
   * ISO. The date the UCMJ offense, or JAGMAN 0118.d "violation of the
   * conditions of suspension," that triggers THIS vacation was committed.
   * Decision row D-49.
   *
   * MCO 5800.16 Vol 14 para 011201, verbatim: "Vacation of suspension may
   * only be based on an offense under the UCMJ committed during the period
   * of suspension." JAGMAN (JAGINST 5800.7G CH-2) para 0118.d words the
   * same window more broadly, over "a violation of the conditions of
   * suspension." Both sources word the WINDOW identically; they disagree
   * only on the NATURE of what may trigger a vacation inside it, and this
   * codebase cannot tell a UCMJ offense apart from a bare conditions
   * violation from the data it holds. So this field records only the DATE,
   * never a characterization of what happened, and `navmc10132-v29-`
   * (navmc10132-validators-punishment.ts) and its W-21 companion test only
   * the date window, per D-49's ruling. Naming the nature of the basis is
   * left to `vacatedDetail` or the record's own free text, never inferred
   * from this field.
   *
   * NOT `noticeServedDate`. That field is when Figure 14-1 was served on
   * the accused, an action the commander takes; this field is when the
   * accused's own triggering conduct occurred, ordinarily well before the
   * notice. Comparing the wrong one against the suspension window would
   * silently test the wrong fact.
   *
   * Unset is the ordinary state for a record predating this field, same
   * posture as `article31RightsReadDate`: nothing here treats an unset
   * value as anything other than "not yet recorded," and both
   * `navmc10132-v29-` and its W-21 companion stay silent rather than guess.
   */
  offenceDate?: string;
  /**
   * Pay grade, e.g. 'O5', of the commander who actually vacates this
   * suspension. Decision row D-56.
   *
   * MCO 5800.16 Vol 14 para 011201, verbatim: "A suspended NJP may be
   * vacated by any commander authorized to impose upon the accused
   * punishment of the kind and amount to be vacated." THE VACATING
   * COMMANDER IS NOT NECESSARILY THE IMPOSING COMMANDER, so item 8A
   * (`njpAuthorityGrade` / `njpAuthorityPayGrade`) is the WRONG source for
   * this fact and must never be read in its place. JAGMAN (JAGINST
   * 5800.7G CH-2) para 0118.a defines "successor in command" by reference
   * to U.S. Navy Regulation 1026 and expressly does NOT limit it to the
   * next succeeding officer, so this is a grade recorded on the vacation
   * record itself, free text over a rank, not a pick from a chain of
   * command this app knows or can compute.
   *
   * FEEDS `navmc10132-v30-` (navmc10132-validators-punishment.ts), which
   * checks this grade against the suspended punishment's own required
   * authority using the identical `authoritySatisfies` machinery W-05 uses
   * for item 8A. That rule, and its W-22 "cannot determine" companion,
   * apply ONLY to a `'vacated-full'` record: for `'vacated-part'`,
   * `vacatedDetail` names what was vacated as free text this codebase
   * cannot parse into a legal figure, so no rule reading this field may
   * treat the whole punishment's requirement as a stand-in for a partial
   * one. See both rules' own JSDoc for the full reasoning.
   *
   * Unset is the ordinary state for a record predating this field. Neither
   * V-30 nor W-22 treats an unset value as anything other than "not yet
   * recorded" or "cannot yet be checked."
   */
  vacatingAuthorityGrade?: string;
}

/** A structured item 21 entry. Phase 2's composer renders these. */
export interface Navmc10132Remark {
  /** ISO. Rendered YYYY-MM-DD, matching the instruction's own prefix. */
  date: string;
  kind: Navmc10132RemarkKind;
  /** The parameterised portion, e.g. the recommendation or the reason. */
  detail: string;
}

export interface Navmc10132Data {
  // Items 17 to 20 - accused and unit
  unit: string;
  accusedName: string;
  /**
   * Whose rank vocabulary item 19 draws from. The form's page 3 note fixes a
   * CLOSED list of Marine ranks and sends every other service to its own
   * abbreviations, requiring the RATING abbreviation for Navy petty officers.
   * So the picker has to know the service before it can offer anything.
   * Not printed on its own, item 19 carries the composed result.
   */
  accusedService?: Navmc10132Service;
  accusedRankGrade: string;
  accusedEdipi: string;
  /**
   * App-side, not printed. Pay grade alone, e.g. 'E5'. Drives warning W-08:
   * Marines at E-6 or above and Sailors at E-7 or above may not be reduced in
   * paygrade (MCO 5800.16 Vol 14 para 010302.C).
   */
  accusedPayGrade: string;
  /**
   * App-side, NOT PRINTED. The NAVMC 10132 has no years-of-service box, so
   * this appears nowhere on the exported form and nothing in the acroform
   * writer may reference it.
   *
   * WHY IT IS COLLECTED. Forfeiture is a dollar figure computed from BASIC
   * PAY, and MCM Part V para 5.c(8) defines basic pay as "the basic pay fixed
   * by statute for the grade and length of service of the person concerned."
   * Length of service is this field. Pay grade alone does not determine a rate.
   *
   * WHAT IT DOES NOT DO YET. The app holds no pay table, so nothing computes
   * or clamps a forfeiture ceiling from this. It is the input half only, per
   * Stephen's 2026-08-24 ruling. Do not add a computation that silently
   * assumes a rate.
   */
  accusedYearsOfService?: string;
  /**
   * Monthly sea duty or hardship duty pay, whole dollars. App-side, NOT
   * PRINTED, and 0 or blank for most Marines.
   *
   * Collected because JAGMAN 0111.i fixes the forfeiture base: "Pay subject to
   * forfeiture refers only to basic pay, plus sea duty or hardship duty pay."
   * Omitting it does not make a ceiling conservative, it makes it WRONG in the
   * direction that refuses a lawful forfeiture, so the app states plainly when
   * it has computed on basic pay alone.
   */
  accusedSeaHardshipDutyPay?: string;

  // Items 1 and 5 - offenses and findings. The form has exactly five rows.
  offenses: Navmc10132Offense[];

  // Item 2 - accused election
  /**
   * Whether the accused is attached to or embarked in a vessel, so the
   * vessel exception applies and the right to demand trial does not.
   *
   * SEPARATE FROM `demand` on purpose. This is a fact about the Marine's
   * status, known before anything is served. `demand` is the accused's
   * answer, recorded after. The A-1-c versus A-1-d choice has to be made
   * BEFORE the accused elects anything, so it reads this rather than
   * inferring status from a not-yet-made election.
   */
  vesselException?: boolean;
  demand: Navmc10132Demand;
  counselOpportunity: '' | 'have' | 'have not';
  accusedRefusedToSign: boolean;
  electionDate: string;
  /**
   * DERIVED by Phase 2's bookerStatement(), never user-edited. Stored so the
   * live preview and the emitter cannot disagree. The blank ships with the
   * ACCEPTANCE text already in the field and rewrites it only through on-blur
   * JavaScript the app cannot run, so leaving this underived produces a UPB
   * that falsely states the accused accepted NJP. Spec defect 3.2.
   */
  bookerStatement?: string;

  // Item 3 - CO certification of rights
  rightsAttestDate: string;

  // Item 4 - unauthorised absence and marks of desertion
  unauthorizedAbsences: string;

  // Items 6 and 7 - punishment
  punishments: Navmc10132PunishmentEntry[];
  /**
   * Pay grade the forfeiture in item 6 was computed on. App-side, not printed.
   *
   * Exists because of MCM Part V para 5.c(8): "If the punishment includes both
   * reduction, whether or not suspended, and forfeiture of pay, the forfeiture
   * must be based on the grade to which reduced." Without a recorded basis the
   * rule is unauditable, since the printed item 6 shows only a dollar figure
   * and the grade it came from is invisible. Validator V-18 blocks export when
   * this does not match the reduction target. It records the CLERK's basis,
   * and no part of the app verifies the arithmetic against a pay table.
   */
  forfeitureBasisGrade?: string;
  punishmentDate: string;
  /** DERIVED by Phase 2's renderPunishment(). The item 6 string. */
  punishmentImposed?: string;
  /**
   * App-side, not a printed field of its own. Whether the selected
   * punishments run concurrently. A property of the SET rather than of any
   * one code, because MCM Part V para 5.d governs how punishments combine.
   * Feeds renderPunishment's concurrent option, which appends the
   * "to run concurrently" clause the MCO's own combination example uses.
   */
  punishmentsConcurrent?: boolean;
  /**
   * TRUE when the rendered punishment exceeds item 6's capacity and the field
   * carries "See Supplemental Page" with the full text in item 21. The MCO's
   * own combination example is 160 characters against a 123-character field.
   */
  punishmentOverflowToItem21?: boolean;
  suspension: string;
  /**
   * Item 7, structured. Each entry names an index into `punishments` plus a
   * period, so a punishment never imposed cannot be suspended. DERIVES the
   * `suspension` string above through renderSuspension(), the same
   * relationship punishments[] has to punishmentImposed.
   */
  suspensions?: Navmc10132Suspension[];
  /**
   * TRUE when the rendered item 7 text exceeds the field and carries
   * "See Supplemental Page" with the full text in item 21. Item 7 is a
   * SINGLE LINE field and clips rather than wrapping, so two suspended
   * punishments overflow it on their own. Mirrors
   * punishmentOverflowToItem21 for item 6.
   */
  suspensionOverflowToItem21?: boolean;
  /**
   * Vacation records against item 7 suspensions. Decision row D-60. See
   * `Navmc10132Vacation`. Not printed directly: `vacationRemarks`
   * (navmc10132-acroform.ts) derives the item 21 `suspension-vacated-njp`
   * remark from an EXECUTED entry here (`status` `'vacated-full'` or
   * `'vacated-part'`); a `'pending'` or `'not-vacated'` entry derives
   * nothing, because nothing was vacated.
   *
   * OWNED BY A FUTURE CUSTOM COMPONENT, NOT DynamicForm, matching every
   * other structured array on this form (`punishments`, `suspensions`,
   * `remarks`, `victims`). See the exclusion list on `Navmc10132Definition`
   * in schemas.ts. No such component exists yet; this field has no writer
   * in Phase 1 or Phase 3, and is reachable only by direct FormData
   * manipulation (tests, import) until the panel is built and browser
   * tested.
   */
  vacations?: Navmc10132Vacation[];

  // Item 8 - NJP authority
  njpAuthorityName: string;
  njpAuthorityGrade: string;
  njpAuthorityEdipi: string;
  /**
   * App-side, not printed. Pay grade alone, e.g. 'O5'. Drives warning W-05,
   * whether the selected punishment codes need field-grade authority.
   */
  njpAuthorityPayGrade: string;

  // Items 10 to 15 - notice and appeal
  dispositionNoticeDate: string;
  appealAdvisementDate: string;
  intendAppeal: Navmc10132AppealIntent;
  appealIntentDate: string;
  notAppealed: boolean;
  appealDate: string;
  appealDecision: string;
  appealDecisionDate: string;
  appealDecisionNoticeDate: string;

  // Item 16 - final administrative action
  finalAdminUd: string;
  finalAdminDtd: string;

  // Item 21 - remarks
  remarks: Navmc10132Remark[];
  remarksFreeText: string;
  /** DERIVED by Phase 2's composeRemarks(). The assembled item 21 value. */
  remarksComposed?: string;

  // Item 22 - victim demographics. Five rows; only row A reaches the form.
  victims: Navmc10132Victim[];
}

export const NAVMC_10132_EMPTY_OFFENSE: Navmc10132Offense = {
  articleLabel: '',
  summary: '',
  finding: '',
};

export const NAVMC_10132_EMPTY_VICTIM: Navmc10132Victim = {
  status: '',
  sex: '',
  race: '',
  ethnicity: '',
};

export function createEmptyNavmc10132Data(): Navmc10132Data {
  return {
    unit: '',
    accusedName: '',
    accusedService: 'USMC',
    accusedRankGrade: '',
    accusedEdipi: '',
    accusedPayGrade: '',
    offenses: Array.from({ length: 5 }, () => ({ ...NAVMC_10132_EMPTY_OFFENSE })),
    vesselException: false,
    demand: '',
    counselOpportunity: '',
    accusedRefusedToSign: false,
    electionDate: '',
    rightsAttestDate: '',
    unauthorizedAbsences: '',
    punishments: [],
    punishmentDate: '',
    punishmentsConcurrent: false,
    suspension: '',
    suspensions: [],
    suspensionOverflowToItem21: false,
    vacations: [],
    njpAuthorityName: '',
    njpAuthorityGrade: '',
    njpAuthorityEdipi: '',
    njpAuthorityPayGrade: '',
    dispositionNoticeDate: '',
    appealAdvisementDate: '',
    intendAppeal: '',
    appealIntentDate: '',
    notAppealed: false,
    appealDate: '',
    appealDecision: '',
    appealDecisionDate: '',
    appealDecisionNoticeDate: '',
    finalAdminUd: '',
    finalAdminDtd: '',
    remarks: [],
    remarksFreeText: '',
    victims: Array.from({ length: 5 }, () => ({ ...NAVMC_10132_EMPTY_VICTIM })),
  };
}
