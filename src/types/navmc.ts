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
