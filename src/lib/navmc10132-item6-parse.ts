/**
 * Reading item 6 back off a signed form.
 *
 * STEPHEN, 2026-08-26, uploading a signed pass-3 UPB: "the app did not
 * extract the item 6 data from the uploaded file". The file said "Forf of
 * $100 pay.", the punishment builder said "Nothing to render yet", the
 * export gate blocked on an empty item 6, and the unit diary worksheet
 * printed PUNISHMENT [MISSING]. Item 6 was also LOCKED by the item 9
 * signature, so there was no way to type it back in either.
 *
 * WHY IT WAS NEVER PARSED, and the part of that reasoning that still holds.
 * navmc10132-pdf-to-form.ts lists item 6 among the DERIVED_FIELDS, written
 * from structure and not read back, because the app's model is a list of
 * MCTFS codes with parameters and the form holds one sentence. That is a
 * genuine one-way narrowing for part of the table: FOUR GROUPS OF CODES
 * SHARE A TEMPLATE BYTE FOR BYTE.
 *
 *   Restr ... w/susp fr du     N01 (any, 30d)  N10 (any, 14d)  N14 (fg, 60d)
 *   Restr ... w/o susp fr du   N02 (any, 30d)  N11 (any, 14d)  N15 (fg, 60d)
 *   Corr cust ...              N06 (any, 7d)   N12 (fg, 30d)
 *   Extra du ...               N09 (any, 14d)  N13 (fg, 45d)
 *
 * "Extra du for 10 days." is N09 or N13 and the sentence cannot say which.
 *
 * SO THIS NARROWS RATHER THAN GUESSES. Two facts outside the sentence cut
 * the candidates down:
 *
 *   1. WHO IMPOSED IT. Item 8A decides which codes were available at all. A
 *      company-grade commander cannot impose N13, so at company grade
 *      "Extra du" is N09 and nothing else.
 *   2. HOW LONG IT RAN. Each code carries its own ceiling. A 30-day
 *      restriction cannot be N10, whose maximum is 14.
 *
 * WHERE ONE CANDIDATE SURVIVES, that is the code. WHERE NONE OR MORE THAN
 * ONE DOES, this returns the clause unparsed rather than picking. A wrong
 * code here is not a display bug: it becomes bytes 1 to 3 of a TTC 212
 * punishment code in a statistical record MCTFS retains permanently, so
 * reporting N01 for an N10 is a permanent misstatement. Nothing is worth
 * guessing at that price.
 *
 * BOTH NARROWING RULES WERE WRONG ON FIRST WRITING, and round-tripping the
 * table against the renderer is what found them. See narrowCandidates.
 *
 * THE TEXT IS NEVER LOST EITHER WAY. The caller carries the file's own item
 * 6 string forward whatever this returns, so a clause nobody can code still
 * prints on the form and still reaches the unit diary.
 */

import type { Navmc10132PunishmentEntry } from '@/types/navmc';
import {
  NAVMC_10132_PUNISHMENTS,
  releaseOnePunishmentsFor,
  type Navmc10132Punishment,
} from '@/lib/navmc10132-punishments';

/** The suffix renderPunishment adds when the punishments run concurrently. */
const CONCURRENT_SUFFIX = ', to run concurrently';

/** How renderPunishment joins more than one clause. */
const CLAUSE_JOIN = ', and ';

/**
 * A placeholder's pattern, as a capturing group.
 *
 * `limits` is free text and therefore lazy: it is bounded by the literal
 * " for " that follows it in every template that uses it, which is what
 * makes the lazy quantifier safe where a bare `.*` would not be.
 */
const PLACEHOLDER_PATTERNS: Readonly<Record<string, string>> = {
  limits: '(.+?)',
  days: '(\\d+)',
  months: '(\\d+)',
  dollars: '([\\d,]+(?:\\.\\d{2})?)',
  dollarsPerMonth: '([\\d,]+(?:\\.\\d{2})?)',
  totalForf: '[\\d,]+(?:\\.\\d{2})?',
  gradeReducedTo: '([A-Za-z0-9/\\-]+)',
  oralOrWritten: '(orally|in writing)',
  suspClause: '(w/susp fr du|w/o susp fr du)',
};

/** Placeholders computed on export, carrying no value to read back. */
const DERIVED_PLACEHOLDERS = new Set(['totalForf']);

function escapeLiteral(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface CompiledTemplate {
  punishment: Navmc10132Punishment;
  pattern: RegExp;
  /** Capture group order, one name per group, derived placeholders omitted. */
  captures: string[];
}

/**
 * Turns a template into a matcher.
 *
 * BUILT FROM THE TABLE, never hand-written, so a template edited in
 * navmc10132-punishments.ts changes this too. A hand-written second copy of
 * seventeen sentences is seventeen chances to drift from the renderer that
 * produced the text this has to read.
 */
export function compileTemplate(punishment: Navmc10132Punishment): CompiledTemplate {
  const captures: string[] = [];
  let pattern = '';
  let cursor = 0;
  const re = /\{(\w+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(punishment.template)) !== null) {
    pattern += escapeLiteral(punishment.template.slice(cursor, match.index));
    const name = match[1];
    const placeholder = PLACEHOLDER_PATTERNS[name];
    if (placeholder === undefined) {
      // A template naming something this module has no pattern for cannot be
      // matched, and silently matching nothing would read as "no punishment
      // on the form". Refusing loudly is the only safe answer.
      throw new Error(
        `navmc10132-item6-parse: template for ${punishment.code} names {${name}}, which has ` +
          'no pattern. Add one to PLACEHOLDER_PATTERNS.',
      );
    }
    pattern += placeholder;
    if (!DERIVED_PLACEHOLDERS.has(name)) captures.push(name);
    cursor = match.index + match[0].length;
  }
  pattern += escapeLiteral(punishment.template.slice(cursor));
  return { punishment, pattern: new RegExp(`^${pattern}$`), captures };
}

/** Every template, compiled once. */
const COMPILED: CompiledTemplate[] = NAVMC_10132_PUNISHMENTS.map(compileTemplate);

/** One clause read off item 6, and what it could be. */
export interface Item6Clause {
  /** The clause as it reads on the form, with its sentence period restored. */
  text: string;
  /** The single code this resolves to, or '' where it does not resolve. */
  code: string;
  /** The entry, present only where `code` is set. */
  entry: Navmc10132PunishmentEntry | null;
  /** Every code whose template matches, before narrowing. */
  matched: string[];
  /** Codes still standing after narrowing. Not exactly one means no entry. */
  candidates: string[];
  /** Why this clause produced no entry. Empty where it did. */
  reason: string;
}

export interface Item6Parse {
  /** Every clause, in the order item 6 states them. */
  clauses: Item6Clause[];
  /** The entries, where EVERY clause resolved. Empty otherwise. */
  entries: Navmc10132PunishmentEntry[];
  /** True where every clause resolved to exactly one code. */
  complete: boolean;
  /** True where item 6 ends with the concurrent suffix. */
  concurrent: boolean;
}

export interface Item6ParseOptions {
  /** Item 8A, which decides which codes were available at all. */
  authorityPayGrade?: string;
}

/**
 * Splits item 6 into its clauses.
 *
 * renderPunishment joins with ", and ", strips each clause's period, and
 * lowercases the first letter of every clause after the first. This undoes
 * all three. A `limits` value containing ", and " would split wrongly, and
 * the guard against that is downstream rather than here: a mis-split clause
 * matches no template, one unmatched clause makes the whole parse
 * incomplete, and the caller then falls back to the file's own text.
 */
export function splitItem6(text: string): { clauses: string[]; concurrent: boolean } {
  let body = text.trim();
  if (body === '') return { clauses: [], concurrent: false };

  body = body.replace(/\.\s*$/, '');
  const concurrent = body.endsWith(CONCURRENT_SUFFIX);
  if (concurrent) body = body.slice(0, -CONCURRENT_SUFFIX.length);

  const parts = body.split(CLAUSE_JOIN);
  const clauses = parts.map((part, i) => {
    const restored = i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1);
    return `${restored}.`;
  });
  return { clauses, concurrent };
}

/** Builds an entry from a template's captures. */
function entryFrom(compiled: CompiledTemplate, match: RegExpMatchArray): Navmc10132PunishmentEntry {
  const entry: Record<string, unknown> = { code: compiled.punishment.code };
  compiled.captures.forEach((name, i) => {
    const value = match[i + 1];
    if (value === undefined) return;
    if (name === 'suspClause') {
      entry.suspendedFromDuty = value === 'w/susp fr du';
      return;
    }
    if (name === 'dollars' || name === 'dollarsPerMonth') {
      entry[name] = value.replace(/,/g, '');
      return;
    }
    entry[name] = value;
  });
  return entry as unknown as Navmc10132PunishmentEntry;
}

/**
 * Narrows a set of matching codes using what the sentence cannot say.
 *
 * BOTH RULES BELOW WERE WRONG ON FIRST WRITING, and both were found by
 * round-tripping every template through the renderer rather than by reading
 * the code. Keep the reasons.
 *
 * ITEM 8A, ON `.available` AND NOT ON THE WHOLE LIST.
 * `releaseOnePunishmentsFor` returns EVERY code with a flag, because the
 * picker offers the ones this commander may not impose and disables them
 * rather than hiding them. Reading the list without the flag accepts every
 * code: a 25-day restriction imposed by a captain resolved to N14, a
 * FIELD-GRADE code that captain could not impose.
 *
 * THE CEILING, WHERE AN EMPTY RESULT IS AN ANSWER. The first version kept
 * the previous candidates when the ceiling ruled all of them out, on the
 * reasoning that a punishment over its own limit is the form's problem
 * rather than this module's. That turned a 25-day restriction narrowed to
 * N10 alone, whose ceiling is 14 days, into a resolved N10: a code the
 * sentence contradicts. An empty set sends the clause to the unparsed path,
 * where the text is still carried and a human reads it.
 */
export function narrowCandidates(
  matched: readonly string[],
  days: number | null,
  authorityPayGrade: string,
): string[] {
  // A UNIQUE TEMPLATE IS THE ANSWER, and nothing outside the sentence can
  // change which code it is. "Arrest in quarters for 40 days." is an N03
  // whether or not forty days is lawful and whether or not item 8A shows an
  // authority who could impose it. Reading the form and judging it are
  // different jobs, and the validators already do the second one: a version
  // of this that rejected here refused to read an N04 off a form because
  // item 8A said company grade, which loses a punishment the form states
  // instead of flagging a problem with item 8A.
  if (matched.length <= 1) return [...matched];

  let candidates = [...matched];

  // ITEM 8A, ON `.available` AND NOT ON THE WHOLE LIST.
  // releaseOnePunishmentsFor returns EVERY code with a flag, because the
  // picker offers the ones this commander may not impose and disables them
  // rather than hiding them. Reading the list without the flag accepts every
  // code: a 25-day restriction imposed by a captain resolved to N14, a
  // FIELD-GRADE code that captain could not impose.
  //
  // EMPTY FALLS BACK, because item 8A can be wrong and this app's own
  // release scope is narrower than the form's. Losing every candidate here
  // would say the sentence names no punishment, when what it means is that
  // item 8A and item 6 disagree.
  if (authorityPayGrade.trim() !== '') {
    const available = new Set(
      releaseOnePunishmentsFor(authorityPayGrade)
        .filter((option) => option.available)
        .map((option) => option.punishment.code),
    );
    const byAuthority = candidates.filter((code) => available.has(code));
    if (byAuthority.length > 0) candidates = byAuthority;
  }

  // THE CEILING, WHERE AN EMPTY RESULT IS AN ANSWER and does NOT fall back.
  // Unlike item 8A, this is a contradiction inside the sentence itself: a
  // clause stating twenty-five days is not a code whose maximum is fourteen.
  // The first version kept the previous candidates here, which turned a
  // 25-day restriction narrowed to N10 alone into a resolved N10, a code the
  // sentence contradicts. An empty set sends the clause to the unparsed
  // path, where the text is still carried and a human reads it.
  if (days !== null) {
    candidates = candidates.filter((code) => {
      const punishment = NAVMC_10132_PUNISHMENTS.find((p) => p.code === code);
      return punishment?.maxDays === undefined || days <= punishment.maxDays;
    });
  }

  return candidates;
}

/**
 * Reads item 6 back into punishment entries.
 *
 * `complete` is the only flag a caller should act on. A partial parse is
 * NOT half a punishment list: item 6 is one sentence describing one
 * punishment set, and loading two of its three clauses as structure would
 * put a UPB in the app stating less than the signed form states. So
 * `entries` is empty unless every clause resolved.
 */
export function parseItem6(text: string, options: Item6ParseOptions = {}): Item6Parse {
  const { clauses: raw, concurrent } = splitItem6(text);
  const authorityPayGrade = options.authorityPayGrade ?? '';
  const clauses: Item6Clause[] = [];

  for (const clause of raw) {
    const matches = COMPILED.map((compiled) => ({
      compiled,
      match: clause.match(compiled.pattern),
    })).filter(
      (row): row is { compiled: CompiledTemplate; match: RegExpMatchArray } => row.match !== null,
    );

    if (matches.length === 0) {
      clauses.push({
        text: clause,
        code: '',
        entry: null,
        matched: [],
        candidates: [],
        reason:
          'No punishment template matches this clause. It was typed by hand, or on a revision ' +
          'of the form this app does not know.',
      });
      continue;
    }

    const matched = matches.map((row) => row.compiled.punishment.code);
    const first = matches[0];
    const daysIndex = first.compiled.captures.indexOf('days');
    const daysText = daysIndex === -1 ? undefined : first.match[daysIndex + 1];
    const daysValue = daysText === undefined ? NaN : Number(daysText);
    const days = Number.isFinite(daysValue) ? daysValue : null;
    const candidates = narrowCandidates(matched, days, authorityPayGrade);

    if (candidates.length !== 1) {
      clauses.push({
        text: clause,
        code: '',
        entry: null,
        matched,
        candidates,
        reason:
          candidates.length === 0
            ? `This clause matches ${matched.join(', ')} by wording, but the period it states ` +
              'is longer than any of them allows, or item 8A shows none of them was available ' +
              'to this commander. Read it against item 6 on the form.'
            : `This clause reads the same for ${candidates.join(', ')}, and neither item 8A ` +
              'nor the period stated tells them apart. The app will not choose one, because ' +
              'the code it chose would go into the unit diary statistical record.',
      });
      continue;
    }

    const chosen = matches.find((row) => row.compiled.punishment.code === candidates[0])!;
    clauses.push({
      text: clause,
      code: candidates[0],
      entry: entryFrom(chosen.compiled, chosen.match),
      matched,
      candidates,
      reason: '',
    });
  }

  const complete = clauses.length > 0 && clauses.every((clause) => clause.entry !== null);
  return {
    clauses,
    entries: complete ? clauses.map((clause) => clause.entry!) : [],
    complete,
    concurrent,
  };
}
