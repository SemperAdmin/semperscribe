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
  | 'additional-victims';

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
  accusedRankGrade: string;
  accusedEdipi: string;
  /**
   * App-side, not printed. Pay grade alone, e.g. 'E5'. Drives warning W-08:
   * Marines in the grade of E-6 or above may not be reduced in paygrade
   * (MCO 5800.16 Vol 14 para 010302.C).
   */
  accusedPayGrade: string;

  // Items 1 and 5 - offenses and findings. The form has exactly five rows.
  offenses: Navmc10132Offense[];

  // Item 2 - accused election
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
    accusedRankGrade: '',
    accusedEdipi: '',
    accusedPayGrade: '',
    offenses: Array.from({ length: 5 }, () => ({ ...NAVMC_10132_EMPTY_OFFENSE })),
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
