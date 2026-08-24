/**
 * Renders item 6 ("PUNISHMENT IMPOSED") of NAVMC 10132 from structured
 * punishment entries, using the `template` string carried by each code in
 * navmc10132-punishments.ts.
 *
 * The trailing punishment imposition date is a separate PDF field and is
 * never part of the output here. See MCO 5800.16 Vol 14 para 011105.F for
 * the six worked examples this module was built and checked against.
 */

import {
  resolvePunishment,
  type Navmc10132Punishment,
} from '@/lib/navmc10132-punishments';
import type { Navmc10132PunishmentEntry } from '@/types/navmc';

/** Re-exported so this module's public surface still names its own entry type. */
export type { Navmc10132PunishmentEntry } from '@/types/navmc';

/**
 * The entry fields a template placeholder can name. "code" is excluded on
 * purpose, it identifies which template to use, it is not itself a value a
 * template interpolates.
 */
type EntryParamKey = Exclude<keyof Navmc10132PunishmentEntry, 'code'>;

/** Every key of EntryParamKey, used to recognise one at runtime from a regex match. */
const ENTRY_PARAM_KEYS: readonly EntryParamKey[] = [
  'days',
  'limits',
  'suspendedFromDuty',
  'dollars',
  'dollarsPerMonth',
  'months',
  'gradeReducedTo',
  'oralOrWritten',
];

/**
 * Narrows a placeholder name, read from a template string at runtime, to
 * EntryParamKey. A template's placeholders are only known once the code
 * table is loaded, so this check itself happens at runtime, but it lets
 * every lookup after it be fully typed against the real entry shape
 * instead of a cast through Record<string, unknown>.
 */
function isEntryParamKey(name: string): name is EntryParamKey {
  return (ENTRY_PARAM_KEYS as readonly string[]).includes(name);
}

/** Typed accessor. Only compiles for a key EntryParamKey actually has. */
function entryValue(
  entry: Navmc10132PunishmentEntry,
  key: EntryParamKey
): string | boolean | undefined {
  return entry[key];
}

/**
 * Thrown when an entry names a code that is not in the NAVMC 10132 table,
 * or omits a parameter its code's template requires. This is the module's
 * documented error path per REQUIREMENTS item 4, thrown rather than
 * silently skipping the entry, so a bad code cannot fail to be noticed.
 */
export class Navmc10132PunishmentRenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Navmc10132PunishmentRenderError';
  }
}

/** Strips $ and thousands separators from a money string and parses it. */
function parseMoney(raw: string): number {
  const cleaned = raw.replace(/[^0-9.\-]/g, '');
  const value = Number(cleaned);
  if (!Number.isFinite(value)) {
    throw new Navmc10132PunishmentRenderError(
      `Cannot parse "${raw}" as a dollar amount.`
    );
  }
  return value;
}

/** Formats a number with thousands separators, the way the MCO's own worked example (2) does for $500. */
function formatMoney(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/**
 * Fills in one code's template from its entry's parameters and the two
 * computed placeholders. {suspClause} and {totalForf} are handled by name
 * BEFORE the typed EntryParamKey lookup below, because they are computed
 * values, not fields the entry type stores. Every other placeholder name
 * must narrow to EntryParamKey to be looked up at all, so a template that
 * names a field Navmc10132PunishmentEntry does not have is a thrown error
 * here rather than a silent undefined.
 *
 * Exported (as renderTemplate, further down) so the EntryParamKey guard
 * above can be exercised directly in tests against a template that is not
 * one of the seventeen real codes.
 */
function interpolate(
  punishment: Navmc10132Punishment,
  entry: Navmc10132PunishmentEntry
): string {
  const filled = punishment.template.replace(/\{(\w+)\}/g, (_match, name: string) => {
    if (name === 'suspClause') {
      if (entry.suspendedFromDuty === undefined) {
        throw new Navmc10132PunishmentRenderError(
          `Code ${punishment.code} needs "suspendedFromDuty" to fill {suspClause}.`
        );
      }
      return entry.suspendedFromDuty ? 'w/susp fr du' : 'w/o susp fr du';
    }
    if (name === 'totalForf') {
      if (entry.dollarsPerMonth === undefined || entry.months === undefined) {
        throw new Navmc10132PunishmentRenderError(
          `Code ${punishment.code} needs "dollarsPerMonth" and "months" to fill {totalForf}.`
        );
      }
      const total = parseMoney(entry.dollarsPerMonth) * Number(entry.months);
      return formatMoney(total);
    }
    if (!isEntryParamKey(name)) {
      throw new Navmc10132PunishmentRenderError(
        `Code ${punishment.code}'s template names placeholder "{${name}}", which is not a field on Navmc10132PunishmentEntry.`
      );
    }
    const value = entryValue(entry, name);
    if (value === undefined || value === null) {
      throw new Navmc10132PunishmentRenderError(
        `Code ${punishment.code} needs "${name}" to fill its template.`
      );
    }
    return String(value);
  });
  // oralOrWritten can be the empty string by design, which leaves a doubled
  // space around the missing word. Collapse that here rather than in every
  // template.
  return filled.replace(/ {2,}/g, ' ').trim();
}

/**
 * Interpolates one arbitrary code's template against one entry, the same
 * way renderPunishment does internally for a real code from the table.
 *
 * This is exported only so the EntryParamKey guard in interpolate() can be
 * tested directly against a template naming a placeholder that is not a
 * real entry field, something none of the seventeen actual NAVMC 10132
 * codes' templates do, so renderPunishment's normal path never exercises
 * that rejection. Application code should use renderPunishment.
 */
export function renderTemplate(
  punishment: Navmc10132Punishment,
  entry: Navmc10132PunishmentEntry
): string {
  return interpolate(punishment, entry);
}

/** Renders one entry's full sentence, including its trailing period. */
function renderEntry(entry: Navmc10132PunishmentEntry): string {
  const punishment = resolvePunishment(entry.code);
  if (!punishment) {
    throw new Navmc10132PunishmentRenderError(
      `Unknown NAVMC 10132 punishment code "${entry.code}".`
    );
  }
  return interpolate(punishment, entry);
}

/** Set-level rendering options that apply across all of an entry list, not to any one code. */
export interface RenderPunishmentOptions {
  /**
   * True when the entries are served concurrently rather than
   * consecutively. This belongs to the entry set, not to any single code,
   * because MCM Part V para 5.d governs how multiple punishments combine,
   * not the individual punishment codes in navmc10132-punishments.ts. The
   * caller, a Phase 3 UI control, is the one who knows whether the
   * punishments it assembled are meant to run concurrently, so it decides
   * this and passes it in here rather than the module inferring it.
   *
   * Has no effect with fewer than two entries, since concurrency is
   * meaningless for a single punishment.
   */
  concurrent?: boolean;
}

/**
 * Renders item 6 ("PUNISHMENT IMPOSED") from one or more structured
 * punishment entries.
 *
 * Each entry is rendered from its code's template, filling {name}
 * placeholders from the entry's own fields plus the two computed
 * placeholders {suspClause} and {totalForf} described on the template
 * field in navmc10132-punishments.ts.
 *
 * A single entry is returned as its own sentence. Multiple entries are
 * joined as MCO worked example (6) joins a reduction and a reprimand,
 * "To be red to LCpl, E-3, and to be orally reprimanded.": each clause's
 * trailing period is dropped, clauses after the first have their first
 * letter lowercased since they continue the sentence, and the clauses are
 * joined with ", and " before a single closing period is appended. This
 * was chosen over any convention special to a particular pair of codes
 * because it is the only rule in the six worked examples that generalizes
 * to an arbitrary list of entries without new per-combination logic.
 *
 * When `options.concurrent` is true and there are two or more entries,
 * ", to run concurrently" is appended before the closing period, matching
 * how MCO worked example (5) marks a restriction and an extra duty as
 * running together. Concurrency is a property of the entry set, decided
 * by the caller, not of any one code's template. The default is false, so
 * omitting `options` leaves every previously supported example unchanged.
 *
 * Worked example (5) in the MCO also orders its restriction clause as
 * "w/susp fr du for {days} days", the reverse of worked example (1)'s
 * "for {days} days, w/susp fr du". No single template can reproduce both
 * orderings verbatim, since the two published examples contradict each
 * other. This module standardizes on example (1)'s order, the one six of
 * the seventeen codes' templates already encode, and does not attempt to
 * special-case example (5)'s reversed order. See this module's test
 * harness for the canonical-order equivalent of example (5).
 *
 * The result is never truncated. Its `length` is returned so the caller
 * can compare it against item 6's printed field capacity and decide what
 * to do about an overflow.
 *
 * @throws {Navmc10132PunishmentRenderError} if an entry names a code that
 *   is not in the NAVMC 10132 table, or omits a parameter its code's
 *   template needs.
 */
export function renderPunishment(
  entries: Navmc10132PunishmentEntry[],
  options?: RenderPunishmentOptions
): {
  text: string;
  length: number;
} {
  if (entries.length === 0) {
    return { text: '', length: 0 };
  }

  const clauses = entries.map(renderEntry);

  let text: string;
  if (clauses.length === 1) {
    text = clauses[0];
  } else {
    const parts = clauses.map((clause, i) => {
      const stripped = clause.replace(/\.\s*$/, '');
      return i === 0 ? stripped : stripped.charAt(0).toLowerCase() + stripped.slice(1);
    });
    const joined = parts.join(', and ');
    const concurrentSuffix = options?.concurrent ? ', to run concurrently' : '';
    text = `${joined}${concurrentSuffix}.`;
  }

  return { text, length: text.length };
}
