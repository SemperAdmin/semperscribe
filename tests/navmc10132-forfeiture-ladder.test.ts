/**
 * The forfeiture ceiling at every grade a reduction could reach.
 *
 * MCM Part V para 5.c(8): "If the punishment includes both reduction,
 * whether or not suspended, and forfeiture of pay, the forfeiture must be
 * based on the grade to which reduced." The reduced grade always prices
 * LOWER, so a clerk working from the current grade alone errs toward an
 * unlawful forfeiture rather than a lenient one. Every assertion below is
 * about keeping that error impossible to make silently.
 *
 * STEPHEN, 2026-08-26: show both, mark the reduced grade operative.
 */

import { describe, it, expect } from 'vitest';
import { forfeitureLadder, operativeRung } from '@/lib/navmc10132-forfeiture-ladder';

const DATE = '2026-08-20';

describe('the rungs', () => {
  /**
   * ONE RUNG DOWN, NEVER A LADDER TO E-1. Stephen, 2026-08-26: "there can
   * only be a reduction of one rank." MCO 5800.16 Vol 14 para 010302.C
   * narrows Marine reductions to the next inferior paygrade, stricter than
   * 10 U.S.C. 815(b)(2)(H)(iv), and N08 is the only reduction code this app
   * offers. The first version of this module listed every grade below the
   * accused's, pricing punishments no commander may impose.
   */
  it('is the accused grade and the ONE grade below it, not every grade below', () => {
    const ladder = forfeitureLadder({ payGrade: 'E4', yearsOfService: '4', punishmentDate: DATE });
    expect(ladder.rungs.map((r) => r.ceiling.payGrade)).toEqual(['E4', 'E3']);
    expect(ladder.rungs[0].reduced).toBe(false);
    expect(ladder.rungs[1].reduced).toBe(true);
  });

  it('stops one grade down from every grade, not only from E-4', () => {
    for (const [from, to] of [['E5', 'E4'], ['E3', 'E2'], ['E2', 'E1']] as const) {
      const ladder = forfeitureLadder({ payGrade: from, yearsOfService: '4', punishmentDate: DATE });
      expect(ladder.rungs.map((r) => r.ceiling.payGrade)).toEqual([from, to]);
    }
  });

  // The whole reason the ladder exists. If these were equal there would be
  // nothing to choose between and 5.c(8) would be decoration.
  it('the reduced rung prices strictly lower than the accused own grade', () => {
    const ladder = forfeitureLadder({ payGrade: 'E5', yearsOfService: '6', punishmentDate: DATE });
    expect(ladder.rungs[1].ceiling.halfMonthPay).toBeLessThan(ladder.rungs[0].ceiling.halfMonthPay);
    expect(ladder.rungs[1].ceiling.sevenDaysPay).toBeLessThan(ladder.rungs[0].ceiling.sevenDaysPay);
  });

  it('an E-1 has one rung, because there is nowhere below', () => {
    const ladder = forfeitureLadder({ payGrade: 'E1', yearsOfService: '1', punishmentDate: DATE });
    expect(ladder.rungs).toHaveLength(1);
    expect(ladder.rungs[0].reduced).toBe(false);
  });

  // MCO 5800.16 Vol 14 bars reduction above a floor. The panel must say so
  // rather than showing one row and letting it read as a missing input.
  it('reports a barred reduction as barred, not as a missing figure', () => {
    const ladder = forfeitureLadder({ payGrade: 'E7', yearsOfService: '14', punishmentDate: DATE });
    expect(ladder.reductionBarred).toBe(true);
    expect(ladder.rungs).toHaveLength(1);
    expect(ladder.unavailable).toBeUndefined();
  });
});

describe('which rung is operative', () => {
  it('is the accused own grade before any reduction is recorded', () => {
    const ladder = forfeitureLadder({ payGrade: 'E4', yearsOfService: '4', punishmentDate: DATE });
    expect(operativeRung(ladder)?.ceiling.payGrade).toBe('E4');
  });

  it('moves to the reduced grade once a reduction is recorded', () => {
    const ladder = forfeitureLadder({
      payGrade: 'E4', yearsOfService: '4', punishmentDate: DATE, gradeReducedTo: 'E3',
    });
    expect(operativeRung(ladder)?.ceiling.payGrade).toBe('E3');
    expect(ladder.rungs.filter((r) => r.operative)).toHaveLength(1);
  });

  // The picker stores a RANK abbreviation for a Marine, and a bare pay grade
  // for a service with no rank list. Both shapes reach this function.
  it('accepts a rank abbreviation as the reduction target', () => {
    const ladder = forfeitureLadder({
      payGrade: 'E4', yearsOfService: '4', punishmentDate: DATE, gradeReducedTo: 'LCpl',
    });
    expect(operativeRung(ladder)?.ceiling.payGrade).toBe('E3');
  });

  /**
   * NOTHING OPERATIVE IS THE TRUTHFUL ANSWER when the target names a grade
   * the ladder cannot price. Falling back to the current grade would mark
   * the HIGHER figure as the lawful basis, which is the 5.c(8) error with
   * the app's name on it. V-18 blocks export on an unresolvable target
   * separately.
   */
  it('marks nothing operative rather than falling back to the higher figure', () => {
    const ladder = forfeitureLadder({
      payGrade: 'E4', yearsOfService: '4', punishmentDate: DATE, gradeReducedTo: 'Sergeant Major',
    });
    expect(ladder.rungs.length).toBeGreaterThan(0);
    expect(operativeRung(ladder)).toBeNull();
  });

  // The same rule reached a second way. A reduction of two grades is not a
  // punishment any Marine commander may impose, so no rung prices it, and
  // marking the accused's own grade operative would present the HIGHER
  // figure as the lawful basis for a forfeiture nobody may lawfully pair
  // with that reduction.
  it('marks nothing operative for a reduction of more than one grade', () => {
    const ladder = forfeitureLadder({
      payGrade: 'E4', yearsOfService: '4', punishmentDate: DATE, gradeReducedTo: 'E1',
    });
    expect(ladder.rungs.map((r) => r.ceiling.payGrade)).toEqual(['E4', 'E3']);
    expect(operativeRung(ladder)).toBeNull();
  });
});

describe('when the app declines', () => {
  /**
   * REVERSED ON 2026-08-27. This case used to assert that an undated item 6
   * returned no rungs at all. Stephen: "calculating the possibly max forf
   * from the table based on the YOS and the grade should not require anything
   * but the two elements."
   *
   * The date never selected a different CELL, only whether the app vouched
   * for the one it read, so the ladder now prices and flags. The cost of the
   * old rule was total: every A-1-f script is generated before the hearing,
   * so item 6 never carries a date when one is printed, so no script this app
   * produced had ever shown a ceiling.
   */
  it('still prices both rungs when the punishment date is unset', () => {
    const ladder = forfeitureLadder({ payGrade: 'E4', yearsOfService: '4', punishmentDate: '' });
    expect(ladder.rungs.map((r) => r.ceiling.payGrade)).toEqual(['E4', 'E3']);
    expect(ladder.unavailable).toBeUndefined();
  });

  it('marks every rung as priced on a table that does not govern the date', () => {
    const ladder = forfeitureLadder({ payGrade: 'E4', yearsOfService: '4', punishmentDate: '' });
    expect(ladder.rungs.every((r) => r.ceiling.tableGovernsDate)).toBe(false);
    expect(ladder.rungs[0].ceiling.payTableDetail).toContain('item 6 punishment date');
  });

  // The dated ladder is the same ladder plus the vouching. Asserted against
  // the undated one so a fallback that priced a different grade would fail.
  it('prices the identical figures once a date is set, and then vouches for them', () => {
    const undated = forfeitureLadder({ payGrade: 'E4', yearsOfService: '4', punishmentDate: '' });
    const dated = forfeitureLadder({ payGrade: 'E4', yearsOfService: '4', punishmentDate: DATE });
    expect(dated.rungs.map((r) => r.ceiling.sevenDaysPay)).toEqual(
      undated.rungs.map((r) => r.ceiling.sevenDaysPay),
    );
    expect(dated.rungs.every((r) => r.ceiling.tableGovernsDate)).toBe(true);
  });

  it('returns no rungs when item 19 carries no pay grade', () => {
    const ladder = forfeitureLadder({ payGrade: '', yearsOfService: '4', punishmentDate: DATE });
    expect(ladder.rungs).toEqual([]);
    expect(ladder.unavailable).toBeDefined();
  });

  // Never both. A caller printing `unavailable` beside a figure would be
  // showing a ceiling and an explanation of why there is none.
  it('never carries rungs and an unavailable reason at the same time', () => {
    for (const input of [
      { payGrade: 'E4', yearsOfService: '4', punishmentDate: DATE },
      { payGrade: '', yearsOfService: '4', punishmentDate: DATE },
      { payGrade: 'E4', yearsOfService: '', punishmentDate: DATE },
      { payGrade: 'E4', yearsOfService: '4', punishmentDate: '' },
    ]) {
      const ladder = forfeitureLadder(input);
      expect(ladder.rungs.length > 0 && ladder.unavailable !== undefined).toBe(false);
    }
  });
});

describe('sea and hardship duty pay', () => {
  // JAGMAN 0111.i: pay subject to forfeiture is basic pay PLUS sea duty or
  // hardship duty pay. Omitting it prices the ceiling BELOW the lawful one.
  it('raises every rung, not only the accused own grade', () => {
    const without = forfeitureLadder({ payGrade: 'E4', yearsOfService: '4', punishmentDate: DATE });
    const with300 = forfeitureLadder({
      payGrade: 'E4', yearsOfService: '4', punishmentDate: DATE, seaHardshipDutyPay: '300',
    });
    expect(with300.rungs).toHaveLength(without.rungs.length);
    for (let i = 0; i < with300.rungs.length; i += 1) {
      expect(with300.rungs[i].ceiling.halfMonthPay).toBeGreaterThan(without.rungs[i].ceiling.halfMonthPay);
    }
  });
});
