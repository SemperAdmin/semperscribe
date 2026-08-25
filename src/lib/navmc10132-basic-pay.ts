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
 * So the ceiling needs FOUR inputs, and the app collects all four:
 *   pay grade            item 19, or the reduced grade when one is imposed
 *   years of service     collected beside item 19, does not print
 *   sea or hardship duty pay   collected beside it, does not print, usually 0
 *   the punishment date  item 6, to decide whether this table still applies
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
 * THE STALENESS RULE, and it is the whole reason this file is safe to have.
 * DFAS republishes the table every 1 January. A pay table with no expiry is a
 * wrong answer waiting for a date change, and a wrong forfeiture ceiling
 * overcollects from a Marine's pay. So nothing here computes unless the table
 * this file holds is the one in force on the punishment date: see
 * payTableStatus. Outside that window the app reports the rate it holds,
 * says it may be superseded, and returns no ceiling at all. When you update
 * the table, update EFFECTIVE_DATE in the same commit or the file goes
 * silently inert, which is the failure mode this is designed for.
 *
 * TRANSCRIPTION PROVENANCE. Read from the DFAS page named in SOURCE_URL on
 * 2026-08-24. Verified three ways before use: every row is non-decreasing
 * across years of service, every column is non-decreasing across grades, and
 * the blank cells reproduce the published table's own shape (E-9 begins at
 * over 10, E-8 at over 8). It has NOT been checked cell by cell against the
 * published page by a human. Do that before anyone relies on a printed
 * ceiling in a real case.
 */

/** Where the table comes from. DFAS republishes it every 1 January. */
export const BASIC_PAY_SOURCE_URL =
  'https://www.dfas.mil/MilitaryMembers/payentitlements/Pay-Tables/Basic-Pay/EM/';

/** The date the held table took effect. ISO. Update WITH the table, never after. */
export const BASIC_PAY_EFFECTIVE_DATE = '2026-01-01';

/**
 * Lower bound in years of each printed column, in order. "2 or less" is 0.
 * These are the DFAS column headings, not a simplification of them.
 */
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

/** An E-1 with less than 4 months of active duty draws a lower rate. */
export const E1_UNDER_FOUR_MONTHS = 2225.70;

/**
 * Basic pay of the senior enlisted member of a Service, e.g. the Sergeant
 * Major of the Marine Corps, which is a flat rate regardless of years of
 * service (DFAS footnote 2).
 *
 * NOT APPLIED AUTOMATICALLY. Per Stephen's 2026-08-24 ruling, an E-9 is
 * computed on the ordinary E-9 rate and the caller is told the special-
 * position rate exists. Detecting the billet would need a field the form does
 * not have, and the population is one Marine.
 */
export const SENIOR_ENLISTED_SPECIAL_POSITION_PAY = 11166.90;

function normaliseGrade(payGrade: string): string {
  return payGrade.trim().replace(/-/g, '').toUpperCase();
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
 * Monthly basic pay, or null when the app cannot state one: an unreadable
 * grade, an unreadable length of service, or a blank cell on the published
 * table. Null always means "say nothing", never "assume zero".
 */
export function monthlyBasicPay(payGrade: string, yearsOfService: string | number): number | null {
  const grade = normaliseGrade(payGrade);
  const row = MONTHLY_BASIC_PAY[grade];
  if (!row) return null;

  const years = typeof yearsOfService === 'number' ? yearsOfService : Number(yearsOfService.trim());
  if (!Number.isFinite(years) || years < 0 || `${yearsOfService}`.trim() === '') return null;

  return row[bracketIndex(years)] ?? null;
}

export interface PayTableStatus {
  /** True when the held table is the one in force on `punishmentDate`. */
  current: boolean;
  /** The 1 January the punishment date falls under, ISO. Empty when undated. */
  expectedEffective: string;
  /** Plain-language explanation. Always populated. */
  detail: string;
}

/**
 * Whether the held table governs the punishment date.
 *
 * The rule, per Stephen: compute only when this file's effective date is the
 * most recent 1 January on or before the punishment date. That refuses two
 * distinct errors with one test. A punishment dated after the next 1 January
 * would be priced on a superseded table, and a punishment dated in an earlier
 * year, which happens when an old case is entered late, would be priced on
 * rates that did not exist yet.
 *
 * An undated item 6 is NOT current. The check cannot run without a date, and
 * treating unknown as fine is how a stale table gets used.
 */
export function payTableStatus(punishmentDate: string): PayTableStatus {
  const iso = punishmentDate.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) {
    return {
      current: false,
      expectedEffective: '',
      detail:
        'Set the item 6 punishment date. The pay table in force is the one published the ' +
        'preceding 1 January, so the ceiling cannot be computed without it.',
    };
  }

  const expectedEffective = `${match[1]}-01-01`;
  if (expectedEffective === BASIC_PAY_EFFECTIVE_DATE) {
    return {
      current: true,
      expectedEffective,
      detail: `Basic pay table effective ${BASIC_PAY_EFFECTIVE_DATE}, published by DFAS.`,
    };
  }

  return {
    current: false,
    expectedEffective,
    detail:
      `This app holds the table effective ${BASIC_PAY_EFFECTIVE_DATE}, but a punishment dated ` +
      `${iso} is priced on the table effective ${expectedEffective}. No ceiling is computed. ` +
      `Read the correct rate from ${BASIC_PAY_SOURCE_URL} and compute the forfeiture by hand.`,
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
  /** Things the caller must show the clerk. Never empty for an E-9. */
  notes: string[];
}

/**
 * The two forfeiture ceilings, or null when any input is missing.
 *
 * `payGrade` is the grade the forfeiture is BASED on, which is the reduced
 * grade whenever a reduction is imposed. This function does not work that out.
 * The caller passes the right grade, because the reduced-grade decision is
 * recorded in item 6 as `forfeitureBasisGrade` and gated by validator V-18.
 */
export function forfeitureCeiling(input: {
  payGrade: string;
  yearsOfService: string | number;
  /** Monthly sea duty or hardship duty pay. Blank or 0 for most Marines. */
  seaHardshipDutyPay?: string | number;
}): ForfeitureCeiling | null {
  const basic = monthlyBasicPay(input.payGrade, input.yearsOfService);
  if (basic === null) return null;

  const rawExtra = input.seaHardshipDutyPay ?? 0;
  const extra = typeof rawExtra === 'number' ? rawExtra : Number(`${rawExtra}`.trim() || '0');
  if (!Number.isFinite(extra) || extra < 0) return null;

  const subject = basic + extra;
  const notes: string[] = [];

  if (normaliseGrade(input.payGrade) === 'E9') {
    notes.push(
      'Computed on the ordinary E-9 rate. A Marine serving as Sergeant Major of the Marine ' +
        `Corps draws a flat $${SENIOR_ENLISTED_SPECIAL_POSITION_PAY.toFixed(2)} regardless of ` +
        'years of service (DFAS footnote 2), which this figure does not use.',
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
    monthlyBasicPay: basic,
    monthlySubjectToForfeiture: subject,
    // The daily rate is 1/30 of the monthly rate (DoD FMR Vol 7A Ch 1).
    // Floored, because MCO 010901 requires whole dollars and this is a ceiling.
    sevenDaysPay: Math.floor((subject / 30) * 7),
    halfMonthPay: Math.floor(subject / 2),
    payGrade: normaliseGrade(input.payGrade),
    notes,
  };
}
