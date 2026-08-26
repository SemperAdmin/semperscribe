/**
 * The two app-built blocks the A-1-f hearing script carries: the punishment
 * menu the commanding officer marks, and the forfeiture ceilings the app
 * computed.
 *
 * STEPHEN'S WORKFLOW, 2026-08-26, in his own words: "The script will be
 * printed and provided to the co. Once the event is done that take that and
 * upload the form where they will then add the punishments and suspensions."
 * So the script is a WORKING DOCUMENT. Item 6 is empty when it prints,
 * because the commanding officer has not decided yet, and the clerk
 * transcribes the marked paper into the app afterwards. A menu of what has
 * already been typed would be a menu of nothing.
 *
 * THE MENU IS DERIVED FROM THE PUNISHMENT TABLE, never hand-authored. Every
 * line comes from the same `template` string renderPunishment interpolates
 * into item 6, with the parameters blanked. Two things follow, and both are
 * the point: the paper speaks the abbreviation vocabulary the clerk will
 * type back in, and a change to the table changes the paper. A second list
 * written out by hand here would drift from the first the day a code moved.
 *
 * WHAT IS JAGMAN TEXT AND WHAT IS NOT. A-1-f is a JAGMAN appendix. The menu
 * and the ceilings are neither, they are app output printed into the
 * appendix's own blank rule, and the ceiling block says so on its face. A
 * commanding officer reading a dollar figure at a hearing is entitled to
 * know it came from a pay table this app holds and a grade a clerk typed,
 * rather than from the Manual.
 */

import {
  releaseOnePunishmentsFor,
  type Navmc10132Punishment,
} from '@/lib/navmc10132-punishments';
import { PAY_TABLE_WINDOW } from '@/lib/navmc10132-basic-pay';
import { punishmentRuleBudget } from '@/lib/njp-a1-script';
import { wrapHanging } from '@/lib/jagman-a1-wrap';
import type { ForfeitureLadder } from '@/lib/navmc10132-forfeiture-ladder';

/**
 * What each template placeholder becomes on a blank worksheet line.
 *
 * The two that are not blanks are deliberate. `suspClause` and
 * `oralOrWritten` are CHOICES between two fixed wordings rather than values,
 * so the paper offers both and the commanding officer rings one, exactly as
 * the appendix's own parentheticals do.
 */
const BLANKS: Readonly<Record<string, string>> = {
  limits: '______',
  days: '___',
  months: '__',
  // NO LEADING DOLLAR SIGN. Every money placeholder in the punishment table
  // is already written as `${dollars}` in its template, so a blank carrying
  // its own sign prints "$$______".
  dollars: '______',
  dollarsPerMonth: '______',
  totalForf: '______',
  gradeReducedTo: '______',
  suspClause: 'w/ or w/o susp fr du',
  oralOrWritten: 'orally / in writing',
};

/** The statutory cap a code names, worded for a form line. */
function capNote(punishment: Navmc10132Punishment): string {
  if (punishment.maxDays !== undefined) return `max ${punishment.maxDays} d`;
  if (punishment.maxDaysPay !== undefined) return `max ${punishment.maxDaysPay} d pay`;
  if (punishment.maxMonths !== undefined) return `max ${punishment.maxMonths} mo, see ceiling below`;
  return '';
}

/** A menu line split at its label, so a continuation hangs under the text. */
export interface MenuLine {
  /** "[ ] N11  ", the part a continuation line must not repeat. */
  label: string;
  /** The blanked template and its cap note. */
  body: string;
}

/** One menu line, unwrapped. The caller fits it to the appendix measure. */
export function menuLine(punishment: Navmc10132Punishment): MenuLine {
  const body = punishment.template
    .replace(/\{(\w+)\}/g, (match, name: string) => BLANKS[name] ?? match)
    // The template's trailing period closes a SENTENCE in item 6. On a form
    // line with a blank still in it, it reads as an end where none has been
    // reached yet.
    .replace(/\.$/, '');
  const cap = capNote(punishment);
  return {
    label: `[ ] ${punishment.code}  `,
    body: `${body}${cap === '' ? '' : ` (${cap})`}`,
  };
}

/**
 * Every punishment this authority may impose, as marked-up form lines.
 *
 * FILTERED BY ITEM 8A, and empty when item 8A carries no readable pay grade.
 * A company-grade commander handed a field-grade menu has been invited to
 * impose a punishment beyond the authority, which is worse than being handed
 * no menu at all. `releaseOnePunishmentsFor` reports an unreadable or absent
 * grade as `unverified` rather than available, and this refuses to guess.
 */
export function punishmentMenu(authorityPayGrade: string): string[] {
  if (authorityPayGrade.trim() === '') return [];
  const available = releaseOnePunishmentsFor(authorityPayGrade);
  if (available.some((entry) => entry.unverified)) return [];
  const budget = punishmentRuleBudget();
  return available
    .filter((entry) => entry.available)
    // The NAVMC 10132 is an ENLISTED record. An officer-only code has no
    // place on its worksheet even where the authority could impose one.
    .filter((entry) => entry.punishment.appliesTo !== 'officer')
    .flatMap((entry) => {
      const line = menuLine(entry.punishment);
      return wrapHanging(line.body, budget, line.label);
    });
}

/** Whole dollars with thousands separators, as a form line prints them. */
function money(value: number): string {
  return `$${value.toLocaleString('en-US')}`;
}

/**
 * The ceilings, as printed lines, or an explanation of why there are none.
 *
 * NEVER SILENT. A worksheet with no ceiling and no reason on it reads as a
 * worksheet with no ceiling, and a commanding officer would be entitled to
 * take that as "no limit". Where the ladder declines, this prints the
 * decline.
 */
export function forfeitureCeilingBlock(ladder: ForfeitureLadder): string[] {
  // NO URL ON THE PAPER. A DFAS pay-table address is one unbreakable token
  // far wider than the appendix measure, so printing it forces a line past
  // the margin the rest of the document holds to. The app shows the source
  // link on screen, where it can be clicked; the paper names the table and
  // its date, which is what a reader at a hearing needs.
  const attribution =
    `Computed by this app from the DFAS basic pay table effective ` +
    `${PAY_TABLE_WINDOW.effectiveFrom}. App output, not JAGMAN text.`;

  if (ladder.rungs.length === 0) {
    return [
      'MAXIMUM FORFEITURE: not computed.',
      ladder.unavailable?.detail ?? 'The app holds no figure for this accused.',
      attribution,
    ];
  }

  const lines = ['MAXIMUM FORFEITURE', attribution, ''];

  for (const rung of ladder.rungs) {
    const label = rung.reduced ? `If red to ${rung.ceiling.payGrade}` : `At ${rung.ceiling.payGrade} now`;
    lines.push(
      `  ${label.padEnd(16)}1/2 mo ${money(rung.ceiling.halfMonthPay)}/mo` +
        `   7 days ${money(rung.ceiling.sevenDaysPay)}`,
    );
  }

  lines.push('');
  lines.push(
    ladder.reductionBarred
      ? 'A reduction is barred at this grade, so the figure above is the ' +
        'only basis (MCO 5800.16 Vol 14).'
      : 'A forfeiture imposed together with a reduction must be computed on ' +
        'the grade reduced to (MCM Part V para 5.c(8)).',
  );
  for (const note of ladder.notes) lines.push(note);

  return lines;
}
