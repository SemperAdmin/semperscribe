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

import {
  reductionBarred,
  NAVMC_10132_REDUCTION_BAR_FLOOR,
  type Navmc10132Service,
} from '@/lib/navmc10132-ranks';

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
   * A brief noun for this punishment, in the same abbreviation style this
   * table's own `template` strings already use (restr, extra du, corr cust,
   * forf, red). Phase 4's renderSuspension() uses this to name the
   * suspended punishment, matching the form's own item 7 example, which
   * uses "red" for a reduction. Populated only for the release-one-available
   * codes, since a code release one never offers cannot be suspended by this
   * app either.
   */
  shortName?: string;
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
    shortName: 'forf',
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
    shortName: 'corr cust',
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
    shortName: 'forf',
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
    shortName: 'red',
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
    shortName: 'extra du',
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
    shortName: 'restr',
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
    shortName: 'restr',
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
    shortName: 'corr cust',
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
    shortName: 'extra du',
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
    shortName: 'restr',
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
    shortName: 'restr',
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
    shortName: 'admonition',
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
    shortName: 'reprimand',
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
 * What the fleet calls the TYPE of NJP, derived from the imposing officer's
 * grade rather than from the unit echelon.
 *
 * "Company level" and "battalion level" are shorthand for the wrong axis.
 * 10 U.S.C. 815(b)(2) and MCM Part V para 5.b(2) key on the GRADE of the
 * officer imposing, not on what he commands. A company commanded by a major
 * imposes field-grade punishments; a battalion under an O-3 cannot. So this
 * reads item 8A and nothing else.
 *
 * There is no third tier for an enlisted accused. Para 5.b(2) has exactly two
 * subparagraphs, (A) any NJP authority and (B) a commanding officer of the
 * grade of major or lieutenant commander or above. A flag officer is field
 * grade or above and lands in (B) with the same ceiling. The GCMCA tier at
 * 5.b(1)(B) is the OFFICER table.
 */
export type NjpAuthorityLevel = 'company-grade' | 'field-grade';

export const NJP_AUTHORITY_LEVEL_LABEL: Readonly<Record<NjpAuthorityLevel, string>> = {
  'company-grade': 'Company grade',
  'field-grade': 'Field grade',
};

/**
 * Company grade or field grade from the item 8A pay grade alone.
 *
 * Returns null for anything it cannot read: an empty field, a warrant grade, a
 * rank abbreviation typed where a pay grade belongs. Null means "do not
 * claim a level", and every caller honors that rather than defaulting.
 */
export function resolveAuthorityLevel(payGrade: string): NjpAuthorityLevel | null {
  // THE E VARIANTS RESOLVE THE SAME WAY. O1E, O2E and O3E are the rates paid
  // to an officer with prior enlisted service, and the page 3 note lists all
  // three as pay grades this form accepts. An O3E is exactly as much a
  // company-grade officer as an O3, and before this an item 8A recorded as
  // O3E returned null here, printing a BLANK maximum punishment on A-1-d and
  // reporting the grade as unreadable. Found while building the item 8A
  // picker, 2026-08-26, because the picker offers what the form allows.
  const match = /^O(\d+)E?$/i.exec(payGrade.trim().replace(/-/g, ''));
  if (!match) return null;
  const grade = Number(match[1]);
  if (!Number.isFinite(grade) || grade < 1 || grade > 10) return null;
  return grade >= 4 ? 'field-grade' : 'company-grade';
}

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


/**
 * The punishment FAMILY a code belongs to.
 *
 * A family is the thing the statute regulates, and several codes can be one
 * family: N10 and N11 are both restriction, differing only in suspension from
 * duty. Two rules need this and must not disagree, which is why it lives here
 * beside the table rather than privately in either caller:
 *
 *   - the A-1-d maximum-punishment ceiling, which states one sentence per
 *     family rather than one per code, and
 *   - the MCM Part V para 5.d combination limits, which prohibit certain
 *     FAMILIES from being combined and cap the total within one family.
 *
 * 'confinement' and 'arrest-in-quarters' have NO code in the MCTFS table
 * today. They are named anyway so the 5.d gates that mention them are written
 * against the real rule rather than silently omitted, and so a future code
 * lands in the right family instead of falling through as unclassified.
 */
export type PunishmentFamily =
  | 'admonition'
  | 'arrest-in-quarters'
  | 'confinement'
  | 'correctional-custody'
  | 'extra-duties'
  | 'forfeiture-days-pay'
  | 'forfeiture-monthly'
  | 'reduction'
  | 'restriction';

const PUNISHMENT_FAMILY: Readonly<Record<string, PunishmentFamily>> = {
  N01: 'restriction',
  N02: 'restriction',
  N03: 'arrest-in-quarters',
  N04: 'forfeiture-monthly',
  N05: 'restriction',
  N06: 'correctional-custody',
  N07: 'forfeiture-days-pay',
  N08: 'reduction',
  N09: 'extra-duties',
  N10: 'restriction',
  N11: 'restriction',
  N12: 'correctional-custody',
  N13: 'extra-duties',
  N14: 'restriction',
  N15: 'restriction',
  N16: 'admonition',
  N17: 'admonition',
};

/** The family a code belongs to, or null for a code this table does not know. */
export function punishmentFamily(code: string): PunishmentFamily | null {
  return PUNISHMENT_FAMILY[code.trim().toUpperCase()] ?? null;
}

/** One release-one code, with whether the item 8A authority may impose it. */
export interface PunishmentAvailability {
  punishment: Navmc10132Punishment;
  available: boolean;
  /** Empty when available and verified. Otherwise why the picker says what it says. */
  reason: string;
  /** True when item 8A cannot be read, so availability is assumed, not proven. */
  unverified: boolean;
}

/**
 * The item 6 picker's options, gated on the imposing officer's grade.
 *
 * WHY GATE THE PICKER AND NOT ONLY WARN AFTER THE FACT. W-05 already warns
 * once a code is selected, but by then the clerk has typed the days, read
 * them back in the item 6 preview, and formed an expectation. A punishment
 * a company-grade commander may not impose should not look selectable in the
 * first place.
 *
 * DISABLED, NOT HIDDEN. A hidden code reads as a code that does not exist,
 * and the clerk who needs 45 days of extra duty would conclude the app cannot
 * do it rather than that this CO cannot order it. The remedy here is real and
 * worth naming: route the case to a field-grade authority, or correct item 8A.
 * N01 through N03 and N05 stay hidden, because those are out of release scope
 * rather than out of this commander's reach, which is a different fact.
 *
 * AN UNREADABLE ITEM 8A OFFERS EVERYTHING. Item 8A sits in a later section
 * than item 6, so unset is the normal state while the clerk works, and
 * gating on a grade nobody has entered yet would invert the form's own
 * preparation order. Those options come back with `unverified` true so the
 * caller can say the check has not run rather than implying it passed.
 */
export function releaseOnePunishmentsFor(
  authorityPayGrade: string,
  accused: { payGrade?: string; service?: Navmc10132Service } = {},
): PunishmentAvailability[] {
  /**
   * THE ACCUSED'S OWN GRADE BARS A REDUCTION, whatever the authority holds.
   * MCO 5800.16 Vol 14 para 010302.C: "Marines in the grade of E-6 or above
   * and Sailors in the grade of E-7 or above may not be reduced in
   * paygrade." Stephen, 2026-08-26: "we should block the reduction
   * punishment for Marine SSgt and above and navy chiefs and above."
   *
   * OFFERED AND DISABLED, NOT HIDDEN, matching D-21's ruling for the
   * authority-grade codes. A hidden code reads as one the app cannot
   * produce; the real fact is that THIS accused may not receive it, and the
   * reason is worth naming where the clerk is choosing.
   */
  const accusedGrade = (accused.payGrade ?? '').trim();
  const service = accused.service ?? 'USMC';
  const barred = accusedGrade !== '' && reductionBarred(accusedGrade, service);

  return NAVMC_10132_RELEASE_ONE_PUNISHMENTS.map((punishment) => {
    if (barred && punishment.parameters.includes('gradeReducedTo')) {
      const floor = NAVMC_10132_REDUCTION_BAR_FLOOR[service];
      const who = service === 'USN' ? 'Sailors' : 'Marines';
      return {
        punishment,
        available: false,
        unverified: false,
        reason:
          `${who} in the grade of E-${floor} or above may not be reduced in paygrade ` +
          `(MCO 5800.16 Vol 14 para 010302.C). Item 19 is ${accusedGrade}.`,
      };
    }

    const result = authoritySatisfies(punishment.requiredAuthority, authorityPayGrade);

    if (result === true) {
      return { punishment, available: true, reason: '', unverified: false };
    }

    if (result === 'unknown') {
      return {
        punishment,
        available: true,
        unverified: true,
        reason:
          'Requires a commanding officer of the grade of major or above (10 U.S.C. ' +
          '815(b)(2)(H)). Item 8A carries no readable pay grade, so this has not been ' +
          'checked.',
      };
    }

    return {
      punishment,
      available: false,
      unverified: false,
      reason:
        `Requires a field-grade authority, O-4 or above (10 U.S.C. 815(b)(2)(H)). ` +
        `Item 8A is ${authorityPayGrade.trim()}.`,
    };
  });
}
