/**
 * DD Form 1561 (DEC 2017, "Updated 20241204") AcroForm field map.
 *
 * Source: public/forms/dd-1561-blank.pdf, prepared from the official
 * esd.whs.mil file by tools/forms/prepare_dd1561.py (decrypted, XFA layer
 * removed so every viewer uses these AcroForm widgets). Names are the
 * fully qualified AcroForm names. Block numbers follow the DEC 2017
 * printing, which differs from NOV 2006 (6 and 7 swapped; certifying
 * officer is 15, its date 16). Spec: docs/DD1561_FSA_SPEC.md.
 *
 * Form quirks the filler must handle:
 *  - Block 5 (type) and the 8f / 8g "was / was not" pairs are separate
 *    checkboxes, not radio groups. The app sets exactly one of each pair.
 *  - Blocks 9b and 15d are /Sig fields, left empty for CAC signing.
 *  - Block 3 and the 8f spouse field take the 10-digit EDIPI (DoD ID);
 *    the app never collects an SSN (spec P1a).
 */

const P = 'form1[0].Page1[0].';
const P1 = `${P}part1[0].`;
const P2 = `${P}part2[0].`;
const EIGHT = `${P1}eight[0].`;

export const DD1561_FIELDS = {
  /** 1. Name of member (Last, First, Middle Initial) */
  memberName: `${P}one[0]`,
  /** 2. Grade */
  grade: `${P}two[0]`,
  /** 3. DoD ID number (EDIPI) */
  dodId: `${P}three[0]`,
  /** 4. Branch and organization */
  branchOrganization: `${P}four[0]`,

  /** 5. Type II - one of three checkboxes */
  typeFsaT: `${P1}five[0].five_FSAT[0]`,
  typeFsaR: `${P1}five[0].five_FSAR[0]`,
  typeFsaS: `${P1}five[0].five_FSAS[0]`,
  /** 6. Date (DDMMYY) departed residence to unit home station (mobilized members) */
  mobilizedDepartureDate: `${P1}six[0]`,
  /** 7. Complete current address(es) of dependent(s) */
  dependentAddresses: `${P1}seven[0]`,

  /** 8. Certifications */
  cert8a: `${EIGHT}eightA[0]`,
  cert8b: `${EIGHT}eightB[0]`,
  cert8c: `${EIGHT}eightC[0]`,
  cert8d: `${EIGHT}eightD[0]`,
  cert8e: `${EIGHT}eightE[0]`,
  cert8f: `${EIGHT}eightF[0]`,
  cert8fSpouseWas: `${EIGHT}eightF_info[0].was8F[0]`,
  cert8fSpouseWasNot: `${EIGHT}eightF_info[0].wasnot8F[0]`,
  /** 8f. Spouse's DoD ID number (EDIPI) */
  spouseDodId: `${EIGHT}eightF_info[0].spouse_id_num[0]`,
  spouseBranchComponent: `${EIGHT}eightF_info[0].branch_component[0]`,
  cert8g: `${EIGHT}eightG[0]`,
  cert8gLastTdyWas: `${EIGHT}was8G[0]`,
  cert8gLastTdyWasNot: `${EIGHT}wasnot8G[0]`,

  /** 9a. Member date (DDMMYY); 9b. member signature (/Sig) */
  memberSignedDate: `${P1}nineA[0]`,
  memberSignature: `${P1}nineB[0]`,

  /** 12. FSA-S commencing date (DDMMYY), ship/unit, homeport */
  fsaSCommencingDate: `${P2}Cell3[0]`,
  fsaSShipUnit: `${P2}twelveA[0]`,
  fsaSHomeport: `${P2}twelveB[0]`,

  /** 13. Orders authority and date */
  ordersAuthority: `${P2}thirteen_orders[0]`,
  ordersDated: `${P2}thirteen_dated[0]`,

  /** 15. Certifying officer; 15d is /Sig; 16. date (DDMMYY) */
  certifierName: `${P2}fifteenA[0]`,
  certifierTitle: `${P2}fifteenB[0]`,
  certifierOrganization: `${P2}fifteenC[0]`,
  certifierSignature: `${P2}fifteenD[0]`,
  certifiedDate: `${P2}signedDate[0]`,
} as const;

/** 10. FSA-T table: three rows of location, inclusive dates, number of days. */
export const DD1561_FSA_T_ROWS = [1, 2, 3].map((n) => ({
  location: `${P2}ten[0].tenA_line${n}[0]`,
  inclusiveDates: `${P2}ten[0].tenB_line${n}[0]`,
  days: `${P2}ten[0].tenC_line${n}[0]`,
}));

/** 11. FSA-R line: last PDS, detach date, leave dates, proceed dates, new PDS, report date. */
export const DD1561_FSA_R = {
  lastPermanentDutyStation: `${P2}eleven[0].eleven_lastPermDutyStation[0]`,
  departedDate: `${P2}eleven[0].eleven_date1[0]`,
  leaveDates: `${P2}eleven[0].eleven_inclusiveLeaveDates[0]`,
  proceedDates: `${P2}eleven[0].eleven_inclusiveDates[0]`,
  reportedTo: `${P2}eleven[0].eleven_PDS[0]`,
  reportedDate: `${P2}eleven[0].eleven_date2[0]`,
} as const;

/** Every field name the app fills or leaves for signature, in one list. */
export const DD1561_ALL_FIELD_NAMES: readonly string[] = [
  ...Object.values(DD1561_FIELDS),
  ...DD1561_FSA_T_ROWS.flatMap((r) => [r.location, r.inclusiveDates, r.days]),
  ...Object.values(DD1561_FSA_R),
];
