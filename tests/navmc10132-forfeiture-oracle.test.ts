import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import {
  forfeitureCeiling,
  monthlyBasicPay,
  payTableStatus,
  E1_UNDER_FOUR_MONTHS,
} from '@/lib/navmc10132-basic-pay';

/**
 * THE APP'S FORFEITURE CEILINGS, CHECKED AGAINST A TABLE THE APP DID NOT
 * PRODUCE.
 *
 * Every other test of this arithmetic checks it against itself: a fixture
 * written from the same DFAS rates the module holds, so a transcription error
 * in those rates would pass every one of them. The fixture beside this file is
 * different. It is the Marine Corps CY26 active duty maximum forfeiture table,
 * supplied by Stephen on 2026-08-26 and produced by the pay office rather than
 * by this app, and it states the finished dollar figures. It can therefore
 * catch three things nothing else here can: a mistyped pay rate, a wrong
 * rounding rule, and a wrong divisor.
 *
 * WHAT IT CANNOT CATCH, measured rather than assumed. The table states whole
 * dollars, and the ceilings are floored, so each cell pins its monthly rate
 * only to a window of a few dollars. Perturbing one E-4 rate and rerunning
 * this file: 10 cents passes, $1.00 passes, $3.00 fails. So this oracle
 * proves the arithmetic and bounds the rates; it does not verify them to the
 * cent, and PAY_TABLE_CELL_DIGEST in navmc10132-basic-pay.ts remains the
 * guard against a rate being edited at all.
 *
 * THE TABLE'S THREE LEVELS, and which of them this app is about:
 *
 *   A. 7 DAYS - CO GRADE      Article 15(b)(2)(C), 10 U.S.C. 815(b)(2)(C).
 *                             The N07 punishment. floor(monthly / 30 * 7).
 *   B. 15 DAYS - FIELD GRADE  One-half of one month's pay, the field grade
 *                             ceiling. The N04 punishment. floor(monthly / 2),
 *                             which is the same figure as fifteen days at a
 *                             daily rate of one thirtieth.
 *   C. 2/3 MONTH - SPCM       NOT NONJUDICIAL PUNISHMENT. Two-thirds of a
 *                             month is the special court-martial forfeiture
 *                             limit, and no Article 15 authority may impose
 *                             it. It is checked here anyway, because the
 *                             arithmetic shares the same pay rate and a rate
 *                             typo would show in all three columns. Nothing
 *                             in the app offers it.
 *
 * THE TABLE'S ROWS THIS APP CANNOT PRICE. W-1 through W-5 and O-1 through
 * O-5, including the O-1E/O-2E/O-3E variants, are in the table and NOT in
 * this module: MONTHLY_BASIC_PAY holds enlisted rates only. An officer or
 * warrant officer taken to NJP therefore gets no computed ceiling and no
 * over-ceiling gate. That is a known scope gap, asserted below so it is a
 * recorded decision rather than a silent hole.
 */

interface OracleCell {
  level: 'A' | 'B' | 'C';
  rank: string;
  years: number;
  maximum: number;
}

function oracleCells(): OracleCell[] {
  const csv = readFileSync(
    path.resolve(__dirname, 'fixtures/usmc-cy26-max-forfeitures.csv'),
    'utf8',
  );
  const lines = csv.trim().split('\n');
  const yearColumns = lines[0].split(',').slice(3).map(Number);
  const cells: OracleCell[] = [];
  for (const line of lines.slice(1)) {
    const parts = line.split(',');
    const level = parts[1].trim().charAt(0) as 'A' | 'B' | 'C';
    const rank = parts[2].trim();
    parts.slice(3).forEach((value, i) => {
      cells.push({ level, rank, years: yearColumns[i], maximum: Number(value) });
    });
  }
  return cells;
}

const CELLS = oracleCells();
/** A date inside the held table's window, so nothing is refused as stale. */
const STATUS = payTableStatus('2026-03-01');

/**
 * The table's E0 row is an E-1 inside four months of active duty, which this
 * module holds as a constant rather than a table row because the form carries
 * no months-of-service field. Checked separately, below.
 */
const ENLISTED = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9'];

describe('the CY26 maximum forfeiture table as an independent oracle', () => {
  it('reads 70 rows and 390 enlisted cells, so a truncated fixture cannot pass quietly', () => {
    expect(CELLS.length).toBe(69 * 13);
    expect(CELLS.filter((c) => ENLISTED.includes(c.rank)).length).toBe(9 * 3 * 13);
  });

  it('agrees on every seven days pay figure, every enlisted grade and length of service', () => {
    const wrong: string[] = [];
    for (const cell of CELLS) {
      if (cell.level !== 'A' || !ENLISTED.includes(cell.rank)) continue;
      const result = forfeitureCeiling({ status: STATUS, payGrade: cell.rank, yearsOfService: cell.years });
      if (result.kind !== 'ceiling') {
        wrong.push(`${cell.rank}/${cell.years}: no ceiling (${result.reason})`);
        continue;
      }
      if (result.ceiling.sevenDaysPay !== cell.maximum) {
        wrong.push(`${cell.rank}/${cell.years}: app ${result.ceiling.sevenDaysPay}, table ${cell.maximum}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('agrees on every one-half month figure, which is the fifteen days the table names', () => {
    const wrong: string[] = [];
    for (const cell of CELLS) {
      if (cell.level !== 'B' || !ENLISTED.includes(cell.rank)) continue;
      const result = forfeitureCeiling({ status: STATUS, payGrade: cell.rank, yearsOfService: cell.years });
      if (result.kind !== 'ceiling') {
        wrong.push(`${cell.rank}/${cell.years}: no ceiling (${result.reason})`);
        continue;
      }
      if (result.ceiling.halfMonthPay !== cell.maximum) {
        wrong.push(`${cell.rank}/${cell.years}: app ${result.ceiling.halfMonthPay}, table ${cell.maximum}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  // The SPCM column is not an NJP ceiling and the app offers no punishment
  // that reaches it. It is derived here purely as a third check on the same
  // pay rate: a mistyped rate that somehow rounded to the right answer at
  // seven days and half a month would not survive two thirds as well.
  it('agrees on the SPCM two-thirds column, as a third check on the same rates', () => {
    const wrong: string[] = [];
    for (const cell of CELLS) {
      if (cell.level !== 'C' || !ENLISTED.includes(cell.rank)) continue;
      const result = forfeitureCeiling({ status: STATUS, payGrade: cell.rank, yearsOfService: cell.years });
      if (result.kind !== 'ceiling') {
        wrong.push(`${cell.rank}/${cell.years}: no ceiling (${result.reason})`);
        continue;
      }
      const twoThirds = Math.floor((result.ceiling.monthlySubjectToForfeiture * 2) / 3);
      if (twoThirds !== cell.maximum) {
        wrong.push(`${cell.rank}/${cell.years}: app ${twoThirds}, table ${cell.maximum}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('agrees on the E-1 inside four months, the table\'s E0 row', () => {
    const seven = CELLS.find((c) => c.level === 'A' && c.rank === 'E0');
    const half = CELLS.find((c) => c.level === 'B' && c.rank === 'E0');
    expect(seven?.maximum).toBe(Math.floor((E1_UNDER_FOUR_MONTHS / 30) * 7));
    expect(half?.maximum).toBe(Math.floor(E1_UNDER_FOUR_MONTHS / 2));
  });
});

describe('the cells DFAS leaves blank, which the forfeiture table does not', () => {
  // The pay table prints nothing for an E-8 below eight years or an E-9 below
  // ten. The forfeiture table prints a figure in all of them, and it is the
  // grade's lowest published rate. Before 2026-08-26 the app returned no
  // ceiling for those cells, which silenced the over-ceiling gate on the two
  // grades with the largest lawful maximums.
  it('still reports the pay lookup itself as a blank cell, truthfully', () => {
    expect(monthlyBasicPay('E8', 2).kind).toBe('unavailable');
    expect(monthlyBasicPay('E9', 5).kind).toBe('unavailable');
  });

  it('computes a ceiling anyway, matching the forfeiture table cell for cell', () => {
    for (const rank of ['E8', 'E9']) {
      for (const cell of CELLS.filter((c) => c.rank === rank && c.level === 'A')) {
        const result = forfeitureCeiling({ status: STATUS, payGrade: rank, yearsOfService: cell.years });
        expect(result.kind, `${rank}/${cell.years}`).toBe('ceiling');
        if (result.kind === 'ceiling') {
          expect(result.ceiling.sevenDaysPay, `${rank}/${cell.years}`).toBe(cell.maximum);
        }
      }
    }
  });

  it('says so in a note, so the figure is never presented as a printed rate', () => {
    const result = forfeitureCeiling({ status: STATUS, payGrade: 'E8', yearsOfService: 2 });
    expect(result.kind).toBe('ceiling');
    if (result.kind !== 'ceiling') return;
    expect(result.ceiling.notes.some((n) => n.includes('prints no rate'))).toBe(true);
    // And the note names the length of service as the thing to check, because
    // a mistyped one is how most Marines land in a blank cell.
    expect(result.ceiling.notes.some((n) => n.includes('length of service'))).toBe(true);
  });

  it('does NOT floor an unreadable grade or an unfilled one', () => {
    // Only a blank cell gets the floor. Everything else is a data error or an
    // unfinished form, where a computed figure would be a guess.
    expect(forfeitureCeiling({ status: STATUS, payGrade: 'E12', yearsOfService: 2 }).kind).toBe('unavailable');
    expect(forfeitureCeiling({ status: STATUS, payGrade: '', yearsOfService: 2 }).kind).toBe('unavailable');
    expect(forfeitureCeiling({ status: STATUS, payGrade: 'E5', yearsOfService: '' }).kind).toBe('unavailable');
  });
});

describe('the ranks in the table this app cannot price', () => {
  // A RECORDED GAP, not an oversight discovered later. Officers and warrant
  // officers receive nonjudicial punishment, the forfeiture table prices
  // them, and this module holds no rates for them, so no ceiling is computed
  // and no over-ceiling gate fires. Adding those rows is a data decision with
  // legal consequence, so it waits on a ruling rather than being guessed at.
  const OFFICER_RANKS = ['W1', 'W2', 'W3', 'W4', 'W5', 'O1', 'O1E', 'O2', 'O2E', 'O3', 'O3E', 'O4', 'O5'];

  it('are in the oracle table', () => {
    for (const rank of OFFICER_RANKS) {
      expect(CELLS.some((c) => c.rank === rank), rank).toBe(true);
    }
  });

  it('produce no ceiling, and no silently wrong one', () => {
    for (const rank of OFFICER_RANKS) {
      const result = forfeitureCeiling({ status: STATUS, payGrade: rank, yearsOfService: 10 });
      expect(result.kind, rank).toBe('unavailable');
      // 'unreadable-grade' is in CEILING_REASONS_WORTH_SURFACING, so a clerk
      // pricing an officer sees a message rather than a blank.
      if (result.kind === 'unavailable') expect(result.reason).toBe('unreadable-grade');
    }
  });
});
