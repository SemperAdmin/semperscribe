/**
 * NAVMC 10132 punishment codes N01 through N17.
 *
 * Source: the MCTFSPRIUM punishment code table, cross-checked against
 * 10 U.S.C. 815(b) and MCM Part V para 5.b. Rule source:
 * docs/NAVMC_10132_SPEC.md section 11.3.
 *
 * Why this table exists rather than a free-text item 6: each code names its own
 * ceiling and its own required authority grade, so the export-gate checks
 * (W-05, W-06) read off the selected code instead of parsing prose. Item 6 on
 * the paper form is free text by design, and parsing it was the original plan.
 * The code table removed that need for anything the app itself composes. A
 * parser survives only on the IMPORT path.
 *
 * Three notes that are easy to get wrong:
 *
 * 1. N08 reads "reduction to the next inferior grade," which is NARROWER than
 *    10 U.S.C. 815(b)(2)(H)(iv), where a field-grade commander may reduce to
 *    the lowest or any intermediate pay grade. That is not a table defect.
 *    MCO 5800.16 Vol 14 para 010302.C narrows Marine reductions to the next
 *    inferior paygrade by policy, so N08 is USMC-correct and stricter than the
 *    statute.
 *
 * 2. TWO STATUTORY PUNISHMENTS HAVE NO CODE, and they are different findings.
 *    Three-day confinement of a member attached to or embarked in a vessel
 *    (815(b)(2)(A)) IS authorized by MCM Part V 5.b and has no code, which is a
 *    genuine gap. Detention of pay (815(b)(2)(G) and (H)(vii)) is authorized by
 *    the statute but does NOT appear in MCM Part V 5.b, so the President has
 *    not prescribed it and the missing code is CORRECT. The defect there sits
 *    in MCO 5800.16 Vol 14 para 011402.G, which makes detention of more than 14
 *    days' pay a mandatory judge-advocate review trigger for a punishment no
 *    commander may impose. The app builds nothing for detention (spec D-11).
 *
 * 3. N04 and N05 are unresolved against MCTFSPRIUM (spec D-10). N04 serves both
 *    officer-GCMCA and enlisted field grade. N05 duplicates N14 plus N15.
 *    Until the manual's narrative settles it, N05 is withheld from release one
 *    and enlisted 60-day restriction routes to N14 or N15.
 */

/** Who the punishment may be imposed upon. */
export type PunishmentAppliesTo = 'officer' | 'enlisted' | 'either';

/**
 * Minimum authority required to impose.
 *   'any'         - any nonjudicial punishment authority
 *   'field-grade' - commanding officer of the grade of major or lieutenant
 *                   commander or above, or a principal assistant
 *   'gcmca'       - officer exercising general court-martial jurisdiction, an
 *                   officer of general or flag rank in command, or a principal
 *                   assistant
 */
export type PunishmentAuthority = 'any' | 'field-grade' | 'gcmca';

/** Values the UI collects for a selected code. */
export type PunishmentParameter =
  | 'days'
  | 'limits'
  | 'suspendedFromDuty'
  | 'dollars'
  | 'dollarsPerMonth'
  | 'months'
  | 'gradeReducedTo'
  | 'oralOrWritten';

export interface Navmc10132Punishment {
  code: string;
  /** MCTFSPRIUM description, verbatim. */
  description: string;
  /** Controlling subsection of 10 U.S.C. 815(b). */
  statute: string;
  appliesTo: PunishmentAppliesTo;
  requiredAuthority: PunishmentAuthority;
  /** Maximum consecutive days, where the code names one. */
  maxDays?: number;
  /** Maximum months of forfeiture, where the code names one. */
  maxMonths?: number;
  /** Maximum days' pay forfeited, where the code names one. */
  maxDaysPay?: number;
  parameters: readonly PunishmentParameter[];
  /**
   * Template for the item 6 string, using the eleven abbreviations authorised
   * by the form's own instruction page. Phase 2's renderPunishment() does the
   * interpolation. Placeholders in braces match the parameter names, plus
   * {suspClause} which resolves to 'w/susp fr du' or 'w/o susp fr du', and
   * {totalForf} which is dollarsPerMonth times months.
   */
  template: string;
  /**
   * FALSE means the app refuses the code in release one. N01 to N03 are
   * officer-only and release one is enlisted. N05 is withheld pending D-10.
   */
  releaseOneAvailable: boolean;
  /** Shown in the picker when the code is unavailable. */
  unavailableReason?: string;
}

const OFFICER_ONLY =
  'Officer punishment under 10 U.S.C. 815(b)(1). Release one is enlisted only.';

export const NAVMC_10132_PUNISHMENTS: readonly Navmc10132Punishment[] = [
  {
    code: 'N01',
    description:
      'RESTRICTION TO SPECIFIED LIMITS WITH SUSPENSION FROM DUTY FOR NOT MORE THAN 30 CONSECUTIVE DAYS',
    statute: '10 U.S.C. 815(b)(1)(A)',
    appliesTo: 'officer',
    requiredAuthority: 'any',
    maxDays: 30,
    parameters: ['limits', 'days'],
    template: 'Restr to the limits of {limits} for {days} days, w/susp fr du.',
    releaseOneAvailable: false,
    unavailableReason: OFFICER_ONLY,
  },
  {
    code: 'N02',
    description:
      'RESTRICTION TO SPECIFIED LIMITS WITHOUT SUSPENSION FROM DUTY FOR NOT MORE THAN 30 CONSECUTIVE DAYS',
    statute: '10 U.S.C. 815(b)(1)(A)',
    appliesTo: 'officer',
    requiredAuthority: 'any',
    maxDays: 30,
    parameters: ['limits', 'days'],
    template: 'Restr to the limits of {limits} for {days} days, w/o susp fr du.',
    releaseOneAvailable: false,
    unavailableReason: OFFICER_ONLY,
  },
  {
    code: 'N03',
    description: 'ARREST IN QUARTERS FOR NOT MORE THAN 30 CONSECUTIVE DAYS',
    statute: '10 U.S.C. 815(b)(1)(B)(i)',
    appliesTo: 'officer',
    requiredAuthority: 'gcmca',
    maxDays: 30,
    parameters: ['days'],
    template: 'Arrest in quarters for {days} days.',
    releaseOneAvailable: false,
    unavailableReason: OFFICER_ONLY,
  },
  {
    code: 'N04',
    description:
      "FORFEITURE OF NOT MORE THAN ONE-HALF OF ONE MONTH'S PAY PER MONTH FOR TWO MONTHS",
    // Serves BOTH officer-GCMCA and enlisted field grade. Spec D-10.
    statute: '10 U.S.C. 815(b)(1)(B)(ii) and 815(b)(2)(H)(iii)',
    appliesTo: 'either',
    requiredAuthority: 'field-grade',
    maxMonths: 2,
    parameters: ['dollarsPerMonth', 'months'],
    template:
      'Forf of ${dollarsPerMonth} pay per month for {months} months. Total forf ${totalForf}.',
    releaseOneAvailable: true,
  },
  {
    code: 'N05',
    description:
      'RESTRICTION TO SPECIFIED LIMITS, WITH OR WITHOUT SUSPENSION FROM DUTY, FOR NOT MORE THAN 60 CONSECUTIVE DAYS',
    statute: '10 U.S.C. 815(b)(1)(B)(iii) or 815(b)(2)(H)(vi)',
    appliesTo: 'either',
    requiredAuthority: 'gcmca',
    maxDays: 60,
    parameters: ['limits', 'days', 'suspendedFromDuty'],
    template: 'Restr to the limits of {limits} for {days} days, {suspClause}.',
    releaseOneAvailable: false,
    unavailableReason:
      'Withheld pending spec decision D-10. N05 duplicates N14 plus N15 for enlisted members. Use N14 or N15 for a 60-day restriction.',
  },
  {
    code: 'N06',
    description: 'CORRECTIONAL CUSTODY FOR NOT MORE THAN 7 CONSECUTIVE DAYS',
    statute: '10 U.S.C. 815(b)(2)(B)',
    appliesTo: 'enlisted',
    requiredAuthority: 'any',
    maxDays: 7,
    parameters: ['days', 'suspendedFromDuty'],
    template: 'Corr cust for {days} days {suspClause}.',
    releaseOneAvailable: true,
  },
  {
    code: 'N07',
    description: "FORFEITURE OF NOT MORE THAN 7 DAYS' PAY",
    statute: '10 U.S.C. 815(b)(2)(C)',
    appliesTo: 'enlisted',
    requiredAuthority: 'any',
    maxDaysPay: 7,
    parameters: ['dollars'],
    template: 'Forf of ${dollars} pay.',
    releaseOneAvailable: true,
  },
  {
    code: 'N08',
    description: 'REDUCTION TO THE NEXT INFERIOR GRADE',
    // Narrower than 815(b)(2)(H)(iv) by USMC policy. See header note 1.
    statute: '10 U.S.C. 815(b)(2)(D); MCO 5800.16 Vol 14 para 010302.C',
    appliesTo: 'enlisted',
    requiredAuthority: 'any',
    parameters: ['gradeReducedTo'],
    template: 'To be red to {gradeReducedTo}.',
    releaseOneAvailable: true,
  },
  {
    code: 'N09',
    description:
      'EXTRA DUTIES, INCLUDING FATIGUE OR OTHER DUTIES, FOR NOT MORE THAN 14 CONSECUTIVE DAYS',
    statute: '10 U.S.C. 815(b)(2)(E)',
    appliesTo: 'enlisted',
    requiredAuthority: 'any',
    maxDays: 14,
    parameters: ['days'],
    template: 'Extra du for {days} days.',
    releaseOneAvailable: true,
  },
  {
    code: 'N10',
    description:
      'RESTRICTION TO SPECIFIED LIMITS WITH SUSPENSION FROM DUTY FOR NOT MORE THAN 14 CONSECUTIVE DAYS',
    statute: '10 U.S.C. 815(b)(2)(F)',
    appliesTo: 'enlisted',
    requiredAuthority: 'any',
    maxDays: 14,
    parameters: ['limits', 'days'],
    template: 'Restr to the limits of {limits} for {days} days, w/susp fr du.',
    releaseOneAvailable: true,
  },
  {
    code: 'N11',
    description:
      'RESTRICTION TO SPECIFIED LIMITS WITHOUT SUSPENSION FROM DUTY FOR NOT MORE THAN 14 CONSECUTIVE DAYS',
    statute: '10 U.S.C. 815(b)(2)(F)',
    appliesTo: 'enlisted',
    requiredAuthority: 'any',
    maxDays: 14,
    parameters: ['limits', 'days'],
    template: 'Restr to the limits of {limits} for {days} days, w/o susp fr du.',
    releaseOneAvailable: true,
  },
  {
    code: 'N12',
    description: 'CORRECTIONAL CUSTODY FOR NOT MORE THAN 30 CONSECUTIVE DAYS',
    statute: '10 U.S.C. 815(b)(2)(H)(ii)',
    appliesTo: 'enlisted',
    requiredAuthority: 'field-grade',
    maxDays: 30,
    parameters: ['days', 'suspendedFromDuty'],
    template: 'Corr cust for {days} days {suspClause}.',
    releaseOneAvailable: true,
  },
  {
    code: 'N13',
    description:
      'EXTRA DUTIES, INCLUDING FATIGUE OR OTHER DUTIES, FOR NOT MORE THAN 45 CONSECUTIVE DAYS',
    statute: '10 U.S.C. 815(b)(2)(H)(v)',
    appliesTo: 'enlisted',
    requiredAuthority: 'field-grade',
    maxDays: 45,
    parameters: ['days'],
    template: 'Extra du for {days} days.',
    releaseOneAvailable: true,
  },
  {
    code: 'N14',
    description:
      'RESTRICTION TO SPECIFIED LIMITS WITH SUSPENSION FROM DUTY FOR NOT MORE THAN 60 CONSECUTIVE DAYS',
    statute: '10 U.S.C. 815(b)(2)(H)(vi)',
    appliesTo: 'enlisted',
    requiredAuthority: 'field-grade',
    maxDays: 60,
    parameters: ['limits', 'days'],
    template: 'Restr to the limits of {limits} for {days} days, w/susp fr du.',
    releaseOneAvailable: true,
  },
  {
    code: 'N15',
    description:
      'RESTRICTION TO SPECIFIED LIMITS WITHOUT SUSPENSION FROM DUTY FOR NOT MORE THAN 60 CONSECUTIVE DAYS',
    statute: '10 U.S.C. 815(b)(2)(H)(vi)',
    appliesTo: 'enlisted',
    requiredAuthority: 'field-grade',
    maxDays: 60,
    parameters: ['limits', 'days'],
    template: 'Restr to the limits of {limits} for {days} days, w/o susp fr du.',
    releaseOneAvailable: true,
  },
  {
    code: 'N16',
    description: 'ADMONITION',
    statute: '10 U.S.C. 815(b), opening clause',
    appliesTo: 'either',
    requiredAuthority: 'any',
    parameters: ['oralOrWritten'],
    template: 'To be {oralOrWritten} admonished.',
    releaseOneAvailable: true,
  },
  {
    code: 'N17',
    description: 'REPRIMAND',
    statute: '10 U.S.C. 815(b), opening clause',
    appliesTo: 'either',
    requiredAuthority: 'any',
    parameters: ['oralOrWritten'],
    template: 'To be {oralOrWritten} reprimanded.',
    releaseOneAvailable: true,
  },
] as const;

const BY_CODE = new Map<string, Navmc10132Punishment>(
  NAVMC_10132_PUNISHMENTS.map((p) => [p.code, p])
);

export function resolvePunishment(code: string): Navmc10132Punishment | undefined {
  return BY_CODE.get(code);
}

/** Codes offered in the release-one picker. */
export const NAVMC_10132_RELEASE_ONE_PUNISHMENTS: readonly Navmc10132Punishment[] =
  NAVMC_10132_PUNISHMENTS.filter((p) => p.releaseOneAvailable);

/**
 * Pay-grade ordering used to decide whether the item 8A authority satisfies a
 * code's requiredAuthority. Field grade begins at O4 (major). GCMCA authority
 * is a billet rather than a grade, so it cannot be inferred from 8A alone and
 * is surfaced as a warning rather than a block.
 */
export function authoritySatisfies(
  required: PunishmentAuthority,
  authorityPayGrade: string
): boolean | 'unknown' {
  if (required === 'any') return true;
  const match = /^O(\d+)/i.exec(authorityPayGrade.trim());
  if (!match) return 'unknown';
  const grade = Number(match[1]);
  if (required === 'field-grade') return grade >= 4;
  return 'unknown'; // gcmca is a billet, not a grade
}
