/**
 * NAVMC 10132 text-field geometry, the minimum needed to measure fit.
 *
 * GENERATED from tools/aa-forms/navmc10132-map.json by
 * tools/aa-forms/gen_navmc10132_metrics.py. Do not hand-edit.
 *
 * The full map is 134KB and carries the decoded PDF JavaScript, which has no
 * business in a client bundle. This module carries only the four numbers a
 * width check needs, for the 32 text fields.
 *
 * Rule source: docs/NAVMC_10132_SPEC.md section 2.2.
 */

export interface Navmc10132FieldMetric {
  /** Widget width in points. */
  width: number;
  /** Point size from the widget's own /DA. Every field on this form is 8pt. */
  fontSize: number;
  /** Usable lines. 1 for every field except item 21. */
  lines: number;
  multiline: boolean;
}

export const NAVMC_10132_FIELD_METRICS: Readonly<Record<string, Navmc10132FieldMetric>> = {
  '1A SUMMARY': { width: 302.4, fontSize: 8.0, lines: 1, multiline: false },
  '1B SUMMARY': { width: 302.4, fontSize: 8.0, lines: 1, multiline: false },
  '1C SUMMARY': { width: 302.4, fontSize: 8.0, lines: 1, multiline: false },
  '1D SUMMARY': { width: 302.4, fontSize: 8.0, lines: 1, multiline: false },
  '1E SUMMARY': { width: 302.4, fontSize: 8.0, lines: 1, multiline: false },
  '17 UNIT': { width: 538.17, fontSize: 8.0, lines: 1, multiline: false },
  '18 ACCUSED FULL NAME': { width: 358.56, fontSize: 8.0, lines: 1, multiline: false },
  '19 ACCUSED RANK/GRADE': { width: 88.3, fontSize: 8.0, lines: 1, multiline: false },
  '20 ACCUSED EDIPI': { width: 88.44, fontSize: 8.0, lines: 1, multiline: false },
  '2 ACC ELECTION AND RIGHTS DATE_af_date': { width: 94.56, fontSize: 8.0, lines: 1, multiline: false },
  '3 RIGHTS ATTEST DATE_af_date': { width: 94.56, fontSize: 8.0, lines: 1, multiline: false },
  '4 CURRENT UAS OVER 24 HRS AND MARKS OF DESERTION': { width: 538.2, fontSize: 8.0, lines: 1, multiline: false },
  '6 PUNISHMENT IMPOSED': { width: 436.52, fontSize: 8.0, lines: 1, multiline: false },
  '6 PUNISHMENT IMPOSITION DATE': { width: 96.3, fontSize: 8.0, lines: 1, multiline: false },
  '7 SUSPENSION IF ANY': { width: 538.2, fontSize: 8.0, lines: 1, multiline: false },
  '8 NJP AUTHORITY NAME TITLE SERVICE': { width: 358.56, fontSize: 8.0, lines: 1, multiline: false },
  '8A NJP AUTHORITY GRADE': { width: 87.87, fontSize: 8.0, lines: 1, multiline: false },
  '8B NJP AUTHORITY EDIPI': { width: 88.44, fontSize: 8.0, lines: 1, multiline: false },
  '10 DATE OF DISPOSITION NOTICE': { width: 96.29, fontSize: 8.0, lines: 1, multiline: false },
  '11 APPEAL ADVISEMENT DATE_af_date': { width: 66.45, fontSize: 8.0, lines: 1, multiline: false },
  '12 APPEAL INTENT DATE_af_date': { width: 66.44, fontSize: 8.0, lines: 1, multiline: false },
  '13 DATE OF APPEAL IF ANY_af_date': { width: 96.29, fontSize: 8.0, lines: 1, multiline: false },
  '14 APPEAL DECISION': { width: 433.71, fontSize: 8.0, lines: 1, multiline: false },
  '14 APPEAL DECISION DATE_af_date': { width: 66.45, fontSize: 8.0, lines: 1, multiline: false },
  '15 DATE OF NOTICE OF APPEAL DECISION_af_date': { width: 96.29, fontSize: 8.0, lines: 1, multiline: false },
  '16 FINAL ADMIN UD': { width: 59.1, fontSize: 8.0, lines: 1, multiline: false },
  '16 FINAL ADMIN DTD': { width: 59.1, fontSize: 8.0, lines: 1, multiline: false },
  '2 BOOKER': { width: 527.84, fontSize: 8.0, lines: 1, multiline: false },
  '21 REMARKS': { width: 538.6, fontSize: 8.0, lines: 55, multiline: true },
  '23 ACCUSED FULL NAME': { width: 358.57, fontSize: 8.0, lines: 1, multiline: false },
  '24 ACCUSED RANK/GRADE': { width: 88.56, fontSize: 8.0, lines: 1, multiline: false },
  '25 ACCUSED EDIPI': { width: 88.55, fontSize: 8.0, lines: 1, multiline: false },
};
