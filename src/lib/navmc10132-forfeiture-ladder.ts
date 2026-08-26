/**
 * The maximum forfeiture at the accused's grade, and at every grade a
 * reduction could take them to.
 *
 * WHY A LADDER AND NOT ONE NUMBER. MCM Part V para 5.c(8): "If the
 * punishment includes both reduction, whether or not suspended, and
 * forfeiture of pay, the forfeiture must be based on the grade to which
 * reduced." A commanding officer deciding at the hearing is choosing the
 * reduction and the forfeiture together, so the ceiling moves as the
 * reduction moves. One number computed on the current grade is the exact
 * error the rule exists to prevent, and it is always the HIGHER number, so
 * the error runs toward an unlawful punishment rather than a lenient one.
 *
 * STEPHEN'S RULING, 2026-08-26: show both, and mark the reduced grade as
 * operative. Showing only the lawful figure hides what the reduction costs;
 * showing only the current one invites the 5.c(8) error.
 *
 * THIS MODULE COMPUTES, IT DOES NOT DECIDE. Every rung comes from
 * forfeitureCeiling in navmc10132-basic-pay.ts, which declines rather than
 * guesses whenever the pay table is superseded, the grade is unset or
 * unreadable, or the length of service is missing. A declined ladder carries
 * the reason, and no caller is handed a figure the app cannot stand behind.
 */

import {
  forfeitureCeiling,
  payTableStatus,
  type ForfeitureCeiling,
  type ForfeitureCeilingUnavailable,
  type PayTableStatus,
} from '@/lib/navmc10132-basic-pay';
import {
  reducibleGrades,
  reductionBarred,
  reducedPayGrade,
  type Navmc10132Service,
} from '@/lib/navmc10132-ranks';

/** One grade's ceilings. `ForfeitureCeiling` already carries the figures. */
export interface ForfeitureRung {
  ceiling: ForfeitureCeiling;
  /** True where a reduction to this grade is what makes it the lawful basis. */
  reduced: boolean;
  /** True for the rung a forfeiture must actually be computed on today. */
  operative: boolean;
}

export interface ForfeitureLadder {
  /** The accused's grade as item 19 carries it, or the empty string. */
  currentPayGrade: string;
  /** Current grade first, then each reduction target, senior to junior. */
  rungs: ForfeitureRung[];
  /**
   * Why no rung could be computed. Present ONLY when `rungs` is empty, and
   * the caller prints it instead of a ceiling. Never both.
   */
  unavailable?: { reason: ForfeitureCeilingUnavailable; detail: string };
  /**
   * True where the accused's grade cannot be reduced at all, so the ladder
   * is one rung by law rather than by a missing input. E-1 has nowhere to
   * go, and the USMC bars reduction above a floor (MCO 5800.16 Vol 14).
   */
  reductionBarred: boolean;
  /** Carried through from the ceiling computation. See forfeitureCeiling. */
  notes: string[];
  /** The pay table the figures came from, for the printed attribution. */
  payTable: PayTableStatus;
}

export interface ForfeitureLadderInput {
  /** Item 19's pay grade. */
  payGrade: string;
  yearsOfService: string | number;
  seaHardshipDutyPay?: string | number;
  /** Item 6's date, which selects the pay table in force. */
  punishmentDate: string;
  /**
   * The reduction target ALREADY recorded in item 6, as a rank abbreviation
   * or a bare pay grade. Where one is present it names the operative rung.
   * Empty before the commanding officer has decided, which is the ordinary
   * state when the hearing script is printed.
   */
  gradeReducedTo?: string;
  service?: Navmc10132Service;
}

/**
 * Builds the ladder. Never throws.
 *
 * THE FIRST RUNG'S FAILURE IS THE LADDER'S FAILURE, and a later rung's is
 * not. If the current grade cannot be computed, nothing can, and the reason
 * is the one worth showing. If one reduction target's cell is blank in the
 * pay table while others resolve, the ladder simply carries fewer rungs: a
 * missing cell is a fact about that grade, not a reason to withhold the
 * figures the app does have.
 */
export function forfeitureLadder(input: ForfeitureLadderInput): ForfeitureLadder {
  const status = payTableStatus(input.punishmentDate);
  const service = input.service ?? 'USMC';
  const current = input.payGrade.trim();
  const barred = current === '' ? false : reductionBarred(current, service);

  const compute = (grade: string) =>
    forfeitureCeiling({
      status,
      payGrade: grade,
      yearsOfService: input.yearsOfService,
      seaHardshipDutyPay: input.seaHardshipDutyPay,
    });

  const base = compute(current);
  if (base.kind === 'unavailable') {
    return {
      currentPayGrade: current,
      rungs: [],
      unavailable: { reason: base.reason, detail: base.detail },
      reductionBarred: barred,
      notes: [],
      payTable: status,
    };
  }

  // The recorded reduction target, normalised to a pay grade. `reducedPayGrade`
  // accepts both shapes the app stores, a rank abbreviation and a bare grade,
  // because the picker offers ranks while other services fall back to grades.
  //
  // NO TARGET AND AN UNREADABLE TARGET ARE DIFFERENT, and collapsing them is
  // the 5.c(8) error with this app's name on it. With no reduction recorded
  // the accused's own grade IS the lawful basis. With a reduction recorded to
  // a grade this app cannot price, the lawful basis is a figure the app does
  // not hold, and marking the current grade operative would present the
  // HIGHER number as lawful. Caught by this module's own test, which asserted
  // the rule the first implementation quietly broke.
  const raw = (input.gradeReducedTo ?? '').trim();
  const target = reducedPayGrade(raw);
  const targetUnreadable = raw !== '' && target === '';

  const rungs: ForfeitureRung[] = [
    { ceiling: base.ceiling, reduced: false, operative: raw === '' },
  ];

  for (const grade of reducibleGrades(current, { service })) {
    const result = compute(grade);
    if (result.kind !== 'ceiling') continue;
    rungs.push({
      ceiling: result.ceiling,
      reduced: true,
      operative: !targetUnreadable && target !== '' && grade === target,
    });
  }

  // A target naming a grade no rung covers leaves NOTHING operative, which is
  // truthful: the app has been told the forfeiture rests on a grade it cannot
  // price, and marking the current grade operative instead would print the
  // higher figure as lawful. V-18 already blocks export on a target this app
  // cannot resolve, so the gap is visible elsewhere too.
  return {
    currentPayGrade: current,
    rungs,
    reductionBarred: barred,
    notes: base.ceiling.notes,
    payTable: status,
  };
}

/** The rung a forfeiture must be computed on today, if the app knows it. */
export function operativeRung(ladder: ForfeitureLadder): ForfeitureRung | null {
  return ladder.rungs.find((rung) => rung.operative) ?? null;
}
