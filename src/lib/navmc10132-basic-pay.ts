/**
 * Enlisted basic pay, for computing the forfeiture ceilings in item 6.
 *
 * WHAT PAY IS SUBJECT TO FORFEITURE, and it is not just basic pay. JAGMAN
 * 0111.i, verbatim: "Pay subject to forfeiture refers only to basic pay, plus
 * sea duty or hardship duty pay. If NJP also includes reduction in grade,
 * forfeiture will be based on the grade to which the accused is reduced."
 * MCM Part V para 5.c(8) says the same about the reduced grade and adds the
 * clause that catches people out, "whether or not suspended."
 *
 * THE DAILY RATE. DoD FMR Volume 7A, Chapter 1: "The daily rate is 1/30 of
 * the monthly rate." That is the divisor behind N07's "not more than 7 days'
 * pay," not a calendar month.
 *
 * WHOLE DOLLARS. MCO 5800.16 Vol 14 para 010901: "Forfeiture imposed as NJP
 * must be expressed in whole-dollar amounts only, not in dollars and cents."
 * A CEILING therefore rounds DOWN. Rounding a ceiling up would authorize a
 * dollar more than the statute allows.
 *
 * THE STALENESS RULE, and why it is a WINDOW rather than a year. DFAS
 * normally republishes on 1 January, and this file used to derive the
 * governing table from the punishment date's year alone. That premise is
 * false: the FY25 NDAA gave E-1 through E-4 an additional raise effective
 * April 2025, separate from that January's, so one calendar year carried two
 * enlisted tables. A derived `${year}-01-01` cannot represent the second one
 * and would validate an April-or-later 2025 punishment against the January
 * rates. The window below is stated explicitly for that reason. When a
 * mid-year table lands, set `supersededOn` on the outgoing entry rather than
 * trusting the calendar.
 *
 * TRANSCRIPTION PROVENANCE. Read from the DFAS page named in SOURCE_URL on
 * 2026-08-24. VERIFIED 2026-08-25 by Stephen against the published page: a
 * programmatic diff of all 198 cells, 9 grades by 22 brackets, zero
 * mismatches, with the blank-cell shape confirmed (E-8 begins at "Over 8",
 * E-9 at "Over 10"). E1_UNDER_FOUR_MONTHS and
 * SENIOR_ENLISTED_SPECIAL_POSITION_PAY were each checked word for word
 * against DFAS notes 5 and 2.
 *
 * PAY_TABLE_CELL_DIGEST IS THE GUARD, NOT THE INVARIANTS. The row and column
 * monotonicity checks in the test suite reject only errors large enough to
 * invert an ordering, and a digit transposition preserves ordering. Stephen
 * injected six realistic transcription errors and five passed undetected,
 * including 4612.80 typed as 4621.80. The digest below covers every cell
 * exactly. Recompute it ONLY alongside a fresh verification against DFAS,
 * and update the date above in the same edit.
 */

import { createHash } from 'crypto';

/** Where the table comes from. DFAS republishes it on 1 January, and may
 *  publish again mid-year when Congress legislates a separate raise. */
export const BASIC_PAY_SOURCE_URL =
  'https://www.dfas.mil/MilitaryMembers/payentitlements/Pay-Tables/Basic-Pay/EM/';

/**
 * The period this file's table governs.
 *
 * `supersededOn` is null while this is the current table. When a new one is
 * published, set this to that table's effective date rather than deleting
 * this entry, so a punishment dated inside the old window still prices
 * correctly against the rates that were in force when it was imposed.
 */
export const PAY_TABLE_WINDOW: { effectiveFrom: string; supersededOn: string | null } = {
  effectiveFrom: '2026-01-01',
  supersededOn: null,
};

/**
 * SHA-256 over every cell value in MONTHLY_BASIC_PAY, grade by grade, in
 * printed order. Covers all 198 cells including the nulls. Asserted by the
 * test suite so a single transposed digit fails loudly, which monotonicity
 * cannot do.
 */
export const PAY_TABLE_CELL_DIGEST =
  '5f1ed7f3535d8449601864106a8acc6a9b1e70f6fdb2423758ed06aa466a9eef';

const YOS_BRACKETS: readonly number[] = [
  0, 2, 3, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40,
];

/**
 * Monthly basic pay by grade, one entry per bracket above. `null` is a blank
 * cell on the published table, meaning no member holds that grade at that
 * length of service and there is no rate to quote.
 */
const MONTHLY_BASIC_PAY: Readonly<Record<string, ReadonlyArray<number | null>>> = {
  E1: [2407.20, 2407.20, 2407.20, 2407.20, 2407.20, 2407.20, 2407.20, 2407.20, 2407.20, 2407.20,
       2407.20, 2407.20, 2407.20, 2407.20, 2407.20, 2407.20, 2407.20, 2407.20, 2407.20, 2407.20,
       2407.20, 2407.20],
  E2: [2697.90, 2697.90, 2697.90, 2697.90, 2697.90, 2697.90, 2697.90, 2697.90, 2697.90, 2697.90,
       2697.90, 2697.90, 2697.90, 2697.90, 2697.90, 2697.90, 2697.90, 2697.90, 2697.90, 2697.90,
       2697.90, 2697.90],
  E3: [2836.80, 3015.00, 3198.00, 3198.00, 3198.00, 3198.00, 3198.00, 3198.00, 3198.00, 3198.00,
       3198.00, 3198.00, 3198.00, 3198.00, 3198.00, 3198.00, 3198.00, 3198.00, 3198.00, 3198.00,
       3198.00, 3198.00],
  E4: [3142.20, 3303.00, 3482.40, 3658.50, 3815.40, 3815.40, 3815.40, 3815.40, 3815.40, 3815.40,
       3815.40, 3815.40, 3815.40, 3815.40, 3815.40, 3815.40, 3815.40, 3815.40, 3815.40, 3815.40,
       3815.40, 3815.40],
  E5: [3342.90, 3598.20, 3775.80, 3946.80, 4110.00, 4299.90, 4395.30, 4421.70, 4421.70, 4421.70,
       4421.70, 4421.70, 4421.70, 4421.70, 4421.70, 4421.70, 4421.70, 4421.70, 4421.70, 4421.70,
       4421.70, 4421.70],
  E6: [3401.10, 3743.10, 3908.10, 4068.90, 4235.70, 4612.80, 4759.50, 5043.30, 5130.30, 5193.60,
       5267.70, 5267.70, 5267.70, 5267.70, 5267.70, 5267.70, 5267.70, 5267.70, 5267.70, 5267.70,
       5267.70, 5267.70],
  E7: [3932.10, 4291.50, 4456.20, 4673.10, 4843.80, 5135.70, 5300.40, 5591.70, 5835.00, 6000.90,
       6177.30, 6245.70, 6475.20, 6598.20, 7067.40, 7067.40, 7067.40, 7067.40, 7067.40, 7067.40,
       7067.40, 7067.40],
  E8: [null, null, null, null, null, 5656.50, 5907.00, 6061.80, 6247.20, 6448.20,
       6811.20, 6995.40, 7308.30, 7481.70, 7908.90, 7908.90, 8067.30, 8067.30, 8067.30, 8067.30,
       8067.30, 8067.30],
  E9: [null, null, null, null, null, null, 6910.20, 7066.50, 7263.60, 7496.10,
       7730.70, 8105.10, 8423.10, 8756.70, 9267.90, 9267.90, 9730.20, 9730.20, 10217.40, 10217.40,
       10729.20, 10729.20],
};
/**
 * The rate an E-1 with LESS than four months of active duty draws.
 *
 * DFAS note 4 attaches to the printed E-1 row: "Must have 4 months of active
 * duty or more." Note 5 gives this figure for anyone below it.
 *
 * NOT DETECTED, ANNOUNCED. The form carries no months-of-service field and
 * neither does this app, so nothing here can tell the two E-1 populations
 * apart. Until 2026-08-25 this constant was declared and read by nothing at
 * all, which meant every E-1 was priced at the four-months-or-more rate and
 * the ceiling was overstated by $42 on a seven days' pay forfeiture and $182
 * across a two-month half-month forfeiture. That is the exact failure this
 * module's own header warns about, applied to the modal NJP defendant while
 * the note for a population of one, the Sergeant Major of the Marine Corps,
 * was already automated. Every E-1 ceiling now carries a note naming this
 * rate and telling the clerk to use it when the Marine is inside four months.
 */
export const E1_UNDER_FOUR_MONTHS = 2225.70;

/**
 * Basic pay of the senior enlisted member of a Service, e.g. the Sergeant
 * Major of the Marine Corps, which is a flat rate regardless of years of
 * service (DFAS note 2).
 *
 * NOT APPLIED AUTOMATICALLY. Per Stephen's 2026-08-24 ruling, an E-9 is
 * computed on the ordinary E-9 rate and the caller is told the special-
 * position rate exists. Detecting the billet would need a field the form does
 * not have, and the population is one Marine.
 */
export const SENIOR_ENLISTED_SPECIAL_POSITION_PAY = 11166.90;

/**
 * The LOWEST rate the table publishes for a grade, for the grades whose
 * early brackets are blank.
 *
 * WHY THIS IS NOT AN INVENTED NUMBER. DFAS leaves E-8 blank below eight
 * years and E-9 blank below ten, because those are the lengths of service
 * the promotion timelines make reachable. A prior-service or meritorious
 * promotion puts a real Marine in a blank cell, and that Marine is paid
 * something: the lowest rate published for the grade, which is what a blank
 * cell above a printed column means on a pay table.
 *
 * CONFIRMED AGAINST A PRIMARY SOURCE, not reasoned to. The Marine Corps
 * CY26 active duty maximum forfeiture table (Stephen, 2026-08-26) prints a
 * figure in every one of those cells, and every one of them is this rate:
 * E-8 at zero years reads $1,319 for seven days' pay, which is
 * floor(5656.50 / 30 * 7), the over-eight rate. `navmc10132-forfeiture-
 * oracle.test.ts` checks all 390 enlisted cells of that table against this
 * module, at all three of its adjudication levels.
 */
function lowestPublishedRate(grade: string): number | null {
  const row = MONTHLY_BASIC_PAY[grade];
  if (!row) return null;
  for (const cell of row) if (cell !== null) return cell;
  return null;
}

/** Recomputes the digest from the table itself. Used by the test suite. */
export function computePayTableCellDigest(): string {
  const payload = Object.keys(MONTHLY_BASIC_PAY)
    .map((grade) => `${grade}=${MONTHLY_BASIC_PAY[grade].map((v) => (v === null ? 'null' : v.toFixed(2))).join(',')}`)
    .join(';');
  return createHash('sha256').update(payload).digest('hex');
}

/**
 * A pay grade in the table's own spelling, or '' when the input is not a
 * readable enlisted pay grade at all.
 *
 * Tolerates the shapes a clerk or an imported draft actually produces: a
 * dash, a leading zero, internal spaces, lower case. It previously stripped
 * dashes and nothing else, so "E-05" became "E05" and "E 5" stayed "E 5",
 * both of which missed every row and were then indistinguishable from a
 * legitimately blank cell.
 */
function normaliseGrade(payGrade: string): string {
  const compact = payGrade.replace(/[\s-]/g, '').toUpperCase();
  const match = /^E0*(\d{1,2})$/.exec(compact);
  if (!match) return '';
  const n = Number(match[1]);
  return n >= 1 && n <= 9 ? `E${n}` : '';
}

/** The bracket index a length of service falls in. */
function bracketIndex(yearsOfService: number): number {
  let index = 0;
  for (let i = 0; i < YOS_BRACKETS.length; i++) {
    if (yearsOfService >= YOS_BRACKETS[i]) index = i;
  }
  return index;
}

/**
 * Why no rate is available. The distinction matters: a blank table cell is
 * the published table saying no member holds that grade at that length of
 * service, while unreadable input is a data error the clerk must see.
 * Collapsing both to null, as this module did until 2026-08-25, meant a
 * mistyped pay grade silenced the over-ceiling gate with no warning at all.
 */
export type BasicPayUnavailable =
  | 'grade-not-set'
  | 'unreadable-grade'
  | 'years-not-set'
  | 'unreadable-years'
  | 'no-rate-published';

export type BasicPayLookup =
  | { kind: 'rate'; monthly: number }
  | { kind: 'unavailable'; reason: BasicPayUnavailable; detail: string };

/** Monthly basic pay for a grade and length of service. */
export function monthlyBasicPay(payGrade: string, yearsOfService: string | number): BasicPayLookup {
  const raw = payGrade.trim();
  if (raw === '') {
    return { kind: 'unavailable', reason: 'grade-not-set', detail: 'No pay grade is set.' };
  }
  const grade = normaliseGrade(raw);
  if (grade === '' || !(grade in MONTHLY_BASIC_PAY)) {
    return {
      kind: 'unavailable',
      reason: 'unreadable-grade',
      detail: `"${raw}" is not a readable enlisted pay grade. Enter it as E1 through E9.`,
    };
  }

  const yearsRaw = typeof yearsOfService === 'number' ? String(yearsOfService) : yearsOfService.trim();
  if (yearsRaw === '') {
    return { kind: 'unavailable', reason: 'years-not-set', detail: 'No years of service are set.' };
  }
  const years = Number(yearsRaw);
  if (!Number.isFinite(years) || years < 0) {
    return {
      kind: 'unavailable',
      reason: 'unreadable-years',
      detail: `"${yearsRaw}" is not a readable length of service.`,
    };
  }

  const monthly = MONTHLY_BASIC_PAY[grade][bracketIndex(years)];
  if (monthly === null || monthly === undefined) {
    return {
      kind: 'unavailable',
      reason: 'no-rate-published',
      detail:
        `The published table prints no rate for ${grade} at ${years} years of service. ` +
        'No member holds that grade at that length of service.',
    };
  }
  return { kind: 'rate', monthly };
}

export interface PayTableStatus {
  /** True when the held table is the one in force on `punishmentDate`. */
  current: boolean;
  /** The window this file holds, echoed for the caller's message. */
  effectiveFrom: string;
  /** Plain-language explanation. Always populated. */
  detail: string;
}

/** True only for a real calendar date, not merely a well-shaped string. */
function isRealDate(iso: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return false;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const probe = new Date(Date.UTC(y, m - 1, d));
  return (
    probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d
  );
}

/**
 * Whether the held table governs the punishment date.
 *
 * Compares against the explicit window rather than deriving one from the
 * year, so a mid-year republication is representable. An undated item 6 is
 * NOT current: the check cannot run without a date, and treating unknown as
 * fine is how a stale table gets used.
 */
export function payTableStatus(punishmentDate: string): PayTableStatus {
  const iso = punishmentDate.trim();
  const { effectiveFrom, supersededOn } = PAY_TABLE_WINDOW;

  if (!isRealDate(iso)) {
    return {
      current: false,
      effectiveFrom,
      detail:
        iso === ''
          ? 'Set the item 6 punishment date. The ceiling is priced on the pay table in force ' +
            'when the punishment was imposed, so it cannot be computed without it.'
          : `"${iso}" is not a real calendar date. Enter the item 6 punishment date as YYYY-MM-DD.`,
    };
  }

  if (iso < effectiveFrom) {
    return {
      current: false,
      effectiveFrom,
      detail:
        `This app holds the table effective ${effectiveFrom}, and a punishment dated ${iso} ` +
        `predates it. No ceiling is computed. Read the rate in force on ${iso} from ` +
        `${BASIC_PAY_SOURCE_URL} and compute the forfeiture by hand.`,
    };
  }

  if (supersededOn !== null && iso >= supersededOn) {
    return {
      current: false,
      effectiveFrom,
      detail:
        `The table this app holds was superseded on ${supersededOn}, and a punishment dated ` +
        `${iso} is priced on the later one. No ceiling is computed. Read it from ` +
        `${BASIC_PAY_SOURCE_URL}.`,
    };
  }

  return {
    current: true,
    effectiveFrom,
    detail: `Basic pay table effective ${effectiveFrom}, published by DFAS.`,
  };
}

export interface ForfeitureCeiling {
  /** Monthly basic pay used, before sea or hardship duty pay. */
  monthlyBasicPay: number;
  /** Basic pay plus sea or hardship duty pay. The base JAGMAN 0111.i names. */
  monthlySubjectToForfeiture: number;
  /** N07, forfeiture of not more than 7 days' pay. Whole dollars, rounded down. */
  sevenDaysPay: number;
  /** N04, one-half of one month's pay. Whole dollars, rounded down, PER MONTH. */
  halfMonthPay: number;
  /** The grade the figures were computed on. */
  payGrade: string;
  /** Things the caller must show the clerk. Never empty for an E-1 or an E-9. */
  notes: string[];
}

export type ForfeitureCeilingUnavailable =
  | BasicPayUnavailable
  | 'table-not-current'
  | 'unreadable-extra-pay';

export type ForfeitureCeilingResult =
  | { kind: 'ceiling'; ceiling: ForfeitureCeiling }
  | { kind: 'unavailable'; reason: ForfeitureCeilingUnavailable; detail: string };

/**
 * Reasons a caller must SURFACE rather than pass over in silence.
 *
 * The others are ordinary states of a half-filled form or a truthful "the
 * table prints no rate here", and blocking on them would be noise. These
 * three are data errors that would otherwise silence the over-ceiling gate.
 */
export const CEILING_REASONS_WORTH_SURFACING: readonly ForfeitureCeilingUnavailable[] = [
  'unreadable-grade',
  'unreadable-years',
  'unreadable-extra-pay',
];

export interface ForfeitureCeilingInput {
  /**
   * REQUIRED, and the compiler now enforces what this module's header used to
   * only request. The header claims nothing computes unless the held table
   * governs the punishment date; before 2026-08-25 this function took no date
   * at all and computed from whatever the table held, so that claim rested
   * entirely on one caller's discipline.
   */
  status: PayTableStatus;
  payGrade: string;
  yearsOfService: string | number;
  /** Monthly sea duty or hardship duty pay. Blank or 0 for most Marines. */
  seaHardshipDutyPay?: string | number;
}

/**
 * The two forfeiture ceilings.
 *
 * `payGrade` is the grade the forfeiture is BASED on, which is the reduced
 * grade whenever a reduction is imposed. This function does not work that
 * out. The caller passes the right grade, because the reduced-grade decision
 * is recorded in item 6 as `forfeitureBasisGrade` and gated by validator
 * V-18.
 */
export function forfeitureCeiling(input: ForfeitureCeilingInput): ForfeitureCeilingResult {
  if (!input.status.current) {
    return { kind: 'unavailable', reason: 'table-not-current', detail: input.status.detail };
  }

  const basic = monthlyBasicPay(input.payGrade, input.yearsOfService);
  const flooredNotes: string[] = [];
  let monthly: number;
  if (basic.kind === 'unavailable') {
    // A BLANK CELL IS NOT A REASON TO COMPUTE NOTHING, and computing nothing
    // here is worse than it looks: the over-ceiling gate reads this result,
    // so an E-8 whose years of service land in a blank cell used to get NO
    // ceiling and therefore NO gate, on a grade where the lawful maximum is
    // the largest of any enlisted Marine. See lowestPublishedRate.
    //
    // ONLY for a blank cell. Every other unavailable reason is a data error
    // or an unfilled form, where a computed figure would be a guess about
    // the accused rather than about the table.
    const floor = basic.reason === 'no-rate-published' ? lowestPublishedRate(normaliseGrade(input.payGrade)) : null;
    if (floor === null) {
      return { kind: 'unavailable', reason: basic.reason, detail: basic.detail };
    }
    monthly = floor;
    flooredNotes.push(
      `The pay table prints no rate for pay grade ${normaliseGrade(input.payGrade)} at this ` +
        'length of service, so the ceiling is computed on the lowest rate it publishes for ' +
        `that grade, $${floor.toFixed(2)} a month. That is what the Marine Corps maximum ` +
        'forfeiture table does for the same cells. Confirm the length of service before ' +
        'imposing, because a mistyped one lands here.',
    );
  } else {
    monthly = basic.monthly;
  }

  const rawExtra = input.seaHardshipDutyPay ?? 0;
  const extraText = typeof rawExtra === 'number' ? String(rawExtra) : rawExtra.trim();
  const extra = extraText === '' ? 0 : Number(extraText);
  if (!Number.isFinite(extra) || extra < 0) {
    return {
      kind: 'unavailable',
      reason: 'unreadable-extra-pay',
      detail: `"${extraText}" is not a readable amount of sea or hardship duty pay.`,
    };
  }

  const subject = monthly + extra;
  const grade = normaliseGrade(input.payGrade);
  const notes: string[] = [...flooredNotes];

  if (grade === 'E1') {
    notes.push(
      `Assumes four months of active duty or more (DFAS note 4). An E-1 inside four months ` +
        `draws $${E1_UNDER_FOUR_MONTHS.toFixed(2)} a month, which lowers these ceilings to ` +
        `$${Math.floor((E1_UNDER_FOUR_MONTHS + extra) / 30 * 7)} and ` +
        `$${Math.floor((E1_UNDER_FOUR_MONTHS + extra) / 2)}. The form carries no ` +
        'months-of-service field, so check it before imposing.',
    );
  }

  if (grade === 'E9') {
    notes.push(
      'Computed on the ordinary E-9 rate. A Marine serving as Sergeant Major of the Marine ' +
        `Corps draws a flat $${SENIOR_ENLISTED_SPECIAL_POSITION_PAY.toFixed(2)} regardless of ` +
        'years of service (DFAS note 2), which this figure does not use. That rate also ' +
        'follows the member 60 days into terminal leave pending retirement, and up to 180 ' +
        'days while hospitalised (DFAS note 3).',
    );
  }

  if (extra === 0) {
    notes.push(
      'Basic pay only. Pay subject to forfeiture is basic pay PLUS sea duty or hardship duty ' +
        'pay (JAGMAN 0111.i), so enter that pay beside item 19 if the accused draws it, or the ' +
        'ceiling below is lower than the lawful one.',
    );
  }

  return {
    kind: 'ceiling',
    ceiling: {
      monthlyBasicPay: monthly,
      monthlySubjectToForfeiture: subject,
      // The daily rate is 1/30 of the monthly rate (DoD FMR Vol 7A Ch 1).
      // Floored, because MCO 010901 requires whole dollars and this is a
      // ceiling. Verified 2026-08-25 across 20.7 million cent-granular cases
      // against exact integer arithmetic, zero divergence: do NOT rewrite
      // this into integer cents for correctness, no defect exists here.
      sevenDaysPay: Math.floor((subject / 30) * 7),
      halfMonthPay: Math.floor(subject / 2),
      payGrade: grade,
      notes,
    },
  };
}
