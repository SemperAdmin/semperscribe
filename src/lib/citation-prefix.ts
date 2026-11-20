/**
 * Hand-typed citation prefixes on references and enclosures.
 *
 * The app letters references "(a)", "(b)" and numbers enclosures "(1)",
 * "(2)" itself (reference-letters.ts, NavalLetterPDF), and position
 * papers label enclosures Tab A, Tab B. A Marine who types or pastes
 * "(a) MCO 1553.3B", or an imported document that carries
 * "Encl (1) Unit SOP", would otherwise print "(a) (a) MCO 1553.3B".
 * stripCitationPrefix removes that one leading prefix where the text
 * enters document state.
 *
 * Strips ONE leading prefix, plus the whitespace and an optional
 * "-", an en or em dash, or ":" that follows it:
 *   - "(a) ", "(aa) ", "(1) ", "(12) "          bare parenthesised marker
 *   - "a. ", "aa. ", "1. ", "12. "              lowercase letter or number, dot, space
 *   - "Ref (a) ", "Ref: (a) ", "Reference (a) ", "Refs (a) "
 *   - "Encl (1) ", "Encl: (1) ", "Enclosure (1) - ", "Attachment (1) "
 *   - "Tab (A) ", "Tab: (B) "                   label forms take letters of either case
 *     or 1-3 digits inside the parentheses
 *
 * Deliberately keeps:
 *   - "MCO 1553.3B", "SECNAV M-5216.5", any text that starts with a word
 *   - "U.S. Navy Regulations, 1990" and "A. Smith ltr of 3 Jan 26":
 *     an uppercase letter and a dot is an initial, so only lowercase
 *     letters (or digits) are treated as a list marker without a label
 *   - portion markings "(U)", "(CUI)", "(S)", "(TS)" (classification.ts
 *     portionPrefix): a bare parenthesised marker must be lowercase or
 *     digits, and longer than two letters never matches
 *   - "no. 5 ..." and similar two-letter abbreviations: a two-letter
 *     marker must be one letter doubled, as references run (aa), (bb)
 *   - a label with no marker ("Ref MCO 1.1"), and a second prefix
 *     ("(a) (b) X" becomes "(b) X")
 */

const SEP = String.raw`\s*[-–—:]?\s*`;
const MARKER_LOWER = String.raw`(?:([a-z])\1?|\d{1,3})`;
const MARKER_ANY = String.raw`(?:[A-Za-z]{1,2}|\d{1,3})`;

const LABELED = new RegExp(
  String.raw`^(?:references?|refs?|enclosures?|encls?|attachments?|tab)\b\.?\s*:?\s*\(\s*${MARKER_ANY}\s*\)${SEP}`,
  'i',
);
const BARE_PAREN = new RegExp(String.raw`^\(\s*${MARKER_LOWER}\s*\)${SEP}`);
const DOTTED = new RegExp(String.raw`^${MARKER_LOWER}\.\s+`);

export function stripCitationPrefix(text: string): string {
  if (typeof text !== 'string') return text;
  const trimmed = text.replace(/^\s+/, '');
  for (const re of [LABELED, BARE_PAREN, DOTTED]) {
    const m = re.exec(trimmed);
    if (m) return trimmed.slice(m[0].length);
  }
  return text;
}

/** Maps a list of reference or enclosure strings through stripCitationPrefix. */
export function stripCitationPrefixes(list: string[]): string[] {
  return list.map(stripCitationPrefix);
}
