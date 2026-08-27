'use client';

/**
 * The forfeiture ceiling panel, shared by every card that shows the figures.
 *
 * LIFTED OUT OF PunishmentSection ON 2026-08-27, when Stephen moved years of
 * service and sea or hardship duty pay into a card of their own and asked
 * for the ceiling to appear beside the inputs that determine it. Two
 * hand-written copies of a money table is how one of them ends up rounding,
 * labelling or attributing differently from the other, on the same screen,
 * for the same Marine. There is one copy and both cards render it.
 */

import React from 'react';
import type { ForfeitureLadder } from '@/lib/navmc10132-forfeiture-ladder';

/**
 * The forfeiture ceiling at the accused's grade and at each reduction target.
 *
 * WHY BOTH ROWS AND NOT ONE. A commanding officer choosing a reduction and a
 * forfeiture together is choosing them against different ceilings, because
 * MCM Part V para 5.c(8) prices the forfeiture on the grade REDUCED TO. One
 * figure on screen answers only half the question, and it answers it with
 * the larger number.
 *
 * THE OPERATIVE ROW IS MARKED, never merely listed first. Before a reduction
 * is recorded the top row governs, and the rows below are what would happen.
 * Once one is recorded the marking moves, and the top row stays visible as
 * the comparison the clerk needs.
 *
 * NOTHING HERE IS A BLOCKER. V-20 blocks an over-ceiling forfeiture at
 * export with the same arithmetic; this panel exists so the clerk sees the
 * limit while typing rather than after being refused.
 */
export function ForfeitureLadderPanel({ ladder }: { ladder: ForfeitureLadder }) {
  const money = (value: number) => `$${value.toLocaleString('en-US')}`;

  if (ladder.rungs.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-3 text-[11px] text-muted-foreground">
        <p className="font-medium">Maximum forfeiture: not computed.</p>
        <p>{ladder.unavailable?.detail ?? 'The app holds no figure for this accused.'}</p>
        {/* Never render an absent ceiling as an absent LIMIT. */}
        <p>A limit still applies. It has to be read from the pay table by hand.</p>
      </div>
    );
  }

  // SAME SPLIT THE PRINTED BLOCK MAKES. The figures are identical either way;
  // what differs is whether the app is vouching for the table they came from.
  // See forfeitureCeiling.tableGovernsDate and Stephen's 2026-08-27 ruling.
  const governed = ladder.rungs.every((rung) => rung.ceiling.tableGovernsDate);

  return (
    <div className="rounded-md border p-3">
      <p className="text-xs font-medium">
        {governed
          ? 'Maximum forfeiture by grade'
          : 'Maximum forfeiture by grade (planning figure)'}
      </p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-1 pr-3 text-left font-normal">Grade</th>
              <th className="py-1 pr-3 text-right font-normal">One-half month, per month</th>
              <th className="py-1 pr-3 text-right font-normal">Seven days</th>
              <th className="py-1 text-left font-normal">Basis</th>
            </tr>
          </thead>
          <tbody>
            {ladder.rungs.map((rung) => (
              <tr key={rung.ceiling.payGrade} className={rung.operative ? 'font-medium' : ''}>
                <td className="py-1 pr-3">
                  {rung.reduced ? `if reduced to ${rung.ceiling.payGrade}` : rung.ceiling.payGrade}
                </td>
                <td className="py-1 pr-3 text-right tabular-nums">{money(rung.ceiling.halfMonthPay)}</td>
                <td className="py-1 pr-3 text-right tabular-nums">{money(rung.ceiling.sevenDaysPay)}</td>
                <td className="py-1 text-left text-muted-foreground">
                  {rung.operative ? 'this forfeiture' : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {ladder.reductionBarred
          ? 'A reduction is barred at this grade, so the row above is the only lawful basis (MCO 5800.16 Vol 14).'
          : 'A forfeiture imposed with a reduction must be computed on the grade reduced to (MCM Part V para 5.c(8)).'}
      </p>
      <p className="text-[11px] text-muted-foreground">{ladder.payTable.detail}</p>
      {ladder.notes.map((note) => (
        <p key={note} className="mt-1 text-[11px] text-muted-foreground">
          {note}
        </p>
      ))}
    </div>
  );
}
