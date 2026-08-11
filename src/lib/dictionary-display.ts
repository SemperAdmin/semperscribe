import type { DictionaryEntry } from './military-dictionary';

/**
 * Presentation rules for the military dictionary autosuggest.
 *
 * The dictionary is generated from a source document that renders every
 * term in ALL CAPS, which is a typographic convention of that document,
 * not a format requirement of the drafted correspondence. Rendering it
 * raw makes the From line and every other autosuggest field read as if
 * it were shouting.
 *
 * These helpers live outside the component so they are unit-testable and
 * so nothing here mutates the shared `militaryDictionary` array.
 * src/lib/acronym-validators.ts inverts that same array into an
 * acronym-to-expansion index for the SECNAV M-5216.5 first-use checker;
 * filtering the source would silently weaken that validator.
 */

/**
 * Tokens that stay uppercase inside an otherwise natural-cased term.
 *
 * Deliberately short and auditable. Verified against all 2056 dictionary
 * entries: after conversion only six terms retain a run of two or more
 * capitals, and each one is correct.
 */
const KEEP_UPPER = new Set([
  'US', 'USA', 'USMC', 'USN', 'USAF', 'USCG', 'USNS',
  'DOD', 'DON', 'SECNAV', 'CMC', 'HQMC', 'CONUS', 'OCONUS',
  'NATO', 'JCS', 'MCO', 'NAVMC', 'SSIC', 'AWOL',
  'TAD', 'PCS', 'PDS', 'MOS', 'NCO', 'SNCO', 'UCMJ', 'EOD',
  'MEU', 'MEF', 'MAGTF', 'MCRD', 'MCB', 'MCAS', 'SMCR', 'UEPH',
  // Roman numerals that appear in program and model names.
  'II', 'III', 'IV', 'VI', 'VII', 'VIII', 'IX', 'XI', 'XII',
]);

/** Lowercased mid-phrase, per ordinary title-case convention. */
const MINOR = new Set([
  'of', 'the', 'and', 'for', 'to', 'in', 'on', 'at', 'by',
  'with', 'a', 'an', 'or', 'per', 'from', 'into', 'over', 'under', 'as',
]);

function capitalize(word: string): string {
  return word.length === 0 ? word : word[0].toUpperCase() + word.slice(1).toLowerCase();
}

function caseToken(token: string, isFirst: boolean, isLast: boolean): string {
  const match = token.match(/^([^A-Za-z0-9]*)(.*?)([^A-Za-z0-9]*)$/);
  if (!match) {
    return token;
  }
  const [, lead, core, trail] = match;
  if (core.length === 0) {
    return token;
  }
  // Anything with a digit is a designator, not prose: "CLASS A-1".
  if (/\d/.test(core)) {
    return token;
  }
  // Dotted initialisms: "U.S.".
  if (/^[A-Z](\.[A-Z])+\.?$/.test(core)) {
    return token;
  }
  // A short parenthesised all-caps token is an acronym gloss: "(AR)",
  // "(G)". A long one is an ordinary word the source shouted:
  // "(MULTIPURPOSE)", "(AVIATION)".
  if (lead.includes('(') && trail.includes(')') && core === core.toUpperCase() && core.length <= 4) {
    return token;
  }
  // A leading-hyphen fragment is a word ending, not a word:
  // "ACCORD -INC -ANCE -INGLY" means accord/according/accordance.
  if (lead.includes('-')) {
    return lead + core.toLowerCase() + trail;
  }
  if (KEEP_UPPER.has(core.toUpperCase()) && core === core.toUpperCase()) {
    return token;
  }

  const pieces = core.split(/([-/])/);
  const cased = pieces.map((piece) => {
    if (piece === '-' || piece === '/') {
      return piece;
    }
    if (KEEP_UPPER.has(piece.toUpperCase()) && piece === piece.toUpperCase()) {
      return piece;
    }
    // The minor-word rule applies only to a standalone token. A piece
    // that follows a slash starts its own phrase, so
    // "WITHOUT/OVER" has to read "Without/Over", never "Without/over".
    if (pieces.length === 1 && !isFirst && !isLast && MINOR.has(piece.toLowerCase())) {
      return piece.toLowerCase();
    }
    return capitalize(piece);
  }).join('');

  return lead + cased + trail;
}

/**
 * Converts an ALL CAPS dictionary term to natural title case, preserving
 * genuine acronyms, designators, and dotted initialisms.
 */
export function toNaturalCase(term: string): string {
  const tokens = term.split(/(\s+)/);
  const wordPositions = tokens
    .map((t, i) => (/\S/.test(t) ? i : -1))
    .filter(i => i >= 0);
  if (wordPositions.length === 0) {
    return term;
  }
  const first = wordPositions[0];
  const last = wordPositions[wordPositions.length - 1];
  return tokens
    .map((t, i) => (/\S/.test(t) ? caseToken(t, i === first, i === last) : t))
    .join('');
}

/**
 * True when the entry's TERM is itself an acronym or brevity code rather
 * than a word or phrase.
 *
 * The discriminator is the shape of `meaning`, not of `term`. In this
 * dictionary a word entry carries its approved abbreviation
 * ("ACCOMMODATE" -> "accom", "ADMINISTRATIVE COMMAND" -> "ADCOM"), while
 * an acronym entry carries a prose expansion ("ALCOM" -> "All
 * commands.", "ARREPCOVES" -> "Upon arrival report to the commanding
 * officer of that vessel for duty."). Term shape cannot be used: plain
 * words like ACCOMMODATE and ABOARD are single-token ALL CAPS too.
 *
 * A leading asterisk marks an alternative-abbreviation note in the
 * source ("COMMERCIAL" -> "*Mer or coml"), which is a word entry whose
 * meaning happens to contain a space. Measured: this rule classifies 110
 * of the 2056 entries as acronyms, and all 110 were confirmed by
 * inspection.
 */
export function isAcronymEntry(entry: DictionaryEntry): boolean {
  const term = entry.term.trim();
  const meaning = entry.meaning.trim();
  if (/\s/.test(term)) {
    return false;
  }
  if (meaning.startsWith('*')) {
    return false;
  }
  return /\s/.test(meaning);
}

/**
 * Matches dictionary entries against a query, drops acronym entries, and
 * returns the display strings the dropdown should show.
 *
 * `preserveCase` keeps the source ALL CAPS. It exists for the naval
 * letter subject line, which schemas.ts validates with
 * `val === val.toUpperCase()` ("Subject must be in ALL CAPS"). Inserting
 * a natural-cased suggestion there would fail validation on selection.
 */
export function findSuggestions(
  dictionary: DictionaryEntry[],
  query: string,
  options: { limit?: number; preserveCase?: boolean } = {},
): string[] {
  const { limit = 10, preserveCase = false } = options;
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) {
    return [];
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const entry of dictionary) {
    if (out.length >= limit) {
      break;
    }
    if (isAcronymEntry(entry)) {
      continue;
    }
    if (!entry.term.toLowerCase().includes(needle) && !entry.meaning.toLowerCase().includes(needle)) {
      continue;
    }
    const label = preserveCase ? entry.term : toNaturalCase(entry.term);
    if (seen.has(label)) {
      continue;
    }
    seen.add(label);
    out.push(label);
  }
  return out;
}
