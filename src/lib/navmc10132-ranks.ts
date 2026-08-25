/**
 * NAVMC 10132 rank and pay grade vocabularies, items 8A, 19, and 24.
 *
 * AUTHORITY. The form's own page 3 RANK/GRADE note, quoted verbatim because
 * it is the controlling map and it is a CLOSED list for Marines:
 *
 *   "Use only Pvt, PFC, LCpl, Cpl, Sgt, SSgt, GySgt, MSgt, 1stSgt, MGySgt,
 *    SgtMaj, WO, CWO2, CWO3, CWO4, CWO5, 2ndLt, 1stLt, Capt, Maj, LtCol,
 *    Col, BGen, MajGen, LtGen, Gen as Marine ranks. For other services, use
 *    the correct and appropriate rank abbreviation. For Navy petty officers,
 *    use the rating abbreviation. Use only E1, E2, E3, E4, E5, E6, E7, E8,
 *    E9, W1, W2, W3, W4, W5, O1, O1E, O2, O2E, O3, O3E, O4, O5, O6, O7, O8,
 *    O9, O10 as pay grades. Do not include periods in Marine ranks, nor
 *    dashes in pay grades, nor the number 0 for the letter O in officer pay
 *    grades. Pay attention to cases in which rank and pay grade do not
 *    correspond (e.g., a Marine frocked to the next rank)."
 *
 * Three consequences drive everything below.
 *
 * 1. The Marine list is CLOSED, so it is a selection rather than free text.
 *    Only the enlisted ranks appear here. This app is enlisted only, and the
 *    officer ranks the note lists belong to the separate officer element.
 *
 * 2. Navy is NOT a closed E1 through E9 list. The note requires the RATING
 *    abbreviation for petty officers, so an E5 corpsman is HM2, never PO2.
 *    Below E4 the Navy uses apprenticeship abbreviations that vary by
 *    community, so an E3 corpsman is HN while an E3 seaman is SN. A naive
 *    E1 through E9 dropdown would emit strings the form forbids.
 *
 * 3. Rank and pay grade DIVERGE. The note names frocking specifically. So
 *    payGradeOf is a DEFAULT for the UI to seed, never a derivation the app
 *    enforces. A frocked Marine wears Sgt and is paid E4, and the form
 *    expects that recorded accurately.
 *
 * The dash rule is worth restating: pay grades are E5, never E-5. The form's
 * own item 7 example contradicts this note by printing "Red to LCpl, E-3".
 * The note governs. See docs/NAVMC_10132_DEFECT_REPORT.md finding 14.
 */

/** Enlisted pay grades, byte-exact from the page 3 note. No dashes. */
export const NAVMC_10132_ENLISTED_PAY_GRADES = [
  'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9',
] as const;

export type EnlistedPayGrade = (typeof NAVMC_10132_ENLISTED_PAY_GRADES)[number];

/** Which service's vocabulary a rank is drawn from. */
export type Navmc10132Service = 'USMC' | 'USN';

export interface Navmc10132Rank {
  /** The abbreviation as the form requires it printed. No periods. */
  abbreviation: string;
  /** Spelled out, for the picker only. Never printed. */
  title: string;
  /** The pay grade normally held at this rank. A DEFAULT, see the note on
   *  frocking above. Never treat it as a derivation. */
  payGrade: EnlistedPayGrade;
}

/**
 * Marine enlisted ranks, the CLOSED list from the page 3 note, in order.
 *
 * E8 and E9 each carry two ranks. MSgt and 1stSgt are both E8, MGySgt and
 * SgtMaj are both E9, which is why this is a list of ranks rather than a
 * map keyed by pay grade.
 */
export const NAVMC_10132_USMC_ENLISTED_RANKS: readonly Navmc10132Rank[] = [
  { abbreviation: 'Pvt', title: 'Private', payGrade: 'E1' },
  { abbreviation: 'PFC', title: 'Private First Class', payGrade: 'E2' },
  { abbreviation: 'LCpl', title: 'Lance Corporal', payGrade: 'E3' },
  { abbreviation: 'Cpl', title: 'Corporal', payGrade: 'E4' },
  { abbreviation: 'Sgt', title: 'Sergeant', payGrade: 'E5' },
  { abbreviation: 'SSgt', title: 'Staff Sergeant', payGrade: 'E6' },
  { abbreviation: 'GySgt', title: 'Gunnery Sergeant', payGrade: 'E7' },
  { abbreviation: 'MSgt', title: 'Master Sergeant', payGrade: 'E8' },
  { abbreviation: '1stSgt', title: 'First Sergeant', payGrade: 'E8' },
  { abbreviation: 'MGySgt', title: 'Master Gunnery Sergeant', payGrade: 'E9' },
  { abbreviation: 'SgtMaj', title: 'Sergeant Major', payGrade: 'E9' },
];

/**
 * Navy E1 through E3 apprenticeship abbreviations, grouped by community.
 *
 * These are NOT interchangeable. The abbreviation encodes the community, so
 * an E3 in the hospital corps is HN and an E3 in the deck force is SN. The
 * page 3 note's "correct and appropriate rank abbreviation" is what forces
 * the distinction.
 */
export interface NavyApprenticeship {
  /** Community name, for the picker. */
  community: string;
  /** Abbreviations at E1, E2, and E3, in that order. */
  grades: readonly [string, string, string];
}

export const NAVMC_10132_USN_APPRENTICESHIPS: readonly NavyApprenticeship[] = [
  { community: 'Seaman', grades: ['SR', 'SA', 'SN'] },
  { community: 'Fireman', grades: ['FR', 'FA', 'FN'] },
  { community: 'Airman', grades: ['AR', 'AA', 'AN'] },
  { community: 'Constructionman', grades: ['CR', 'CA', 'CN'] },
  { community: 'Hospitalman', grades: ['HR', 'HA', 'HN'] },
];

/**
 * The suffix appended to a Navy rating abbreviation at each petty officer
 * grade. HM plus E7 is HMC, the chief hospital corpsman.
 *
 * E1 through E3 carry no rating suffix at all, they use the apprenticeship
 * abbreviations above, which is why those grades are absent here.
 */
export const NAVMC_10132_USN_RATING_SUFFIX: Readonly<Record<string, string>> = {
  E4: '3',
  E5: '2',
  E6: '1',
  E7: 'C',
  E8: 'CS',
  E9: 'CM',
};

/**
 * Navy ratings commonly attached to Marine units. DELIBERATELY SHORT.
 *
 * The Navy carries roughly ninety ratings and this list is not a substitute
 * for the full structure. It covers what a Marine command routinely books
 * and the composer accepts any other rating as typed, because a wrong entry
 * offered from a list reads as authoritative in a way a typed one does not.
 */
export const NAVMC_10132_USN_COMMON_RATINGS: readonly { abbreviation: string; title: string }[] = [
  { abbreviation: 'HM', title: 'Hospital Corpsman' },
  { abbreviation: 'RP', title: 'Religious Program Specialist' },
  { abbreviation: 'MA', title: 'Master-at-Arms' },
  { abbreviation: 'SW', title: 'Steelworker' },
  { abbreviation: 'CE', title: 'Construction Electrician' },
  { abbreviation: 'EO', title: 'Equipment Operator' },
  { abbreviation: 'UT', title: 'Utilitiesman' },
  { abbreviation: 'BU', title: 'Builder' },
];

/**
 * Composes a Navy enlisted abbreviation from a rating and a pay grade.
 *
 * At E4 and above the rating carries a grade suffix, HM plus E5 is HM2. At
 * E1 through E3 the rating is not used at all, so this returns null and the
 * caller picks an apprenticeship abbreviation instead. Returning null rather
 * than guessing keeps a forbidden string like "HM6" off a legal record.
 */
export function composeNavyAbbreviation(
  rating: string,
  payGrade: string,
): string | null {
  const suffix = NAVMC_10132_USN_RATING_SUFFIX[payGrade];
  if (suffix === undefined) return null;
  const trimmed = rating.trim();
  if (trimmed === '') return null;
  return `${trimmed}${suffix}`;
}

/** The item 19 string as the form prints it, rank then pay grade. */
export function formatRankGrade(abbreviation: string, payGrade: string): string {
  const rank = abbreviation.trim();
  const grade = payGrade.trim();
  if (rank === '' && grade === '') return '';
  if (grade === '') return rank;
  if (rank === '') return grade;
  return `${rank}, ${grade}`;
}

/** Looks up a Marine enlisted rank by its printed abbreviation. */
export function resolveUsmcRank(abbreviation: string): Navmc10132Rank | undefined {
  const wanted = abbreviation.trim();
  return NAVMC_10132_USMC_ENLISTED_RANKS.find((r) => r.abbreviation === wanted);
}

/**
 * The pay grade normally held at a Marine enlisted rank, or undefined when
 * the abbreviation is not one the form allows.
 *
 * A DEFAULT for seeding the pay grade field. The page 3 note warns that rank
 * and pay grade do not always correspond, so nothing downstream may treat a
 * mismatch as an error on its own.
 */
export function payGradeOf(abbreviation: string): EnlistedPayGrade | undefined {
  return resolveUsmcRank(abbreviation)?.payGrade;
}

/**
 * True when a Marine rank and pay grade pair does not match the usual
 * correspondence. NOT an error. Frocking makes this legitimate, and the
 * page 3 note tells the preparer to expect it. The UI surfaces it so a
 * divergence is deliberate rather than a typo left unnoticed.
 */
export function rankGradeDiverges(abbreviation: string, payGrade: string): boolean {
  const expected = payGradeOf(abbreviation);
  if (expected === undefined) return false;
  if (payGrade.trim() === '') return false;
  return expected !== payGrade.trim();
}

/**
 * Lowest pay-grade NUMBER at which reduction is barred outright, by the
 * accused's service.
 *
 * MCO 5800.16 Vol 14 para 010302.C, verbatim: "Marines in the grade of E-6 or
 * above and Sailors in the grade of E-7 or above may not be reduced in
 * paygrade."
 *
 * THIS IS TWO FLOORS, NOT ONE. The order names each service separately and the
 * numbers differ. Collapsing them to a single E-6 test, which this file and
 * validator W-08 both did until 2026-08-24, is wrong in both directions: it
 * refuses a lawful reduction of a Navy E-6 and permits an unlawful one of a
 * Navy E-7. Read the floor from the accused's service, never from a constant.
 */
export const NAVMC_10132_REDUCTION_BAR_FLOOR: Readonly<Record<Navmc10132Service, number>> = {
  USMC: 6,
  USN: 7,
};

/**
 * Whether para 010302.C bars reducing this accused at all.
 *
 * An unreadable pay grade returns false, not true: the app does not assert a
 * bar it cannot support. An unset service defaults to USMC, this being a
 * NAVMC form.
 */
export function reductionBarred(payGrade: string, service: Navmc10132Service = 'USMC'): boolean {
  const match = /^E(\d)$/i.exec(payGrade.trim().replace(/-/g, ''));
  if (!match) return false;
  return Number(match[1]) >= NAVMC_10132_REDUCTION_BAR_FLOOR[service];
}

/**
 * Grades an enlisted accused at `payGrade` may be reduced TO, most senior
 * first.
 *
 * Two rules bound this. MCO 5800.16 Vol 14 para 010302.C bars reduction
 * outright at and above the service's own floor, so those return an empty
 * list. And 10 U.S.C. 815(b)(2)(D), the code behind N08, authorizes reduction
 * to the NEXT inferior grade only, which is why `nextInferiorOnly` exists: the
 * field-grade authority to reach a lower grade sits at (b)(2)(H)(iv), for
 * which the MCTFS table carries no code at all. See defect report finding 12.
 */
export function reducibleGrades(
  payGrade: string,
  options?: { nextInferiorOnly?: boolean; service?: Navmc10132Service },
): EnlistedPayGrade[] {
  const index = NAVMC_10132_ENLISTED_PAY_GRADES.indexOf(payGrade.trim() as EnlistedPayGrade);
  if (index <= 0) return [];
  if (reductionBarred(payGrade, options?.service ?? 'USMC')) return [];
  const below = NAVMC_10132_ENLISTED_PAY_GRADES.slice(0, index).slice().reverse();
  return options?.nextInferiorOnly ? below.slice(0, 1) : [...below];
}

/**
 * The PAY GRADE a reduction target names.
 *
 * `gradeReducedTo` stores a RANK abbreviation ("LCpl") for a Marine, because
 * the picker offers ranks, but falls back to a bare pay grade ("E3") where the
 * service has no rank list in this file. Both shapes have to resolve, and a
 * caller comparing a forfeiture basis against the reduction target cannot be
 * left guessing which one it got.
 */
export function reducedPayGrade(gradeReducedTo: string): string {
  const value = gradeReducedTo.trim();
  if (value === '') return '';
  if (/^E\d$/i.test(value.replace(/-/g, ''))) return value.replace(/-/g, '').toUpperCase();
  return payGradeOf(value) ?? '';
}

/** The Marine ranks held at a pay grade. E8 and E9 each have two. */
export function ranksAtGrade(payGrade: string): Navmc10132Rank[] {
  return NAVMC_10132_USMC_ENLISTED_RANKS.filter((r) => r.payGrade === payGrade.trim());
}
