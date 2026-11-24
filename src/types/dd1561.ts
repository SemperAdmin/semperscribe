// --- DD Form 1561 (DEC 2017) Statement to Substantiate Payment of FSA ---
// Rule source: docs/DD1561_FSA_SPEC.md and DoD FMR Vol 7A Ch 27 (Oct 2025).
// Field map: src/lib/dd1561-fields.ts. Rules: src/lib/dd1561-rules.ts.
//
// Every key carries the `dd1561` prefix, so no value leaks in from another
// form when the drafter switches document type (NAVMC 11106 also uses
// `grade` / `edipi`). Keys live flat on FormData, like NAVMC 11106.
//
// Conventions (binding for Phases 3 and 4):
//  - Dates are ISO yyyy-mm-dd strings in state; '' means not entered. The
//    form prints them DDMMYY (dd1561-rules.ts toDdmmyy).
//  - A yes/no question is `boolean | undefined`: undefined means not yet
//    answered, which the rules treat differently from an explicit false.
//  - Identifiers are the 10-digit EDIPI (DoD ID). The app never collects,
//    stores or prints an SSN (spec P1a).
//  - No dollar amount is modelled anywhere (spec P4.3).

export const DD1561_FSA_TYPES = ['T', 'R', 'S'] as const;
/** Block 5. T = Temporary (TDY/TAD), R = Restricted (PCS), S = Ship. */
export type Dd1561FsaType = (typeof DD1561_FSA_TYPES)[number];

export const DD1561_MARITAL_STATUSES = ['married', 'never-married', 'divorced', 'legally-separated', 'widowed'] as const;
export type Dd1561MaritalStatus = (typeof DD1561_MARITAL_STATUSES)[number];

/**
 * Who has legal custody of the member's child(ren) when orders were received
 * (block 8b; FMR 2.2.1.1, 3.1.2, 3.1.3).
 *  member         - the member has legal custody
 *  joint-14-plus  - joint legal and physical custody, child resides with the member 14+ days a month (counts)
 *  joint-under-14 - joint custody, child resides with the member under 14 days a month (does not count)
 *  other-person   - legal custody of another person (does not count)
 */
export const DD1561_CHILD_CUSTODY = ['member', 'joint-14-plus', 'joint-under-14', 'other-person'] as const;
export type Dd1561ChildCustody = (typeof DD1561_CHILD_CUSTODY)[number];

/** The was / was-not pairs of blocks 8f and 8g. */
export const DD1561_WAS_WAS_NOT = ['was', 'was-not'] as const;
export type Dd1561WasWasNot = (typeof DD1561_WAS_WAS_NOT)[number];

/**
 * One block 10 row: a TDY/TAD location and its inclusive dates.
 * Rows are consecutive legs of the TDY in order. The first row's `from` is
 * the ACTUAL date the member departed the PDS and the last row's `to` the
 * ACTUAL date of return; leave is entered separately as day counts and the
 * rules turn them into constructive dates (FMR 4.4.1.2). More than three rows
 * is allowed; Phase 4 prints rows 4+ on a continuation page (form block 10).
 */
export interface Dd1561FsaTRow {
  location: string;
  /** ISO. Date this leg starts (row 1: actual departure from the PDS). */
  from: string;
  /** ISO. Date this leg ends (last row: actual return to the PDS). */
  to: string;
  /**
   * True when the TDY was interrupted between the previous row and this one:
   * the member was relieved from attachment to the TDY station or returned to
   * the PDS to assume a duty status (FMR 4.4.1.5). Days before and after an
   * interruption are never combined. Leave, hospitalization, confinement in a
   * pay status and short PDS visits are NOT interruptions. Ignored on row 1.
   */
  interruptedBefore?: boolean;
}

export const DD1561_EMPTY_FSA_T_ROW: Dd1561FsaTRow = { location: '', from: '', to: '', interruptedBefore: false };

/**
 * Status of a ship segment for the FSA-S count (FMR 2.3.1.2, 4.4.3).
 *  away                     - aboard a ship away from its homeport (incl. joining it away)
 *  remain-aboard-orders     - at homeport under orders to remain aboard (counts)
 *  remain-aboard-disciplinary - kept aboard at homeport for disciplinary reasons (does not count)
 */
export const DD1561_SHIP_SEGMENT_STATUSES = ['away', 'remain-aboard-orders', 'remain-aboard-disciplinary'] as const;
export type Dd1561ShipSegmentStatus = (typeof DD1561_SHIP_SEGMENT_STATUSES)[number];

/**
 * One continuous stretch of FSA-S duty. Consecutive segments (next `from`
 * on or the day after the previous `to`) combine into one period, which is
 * how FMR 4.4.3 Ex. 5 (two ships) and Ex. 6 (remain-aboard orders) count.
 */
export interface Dd1561ShipSegment {
  status: Dd1561ShipSegmentStatus;
  /** ISO. Day of departure from homeport, or the day the member joined the ship away from homeport. */
  from: string;
  /** ISO. Day of return to homeport or detachment; '' while still deployed. */
  to: string;
  /** Ship or unit for this segment; block 12a prints dd1561FsaSShipUnit, not this. */
  shipUnit?: string;
}

export const DD1561_EMPTY_SHIP_SEGMENT: Dd1561ShipSegment = { status: 'away', from: '', to: '', shipUnit: '' };

/** Every DD 1561 key on FormData. All optional, like the 11106 keys. */
export interface Dd1561Data {
  documentType: 'dd1561';

  // --- Member (blocks 1-4) ---
  /** 1. Name of member, LAST, FIRST MI. */
  dd1561MemberName?: string;
  /** 2. Grade, e.g. SGT or E-5. */
  dd1561Grade?: string;
  /** 3. DoD ID number, 10-digit EDIPI. Never an SSN. */
  dd1561Edipi?: string;
  /** 4. Branch and organization, e.g. "USMC, 1ST BN, 5TH MAR". */
  dd1561BranchOrganization?: string;

  // --- Type and Part I facts (blocks 5-7) ---
  /** 5. Exactly one FSA type. '' = not chosen. */
  dd1561FsaType?: '' | Dd1561FsaType;
  /** Reserve Component member mobilized to active duty (drives block 6 and the HOR note, FMR 2.3.1.3 NOTE). */
  dd1561Mobilized?: boolean;
  /** 6. ISO. Date departed residence to unit home station. Printed only when dd1561Mobilized. */
  dd1561MobilizedDepartureDate?: string;
  /** 7. Complete current address(es) of dependent(s); multi-line, one address per line. */
  dd1561DependentAddresses?: string;

  // --- Dependency facts behind blocks 8a-8e (eligibility, FMR 2.2, 3.1) ---
  dd1561MaritalStatus?: '' | Dd1561MaritalStatus;
  /** The member has one or more children they are claiming. */
  dd1561HasChildren?: boolean;
  /** Custody of the claimed child(ren). Only read when dd1561HasChildren. */
  dd1561ChildCustody?: '' | Dd1561ChildCustody;
  /** Claiming FSA for a parent (block 8e). */
  dd1561ClaimsParent?: boolean;
  /** The parent has a current, approved dependency determination (8e). */
  dd1561ParentDependencyApproved?: boolean;
  /** The parent resides in the home the member controls and maintains for mutual use (FMR 3.1.4; 8e). */
  dd1561ParentResidesWithMember?: boolean;
  /** A dependent OTHER THAN the spouse is on active duty (8c; FMR 3.1.5). */
  dd1561DependentOnActiveDuty?: boolean;
  /** The sole dependent is in an institution for a known or expected period over 1 year (8d; FMR 3.1.1). */
  dd1561SoleDependentInstitutionalized?: boolean;
  /**
   * All dependents live at or near the duty location this claim is about
   * (50 mi / 1.5 h one way, or the member actually commutes; FMR 3.3): the PDS
   * for FSA-R, the TDY station for FSA-T, the port the ship is in for FSA-S.
   */
  dd1561AllDependentsNear?: boolean;

  // --- Member married to member (block 8f; FMR 2.3.4) ---
  dd1561DualMilitary?: boolean;
  /** 8f. Spouse's 10-digit EDIPI. Required only when dd1561DualMilitary. */
  dd1561SpouseEdipi?: string;
  /** 8f. Spouse's branch and component, e.g. "USN ACTIVE". */
  dd1561SpouseBranchComponent?: string;
  /** 8f. Spouse was / was not residing with the member immediately before separation by orders. */
  dd1561SpouseResidingTogether?: '' | Dd1561WasWasNot;
  /** The spouse is already entitled to FSA for the same period (one FSA per couple without other dependents, FMR 2.3.4.1.1). */
  dd1561SpouseReceivingFsa?: boolean;

  // --- Orders and type-specific eligibility facts ---
  /** Duty is under permissive orders (no FSA, FMR 1.1, 4.1.1.3). */
  dd1561PermissiveOrders?: boolean;
  /** FSA-R: transportation of dependents to or near the new PDS IS authorized at government expense. */
  dd1561FsaRTransportAuthorized?: boolean;
  /** FSA-R: the member elected an unaccompanied tour where an accompanied tour is authorized (FMR 4.1.3.1). */
  dd1561FsaRElectedUnaccompanied?: boolean;
  /** FSA-R: a dependent cannot accompany for certified medical reasons (FMR 2.3.1.1.2, 4.1.1.2). */
  dd1561FsaRCertifiedMedical?: boolean;
  /** FSA-R: a Secretarial waiver for unusual family or operational circumstances was granted (FMR 4.1.3.1, 4.1.4). */
  dd1561FsaRSecretarialWaiver?: boolean;

  // --- Block 8g: last TDY or deployment within 30 days (FMR 4.4.2, 4.4.4) ---
  dd1561LastTdyWithin30?: '' | Dd1561WasWasNot;
  /** Type of the prior period, when 8g is 'was'. TDY and ship periods never combine (FMR 4.4.5.1). */
  dd1561PriorPeriodType?: '' | 'T' | 'S';
  /** ISO. First counted day of the prior TDY / deployment (constructive where leave applied). */
  dd1561PriorPeriodFrom?: string;
  /** ISO. Last counted day of the prior TDY / deployment (day of return to PDS / homeport). */
  dd1561PriorPeriodTo?: string;

  /** 9a. ISO. Date the member signs. 9b (signature) is never modelled. */
  dd1561MemberSignedDate?: string;

  // --- Part II block 10: FSA-T ---
  dd1561FsaTRows?: Dd1561FsaTRow[];
  /** Days of leave, proceed time and permissive travel used after detachment, before travel to the TDY (FMR 4.4.1.2.1). */
  dd1561FsaTLeaveBeforeDays?: number;
  /** Days of leave and permissive travel used before the actual return to the PDS (FMR 4.4.1.2.2). */
  dd1561FsaTLeaveAfterDays?: number;
  /** ISO, optional. First day of authorized travel; the constructive departure is never earlier (FMR 4.4.1.2.1). */
  dd1561FsaTFirstTravelDate?: string;

  // --- Part II block 11: FSA-R ---
  dd1561FsaRLastPds?: string;
  /** ISO. Date departed (PCS / detached) from the last PDS. */
  dd1561FsaRDetachDate?: string;
  dd1561FsaRLeaveFrom?: string;
  dd1561FsaRLeaveTo?: string;
  dd1561FsaRProceedFrom?: string;
  dd1561FsaRProceedTo?: string;
  /** ISO, optional. First day of authorized travel (Table 27-1 rule 2). Not printed. */
  dd1561FsaRFirstTravelDate?: string;
  dd1561FsaRNewPds?: string;
  /** ISO. Date reported to the new PDS. */
  dd1561FsaRReportDate?: string;

  // --- Part II block 12: FSA-S ---
  /** Segments in order; block 12's commencing date is the first segment's `from`. */
  dd1561FsaSSegments?: Dd1561ShipSegment[];
  /** 12a. Name of ship / unit (an embarked unit may be named). */
  dd1561FsaSShipUnit?: string;
  /** 12b. Homeport. */
  dd1561FsaSHomeport?: string;

  // --- Part II blocks 13-14 ---
  /** 13. Orders number or authority. */
  dd1561OrdersAuthority?: string;
  /** 13. ISO. Date of the orders. */
  dd1561OrdersDate?: string;
  /** 14. The drafter confirms the member draws BAH (or occupies government quarters) as a member with dependents / married to a member. */
  dd1561BahWithDependentsConfirmed?: boolean;

  // --- Part II blocks 15a-c, 16: OPTIONAL, never required, never defaulted ---
  dd1561CertifierName?: string;
  dd1561CertifierTitle?: string;
  dd1561CertifierOrganization?: string;
  /** 16. ISO. */
  dd1561CertifiedDate?: string;
}

/** A fresh DD 1561: one empty FSA-T row and one empty ship segment, nothing answered. */
export function createDd1561Defaults(): Dd1561Data {
  return {
    documentType: 'dd1561',
    dd1561MemberName: '',
    dd1561Grade: '',
    dd1561Edipi: '',
    dd1561BranchOrganization: '',
    dd1561FsaType: '',
    dd1561MobilizedDepartureDate: '',
    dd1561DependentAddresses: '',
    dd1561MaritalStatus: '',
    dd1561ChildCustody: '',
    dd1561SpouseEdipi: '',
    dd1561SpouseBranchComponent: '',
    dd1561SpouseResidingTogether: '',
    dd1561LastTdyWithin30: '',
    dd1561PriorPeriodType: '',
    dd1561PriorPeriodFrom: '',
    dd1561PriorPeriodTo: '',
    dd1561MemberSignedDate: '',
    dd1561FsaTRows: [{ ...DD1561_EMPTY_FSA_T_ROW }],
    dd1561FsaTLeaveBeforeDays: 0,
    dd1561FsaTLeaveAfterDays: 0,
    dd1561FsaTFirstTravelDate: '',
    dd1561FsaRLastPds: '',
    dd1561FsaRDetachDate: '',
    dd1561FsaRLeaveFrom: '',
    dd1561FsaRLeaveTo: '',
    dd1561FsaRProceedFrom: '',
    dd1561FsaRProceedTo: '',
    dd1561FsaRFirstTravelDate: '',
    dd1561FsaRNewPds: '',
    dd1561FsaRReportDate: '',
    dd1561FsaSSegments: [{ ...DD1561_EMPTY_SHIP_SEGMENT }],
    dd1561FsaSShipUnit: '',
    dd1561FsaSHomeport: '',
    dd1561OrdersAuthority: '',
    dd1561OrdersDate: '',
    dd1561CertifierName: '',
    dd1561CertifierTitle: '',
    dd1561CertifierOrganization: '',
    dd1561CertifiedDate: '',
  };
}
