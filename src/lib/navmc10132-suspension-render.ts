/**
 * Renders item 7 ("SUSPENSION IF ANY") of NAVMC 10132 from structured
 * suspension entries, each naming the item 6 punishment it suspends by
 * index.
 *
 * Source is the form's own page 3 ITEM 7 instruction: "If no part of the
 * punishment is suspended, enter the word 'NONE.' Otherwise, indicate the
 * specific punishment, the length of the suspension, and the terms for
 * automatic remission." This module exists because a punishment never
 * imposed cannot be suspended, and free text let a clerk suspend one
 * anyway. A Navmc10132Suspension names its punishment by index into
 * Navmc10132Data.punishments rather than carrying a copy, so the two
 * cannot drift when item 6 is edited, and a dangling index (a punishment
 * removed after being suspended) is refused rather than silently rendered.
 */

import { resolvePunishment } from '@/lib/navmc10132-punishments';
import {
  renderPunishment,
  Navmc10132PunishmentRenderError,
} from '@/lib/navmc10132-punishment-render';
import { parseIsoDate, formatNavalDate } from '@/lib/navmc10132-date';
import type {
  Navmc10132PunishmentEntry,
  Navmc10132Suspension,
} from '@/types/navmc';

/** Re-exported so this module's public surface still names its own entry type. */
export type { Navmc10132Suspension } from '@/types/navmc';

/** Set-level rendering options for renderSuspension. */
export interface RenderSuspensionOptions {
  /** ISO date of imposition, item 6. */
  impositionDate?: string;
}

/**
 * Thrown when a suspension names a punishmentIndex outside the bounds of
 * the punishments array, or omits both months and days. Both are the
 * module's documented error path, thrown rather than silently skipping the
 * entry, so a dangling reference or an incomplete period cannot fail to be
 * noticed. This is the ONLY error type renderSuspension throws, an error
 * from the referenced punishment's own render is caught and rewrapped in
 * one of these rather than left to propagate as its own type.
 */
export class Navmc10132SuspensionRenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Navmc10132SuspensionRenderError';
  }
}


/**
 * States a suspension's period as "N mos" or "N days", singular "mo" and
 * "day" at 1. When a suspension carries both months and days, months wins,
 * matching the field's own doc comment, most suspensions are stated in
 * months. Throws when neither is present, naming the entry so the message
 * points at the punishment index needing correction.
 */
function periodText(suspension: Navmc10132Suspension): string {
  const months = typeof suspension.months === 'string' ? suspension.months.trim() : '';
  if (months !== '') {
    return `${months} ${months === '1' ? 'mo' : 'mos'}`;
  }
  const days = typeof suspension.days === 'string' ? suspension.days.trim() : '';
  if (days !== '') {
    return `${days} ${days === '1' ? 'day' : 'days'}`;
  }
  throw new Navmc10132SuspensionRenderError(
    `Suspension of punishment index ${suspension.punishmentIndex} needs "months" or ` +
      '"days" to state the length of the suspension.',
  );
}

/**
 * Renders one suspension's clause:
 *   [punishment text], susp for [period], at which time, unless sooner
 *   vacated, [short name] will be remitted w/o further action.
 *
 * [punishment text] comes from the EXISTING renderPunishment, rendering the
 * single referenced entry, so item 6 and item 7 never disagree about how a
 * punishment reads. Its trailing period is stripped before the suspension
 * clause continues the sentence.
 */
function renderOneSuspension(
  suspension: Navmc10132Suspension,
  punishments: readonly Navmc10132PunishmentEntry[],
): string {
  const { punishmentIndex } = suspension;
  if (
    !Number.isInteger(punishmentIndex) ||
    punishmentIndex < 0 ||
    punishmentIndex >= punishments.length
  ) {
    throw new Navmc10132SuspensionRenderError(
      `Suspension names punishmentIndex ${punishmentIndex}, which is out of bounds for ` +
        `${punishments.length} punishment${punishments.length === 1 ? '' : 's'} imposed. ` +
        'A punishment never imposed cannot be suspended.',
    );
  }

  const entry = punishments[punishmentIndex];

  let punishmentClause: string;
  try {
    // renderPunishment returns { text, length }. Only the text is used here.
    punishmentClause = renderPunishment([entry]).text;
  } catch (err) {
    if (err instanceof Navmc10132PunishmentRenderError) {
      throw new Navmc10132SuspensionRenderError(
        `Suspension of punishment index ${punishmentIndex} (code ${entry.code}) cannot ` +
          `render its punishment: ${err.message}`,
      );
    }
    throw err;
  }
  const strippedClause = punishmentClause.replace(/\.\s*$/, '');

  const period = periodText(suspension);
  const shortName = resolvePunishment(entry.code)?.shortName ?? entry.code;

  return (
    `${strippedClause}, susp for ${period}, at which time, unless sooner vacated, ` +
    `${shortName} will be remitted w/o further action.`
  );
}

/**
 * Renders item 7 ("SUSPENSION IF ANY") from structured suspension entries,
 * each 1:1 with an entry in `punishments`.
 *
 * Empty `suspensions` renders the literal word NONE, matching the item 7
 * instruction's own prescribed text for no suspension.
 *
 * A non-empty `suspensions` renders each entry through renderOneSuspension
 * and joins them with a single space, so each suspension reads as its own
 * complete sentence rather than a comma-joined clause the way renderPunishment
 * joins multiple item 6 punishments. Item 7's instruction states the required
 * elements per suspended punishment, not a combination rule for more than
 * one, so nothing here invents one beyond letting each stand on its own.
 *
 * When `options.impositionDate` is supplied and parses, the whole rendered
 * text is prefixed with the date formatted "D Mon YY", followed by a comma,
 * matching the form's own item 7 example. An unparseable or absent date
 * omits the prefix rather than throwing, since the date is a courtesy, not
 * part of the 1:1 guarantee.
 *
 * The result is never truncated. Its `length` is returned so a caller
 * compares it against item 7's printed field capacity, the same contract
 * renderPunishment already returns for item 6.
 *
 * @throws {Navmc10132SuspensionRenderError} if a suspension's
 *   punishmentIndex is out of bounds for `punishments`, if a suspension
 *   names neither months nor days, or if the referenced punishment itself
 *   cannot be rendered.
 */
export function renderSuspension(
  suspensions: readonly Navmc10132Suspension[],
  punishments: readonly Navmc10132PunishmentEntry[],
  options?: RenderSuspensionOptions,
): {
  text: string;
  length: number;
} {
  if (suspensions.length === 0) {
    const text = 'NONE';
    return { text, length: text.length };
  }

  const clauses = suspensions.map((suspension) => renderOneSuspension(suspension, punishments));
  const body = clauses.join(' ');

  const datePrefix = options?.impositionDate ? formatNavalDate(options.impositionDate) : null;
  const text = datePrefix ? `${datePrefix}, ${body}` : body;

  return { text, length: text.length };
}
