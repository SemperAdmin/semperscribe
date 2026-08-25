/**
 * Fixed-width line wrapping shared by the JAGMAN A-1 fill engine and its
 * callers. Generic layout only, no NJP knowledge, matching the fill
 * engine's own contract that callers supply already-width-safe text. This
 * module is what makes that possible: it derives the target width from
 * the appendix's own printed text rather than a hardcoded column count,
 * so a regenerated appendix (a different edition, a re-run of the
 * extractor) stays correct without a code change here.
 */

import type { JagmanAppendix } from '@/lib/jagman-appendix-a1';

/** The widest line actually printed in `appendix.text`, the appendix's
 *  own fixed-width measure, read from the source rather than assumed. */
export function appendixWidth(appendix: JagmanAppendix): number {
  return appendix.text.reduce((max, line) => Math.max(max, line.length), 0);
}

/**
 * Wraps `text` to `width` columns, breaking only on whitespace. A single
 * token longer than `width` is never cut, it gets its own over-length
 * line rather than being truncated or dropped. `labelPrefix` opens the
 * first line only (e.g. "A. "); every continuation line is indented with
 * plain spaces of the same width as `labelPrefix`, so a lettered list's
 * wrapped text aligns under the text following the letter, not under the
 * letter itself.
 *
 * `width` is the budget for this content alone. A fixed left margin every
 * physical line also needs (a paragraph's own indent, or the indent
 * fillRule/replaceNote applies automatically) is the caller's concern:
 * subtract the margin's length from `width` before calling, and prepend
 * the margin to every returned line afterward. wrapHanging never adds a
 * margin of its own beyond `labelPrefix`.
 */
export function wrapHanging(text: string, width: number, labelPrefix: string = ''): string[] {
  // Tokenise KEEPING each word's own leading separator. Splitting on /\s+/
  // and rejoining with a single space silently rewrites the text: article
  // labels carry a double space ("Art. 86  Absence without leave") and
  // collapsing it alters a string this module exists to reproduce exactly.
  // A separator is preserved when its word stays on the line, and replaced
  // by the hanging indent only where a break actually happens.
  const tokens: Array<{ sep: string; word: string }> = [];
  const re = /(\s*)(\S+)/g;
  let m = re.exec(text);
  while (m !== null) {
    tokens.push({ sep: m[1], word: m[2] });
    m = re.exec(text);
  }

  const hangIndent = ' '.repeat(labelPrefix.length);

  if (tokens.length === 0) {
    return [labelPrefix];
  }

  const lines: string[] = [];
  let current = labelPrefix + tokens[0].word;

  for (const token of tokens.slice(1)) {
    // A leading separator of zero length cannot happen after the first
    // token, the regex guarantees at least the boundary, so fall back to a
    // single space rather than gluing two words together.
    const sep = token.sep.length > 0 ? token.sep : ' ';
    const candidate = current + sep + token.word;
    if (candidate.length <= width) {
      current = candidate;
    } else {
      lines.push(current);
      current = hangIndent + token.word;
    }
  }
  lines.push(current);
  return lines;
}
